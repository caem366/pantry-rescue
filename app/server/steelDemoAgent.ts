import { chromium } from "playwright";
import Steel from "steel-sdk";
import { discoverDemoMarketProducts, inspectDemoMarketProduct } from "./demoMarketDiscovery.ts";
import { progress, type AgentProgressEvent } from "../src/lib/agentProgress.ts";
import type { MissingIngredient, ProductCandidate, ProductSelection, ShoppingResult, Unit } from "../src/lib/shoppingAgent.ts";

type CloudDemoConfig = { apiKey: string; marketUrl: string };
type DemoSession = { id: string; viewerUrl: string; websocketUrl: string; expiresAt: number; paused: boolean; takeover: boolean; events: AgentProgressEvent[] };
type CloudDemoPreview = { id: string; selections: ProductSelection[]; candidates: { ingredientId: string; products: BrowserProduct[] }[]; results: ShoppingResult[]; events: AgentProgressEvent[]; screenshot?: string; expiresAt: number };
type BrowserProduct = { id: string; name: string; size: string; price: number; available: boolean };
export type BrowserCartItem = { id: string; name: string; size: string; unitPrice: number; quantity: number };

const sessions = new Map<string, DemoSession>();
const previews = new Map<string, CloudDemoPreview>();
const minute = 60_000;

function canonical(quantity: number, unit: Unit) {
  if (unit === "L") return { quantity: quantity * 1000, unit: "mL" as const };
  if (unit === "kg") return { quantity: quantity * 1000, unit: "g" as const };
  return { quantity, unit };
}

function parseSize(size: string): { quantity: number; unit: Unit } | undefined {
  const match = size.trim().match(/^(\d+(?:\.\d+)?)\s*(g|kg|mL|L|each)\b/i);
  if (!match) return undefined;
  const quantity = Number(match[1]);
  const token = match[2].toLowerCase();
  return { quantity, unit: token === "ml" ? "mL" : token === "l" ? "L" : token as Unit };
}

function select(ingredient: MissingIngredient, products: BrowserProduct[]): ProductSelection | undefined {
  const needed = canonical(ingredient.requiredQuantity, ingredient.unit);
  const matches = products.flatMap((product) => {
    const size = parseSize(product.size);
    const normalized = size ? canonical(size.quantity, size.unit) : undefined;
    const token = ingredient.ingredient.replace(/s$/, "").toLowerCase();
    if (!product.available || !normalized || normalized.unit !== needed.unit || !product.name.toLowerCase().includes(token)) return [];
    const quantity = Math.max(1, Math.ceil(needed.quantity / normalized.quantity));
    return [{ product, size, quantity, overage: normalized.quantity * quantity - needed.quantity }];
  }).sort((a, b) => a.overage - b.overage || a.product.price * a.quantity - b.product.price * b.quantity);
  const match = matches[0];
  if (!match) return undefined;
  const candidate: ProductCandidate = {
    retailerId: "steel-demo-market",
    retailerProductId: match.product.id,
    name: match.product.name,
    packageQuantity: match.size.quantity,
    packageUnit: match.size.unit,
    price: match.product.price,
    currency: "CAD",
    available: match.product.available,
    retrievedAt: new Date().toISOString(),
  };
  return { ingredient, product: candidate, quantity: match.quantity, reason: `${match.quantity} package${match.quantity === 1 ? "" : "s"} cover the approved amount with the least excess among available matches.` };
}

function ensureConfig(config: CloudDemoConfig) {
  if (!config.apiKey) throw new Error("STEEL_API_KEY is not configured on the shopping service.");
  if (!/^https:\/\//.test(config.marketUrl)) throw new Error("DEMO_MARKET_URL must be an HTTPS Netlify preview URL before a cloud browser can run.");
}

function getSession(id: string) {
  const session = sessions.get(id);
  if (!session || session.expiresAt <= Date.now()) throw new Error("The cloud browser session expired. Start a new session.");
  return session;
}

function sessionState(session: DemoSession) {
  return { 
    sessionId: session.id, 
    viewerUrl: session.viewerUrl, 
    expiresAt: new Date(session.expiresAt).toISOString(),
    paused: session.paused, 
    takeover: session.takeover };
}

function requireAutomation(session: DemoSession) {
  if (session.paused) throw new Error("The browser agent is paused for your takeover. Resume the agent to inspect the cart before any further cart action.");
}

async function attach(config: CloudDemoConfig, session: DemoSession) {
  const browser = await chromium.connectOverCDP(`${session.websocketUrl}&apiKey=${encodeURIComponent(config.apiKey)}`);
  const context = browser.contexts()[0];
  const page = context.pages()[0];
  return { browser, page };
}

/** Shares the existing Steel session and takeover lock with retailer-specific browser work. */
export async function withCloudBrowser<T>(config: CloudDemoConfig, sessionId: string, work: (page: import("playwright").Page, events: AgentProgressEvent[]) => Promise<T>, inspectPaused = false): Promise<T> {
  ensureConfig(config);
  const session = getSession(sessionId);
  if (!inspectPaused) requireAutomation(session);
  const { browser, page } = await attach(config, session);
  try { return await work(page, session.events); }
  finally { await browser.close(); }
}

export function recordCloudDemoEvent(sessionId: string, event: AgentProgressEvent) {
  getSession(sessionId).events.push(event);
}

export function resumeCloudSessionAfterInspection(sessionId: string) {
  const session = getSession(sessionId);
  session.paused = false;
  session.takeover = false;
  return sessionState(session);
}

async function productsFor(page: import("playwright").Page, ingredient: MissingIngredient): Promise<BrowserProduct[]> {
  return await discoverDemoMarketProducts(page, ingredient.ingredient);
}

/** Product cards are candidates only; inspect the linked product page before an approval or cart write. */
async function inspectRenderedProduct(page: import("playwright").Page, product: BrowserProduct) {
  const detail = await inspectDemoMarketProduct(page, product.id);
  await page.goBack({ waitUntil: "domcontentloaded" });
  if (detail.name !== product.name || detail.size !== product.size || detail.price !== product.price || detail.available !== product.available) {
    throw new Error("The product page no longer matches the search result; review the product again.");
  }
}

async function cartItemsFor(page: import("playwright").Page): Promise<BrowserCartItem[]> {
  const items = await page.getByTestId("cart-item").evaluateAll((items) => items.map((item) => ({
    id: item.getAttribute("data-product-id") ?? "",
    name: item.querySelector("b")?.textContent?.trim() ?? "",
    size: item.getAttribute("data-product-size") ?? "",
    unitPrice: Number(item.getAttribute("data-unit-price")),
    quantity: Number(item.getAttribute("data-quantity")),
  })));
  if (items.some((item) => !item.id || !item.name || !item.size || !Number.isFinite(item.unitPrice) || item.unitPrice < 0 || !Number.isInteger(item.quantity) || item.quantity < 1)) {
    throw new Error("The browser cart has incomplete product details; its contents cannot be verified.");
  }
  return items;
}

/** Re-read the cart after a mutation; never retry an uncertain click. */
export function reconcileCartItem(before: BrowserCartItem[], after: BrowserCartItem[], selection: ProductSelection) {
  const prior = before.find((item) => item.id === selection.product.retailerProductId);
  if (prior) return { status: "NEEDS_ATTENTION" as const, message: "This product was already in the cart before Pantry Rescue started, so it was not changed." };
  const item = after.find((entry) => entry.id === selection.product.retailerProductId);
  if (item && (item.name !== selection.product.name || item.size !== `${selection.product.packageQuantity} ${selection.product.packageUnit}` || item.unitPrice !== selection.product.price)) {
    return { status: "NEEDS_ATTENTION" as const, message: "The cart product, package size, or price differs from the approved selection." };
  }
  if (item?.quantity === selection.quantity) return { status: "ADDED" as const, message: "Product, package, price, and quantity verified in the cloud browser cart." };
  if (item) return { status: "NEEDS_ATTENTION" as const, message: `Cart quantity is ${item.quantity}; expected ${selection.quantity}. Pantry Rescue did not retry the cart action.` };
  return { status: "NEEDS_ATTENTION" as const, message: "The cart action could not be verified. Pantry Rescue did not retry the cart action." };
}

export function cloudDemoConfigured(config: CloudDemoConfig) {
  return Boolean(config.apiKey && /^https:\/\//.test(config.marketUrl));
}

export async function startCloudDemoSession(config: CloudDemoConfig): Promise<DemoSession> {
  ensureConfig(config);
  const client = new Steel({ steelAPIKey: config.apiKey });
  const created = await client.sessions.create({ headless: false, persistProfile: true, timeout: 10 * minute, debugConfig: { interactive: true } });
  const session = { id: created.id, viewerUrl: created.debugUrl, websocketUrl: created.websocketUrl, expiresAt: Date.now() + 10 * minute, paused: false, takeover: false, events: [progress("DISCOVERY", "Starting shopping session", "COMPLETE")] };
  sessions.set(session.id, session);
  return session;
}

export function cloudDemoSessionStatus(sessionId: string) {
  return sessionState(getSession(sessionId));
}

export function cloudDemoSessionEvents(sessionId: string) {
  return getSession(sessionId).events;
}

export function pauseCloudDemoSession(sessionId: string, takeover = false) {
  const session = getSession(sessionId);
  session.paused = true;
  session.takeover = takeover;
  session.events.push(progress("CART", takeover ? "Waiting for you to take over" : "Shopping paused", "WARNING", "The agent will not change the cart until you resume."));
  return sessionState(session);
}

export async function resumeCloudDemoSession(config: CloudDemoConfig, sessionId: string) {
  ensureConfig(config);
  const session = getSession(sessionId);
  const { browser, page } = await attach(config, session);
  try {
    session.events.push(progress("CART", "Verifying cart", "ACTIVE"));
    const cartItems = await cartItemsFor(page);
    const screenshot = (
      await page.screenshot({ type: "png" })).toString("base64");
    session.paused = false;
    session.takeover = false;
    session.events.push(progress("CART", "Verifying cart", "COMPLETE", `${cartItems.length} cart line${cartItems.length === 1 ? "" : "s"} found before resuming.`));
    return { ...sessionState(session), cartItems, screenshot: `data:image/png;base64,${screenshot}` };
  } finally { 
    await browser.close(); }
}

export async function previewCloudDemoBasket(config: CloudDemoConfig, sessionId: string, ingredients: MissingIngredient[]) {
  ensureConfig(config);
  const session = getSession(sessionId);
  requireAutomation(session);
  const report = (event: AgentProgressEvent) => session.events.push(event);
  const selections: ProductSelection[] = [];
  const results: ShoppingResult[] = [];
  const candidates: { ingredientId: string; products: BrowserProduct[] }[] = [];
  const { browser, page } = await attach(config, session);
  try {
    report(progress("DISCOVERY", "Starting shopping session", "ACTIVE"));
    await page.goto(config.marketUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    try {
      await page.getByTestId("demo-search").waitFor({ state: "visible", timeout: 15_000 });
    } catch {
      const pageText = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 300);
      throw new Error(`Demo Market did not load at ${page.url()}: ${pageText || "no page content"}`);
    }
    report(progress("DISCOVERY", "Starting shopping session", "COMPLETE"));
    for (const [index, ingredient] of ingredients.entries()) {
      requireAutomation(session);
      if (index > 0) report(progress("DISCOVERY", `Moving to ${ingredient.ingredient}`, "ACTIVE"));
      report(progress("DISCOVERY", `Searching for ${ingredient.ingredient}`, "ACTIVE"));
      let products: BrowserProduct[];
      try { products = await productsFor(page, ingredient); }
      catch (error) {
        const message = error instanceof Error ? error.message : "Demo Market search failed.";
        results.push({ ingredient, status: "NEEDS_ATTENTION", message });
        report(progress("DISCOVERY", `${ingredient.ingredient} needs attention`, "FAILED", message));
        continue;
      }
      candidates.push({ ingredientId: ingredient.id, products });
      report(progress("DISCOVERY", "Found possible matches", "COMPLETE", `${products.length} displayed product${products.length === 1 ? "" : "s"} for ${ingredient.ingredient}`));
      const selection = select(ingredient, products);
      if (!selection) {
        results.push({ ingredient, status: "NEEDS_ATTENTION", message: "No suitable Demo Market product was found." });
        report(progress("MATCHING", `${ingredient.ingredient} needs attention`, "WARNING", "No suitable product matched the approved quantity."));
      } else {
        try {
          await inspectRenderedProduct(page, { id: selection.product.retailerProductId, name: selection.product.name, size: `${selection.product.packageQuantity} ${selection.product.packageUnit}`, price: selection.product.price ?? NaN, available: selection.product.available });
        } catch (error) {
          const message = error instanceof Error ? error.message : "The product page could not be verified.";
          results.push({ ingredient, status: "NEEDS_ATTENTION", message });
          report(progress("MATCHING", `${ingredient.ingredient} needs attention`, "WARNING", message));
          continue;
        }
        selections.push(selection);
        report(progress("MATCHING", "Found possible matches", "COMPLETE", `${selection.product.name} · ${selection.product.packageQuantity} ${selection.product.packageUnit} · $${selection.product.price?.toFixed(2)}`));
      }
    }
    const screenshot = (await page.screenshot({ type: "png" })).toString("base64");
    const preview = { id: crypto.randomUUID(), selections, candidates, results, events: session.events, screenshot, expiresAt: Date.now() + 5 * minute };
    previews.set(`${sessionId}:${preview.id}`, preview);
    report(progress("OPTIMIZATION", "Waiting for approval", "COMPLETE", "No cart changes have been made."));
    return { previewId: preview.id, selections, candidates, results, events: session.events, screenshot: `data:image/png;base64,${screenshot}`, viewerUrl: session.viewerUrl };
  } finally { await browser.close(); }
}

export async function buildCloudDemoBasket(config: CloudDemoConfig, sessionId: string, previewId: string, approvedIngredientIds: string[], approvedProducts?: { ingredientId: string; retailerProductId: string }[]) {
  ensureConfig(config);
  const session = getSession(sessionId);
  requireAutomation(session);
  const stored = previews.get(`${sessionId}:${previewId}`);
  if (!stored || stored.expiresAt <= Date.now()) throw new Error("This cloud-browser product review expired. Search again and approve current products.");
  if (approvedIngredientIds.length !== stored.selections.length || !stored.selections.every((selection) => approvedIngredientIds.includes(selection.ingredient.id))) throw new Error("Approve every exact cloud-browser product before building the cart.");
  if (approvedProducts && (approvedProducts.length !== stored.selections.length || new Set(approvedProducts.map((item) => item.ingredientId)).size !== approvedProducts.length)) throw new Error("Approve one exact product for every ingredient.");
  const selections = stored.selections.map((original) => {
    const chosenId = approvedProducts ? approvedProducts.find((item) => item.ingredientId === original.ingredient.id)?.retailerProductId : original.product.retailerProductId;
    const candidate = stored.candidates.find((group) => group.ingredientId === original.ingredient.id)?.products.find((item) => item.id === chosenId);
    const chosen = candidate && select(original.ingredient, [candidate]);
    if (!chosen) throw new Error(`The approved product for ${original.ingredient.ingredient} was not in the inspected results. Search again.`);
    return chosen;
  });
  const results: ShoppingResult[] = [];
  const { browser, page } = await attach(config, session);
  try {
    let baseline: BrowserCartItem[];
    try { baseline = await cartItemsFor(page); }
    catch (error) {
      const message = error instanceof Error ? error.message : "The existing cart could not be read.";
      for (const selection of selections) results.push({ ingredient: selection.ingredient, selection, status: "NEEDS_ATTENTION", message });
      session.events.push(progress("CART", "Cart needs attention", "FAILED", message));
      return { results, cartItems: [], events: session.events, viewerUrl: session.viewerUrl };
    }
    for (const [index, approved] of selections.entries()) {
      requireAutomation(session);
      if (index > 0) session.events.push(progress("CART", `Moving to ${approved.ingredient.ingredient}`, "ACTIVE"));
      let products: BrowserProduct[];
      try { products = await productsFor(page, approved.ingredient); }
      catch (error) {
        const message = error instanceof Error ? error.message : "Demo Market search failed while rechecking the approved product.";
        results.push({ ingredient: approved.ingredient, selection: approved, status: "NEEDS_ATTENTION", message });
        session.events.push(progress("CART", `${approved.ingredient.ingredient} needs attention`, "FAILED", message));
        continue;
      }
      const current = products.find((product) => product.id === approved.product.retailerProductId && product.name === approved.product.name && product.available && product.price === approved.product.price && product.size === `${approved.product.packageQuantity} ${approved.product.packageUnit}`);
      if (!current) {
        results.push({ ingredient: approved.ingredient, selection: approved, status: "NEEDS_ATTENTION", message: "Product changed or became unavailable; review again before adding." });
        session.events.push(progress("CART", `${approved.ingredient.ingredient} needs attention`, "WARNING", "The reviewed Demo Market product changed."));
        continue;
      }
      try {
        await inspectRenderedProduct(page, current);
      } catch (error) {
        const message = error instanceof Error ? error.message : "The product page could not be verified.";
        results.push({ ingredient: approved.ingredient, selection: approved, status: "NEEDS_ATTENTION", message });
        session.events.push(progress("CART", `${approved.ingredient.ingredient} needs attention`, "WARNING", message));
        continue;
      }
      const alreadyPresent = reconcileCartItem(baseline, baseline, approved);
      if (alreadyPresent.status === "NEEDS_ATTENTION" && baseline.some((item) => item.id === approved.product.retailerProductId)) {
        results.push({ ingredient: approved.ingredient, selection: approved, status: alreadyPresent.status, message: alreadyPresent.message });
        session.events.push(progress("CART", `${approved.ingredient.ingredient} needs attention`, "WARNING", alreadyPresent.message));
        continue;
      }
      session.events.push(progress("CART", `Adding ${approved.ingredient.ingredient} to cart`, "ACTIVE", approved.reason));
      const button = page.getByTestId(`add-to-cart-${approved.product.retailerProductId}`);
      let clickError: unknown;
      try { for (let count = 0; count < approved.quantity; count += 1) { requireAutomation(session); await button.click(); } }
      catch (error) { clickError = error; }
      let reconciliation: ReturnType<typeof reconcileCartItem>;
      try {
        session.events.push(progress("CART", "Verifying cart", "ACTIVE"));
        reconciliation = reconcileCartItem(baseline, await cartItemsFor(page), approved);
      }
      catch (error) {
        const message = error instanceof Error ? error.message : "The cart could not be read after the action.";
        results.push({ ingredient: approved.ingredient, selection: approved, status: "NEEDS_ATTENTION", message });
        session.events.push(progress("CART", `${approved.ingredient.ingredient} needs attention`, "FAILED", message));
        continue;
      }
      const message = clickError && reconciliation.status === "ADDED" ? "The browser action was interrupted, but the cart was reconciled and verified." : reconciliation.message;
      results.push({ ingredient: approved.ingredient, selection: approved, status: reconciliation.status, message, cartActionSucceeded: reconciliation.status === "ADDED" });
      session.events.push(progress("CART", reconciliation.status === "ADDED" ? "Verifying cart" : `${approved.ingredient.ingredient} needs attention`, reconciliation.status === "ADDED" ? "COMPLETE" : "WARNING", message));
    }
    const cartItems = await cartItemsFor(page);
    const screenshot = (await page.screenshot({ type: "png" })).toString("base64");
    previews.delete(`${sessionId}:${previewId}`);
    const complete = stored.results.length === 0 && results.every((result) => result.status === "ADDED");
    session.events.push(progress("CART", complete ? "Shopping complete" : "Shopping finished — some items need attention", complete ? "COMPLETE" : "WARNING", "Review the Demo Market cart; checkout is unavailable."));
    return { results, cartItems, events: session.events, screenshot: `data:image/png;base64,${screenshot}`, viewerUrl: session.viewerUrl };
  } finally { await browser.close(); }
}

export async function releaseCloudDemoSession(config: CloudDemoConfig, sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return;
  const client = new Steel({ steelAPIKey: config.apiKey });
  await client.sessions.release(session.id);
  sessions.delete(sessionId);
  for (const key of previews.keys()) if (key.startsWith(`${sessionId}:`)) previews.delete(key);
}
