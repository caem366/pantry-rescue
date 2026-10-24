import { randomUUID } from "node:crypto";
import type { Page } from "playwright";
import { progress } from "../src/lib/agentProgress.ts";
import { selectProduct, type MissingIngredient, type ProductCandidate, type ProductSelection, type ShoppingResult, type Unit } from "../src/lib/shoppingAgent.ts";
import { cloudDemoSessionStatus, pauseCloudDemoSession, withCloudBrowser } from "./steelDemoAgent.ts";

type Config = { apiKey: string; marketUrl: string };
type CartLine = { id: string; name: string; size: string; unitPrice: number; quantity: number };
const previews = new Map<string, { id: string; selections: ProductSelection[]; candidates: Map<string, ProductCandidate[]>; results: ShoppingResult[]; expiresAt: number; postalCode: string }>();
const walmartOrigin = "https://www.walmart.ca";

export function forgetWalmartPreview(sessionId: string) { previews.delete(sessionId); }

export async function openWalmartHome(config: Config, sessionId: string) {
  return withCloudBrowser(config, sessionId, async (page) => {
    await page.goto(walmartOrigin, { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (new URL(page.url()).origin !== walmartOrigin) throw new Error("Walmart navigation left the supported website.");
  });
}

function productUrl(href: string): string | undefined {
  try {
    const url = new URL(href, walmartOrigin);
    return url.origin === walmartOrigin && /^\/en\/ip\/[^/]+\/[^/?#]+/.test(url.pathname) ? url.href : undefined;
  } catch { return undefined; }
}

function requireRunning(sessionId: string) {
  if (cloudDemoSessionStatus(sessionId).paused) throw new Error("The browser agent was paused or handed to you; no further cart click was attempted.");
}

export function parseWalmartSize(value: string): { quantity: number; unit: Unit } | undefined {
  const match = value.match(/(?:^|\s|,|\()([\d.]+)\s*(kg|g|ml|l|ct|count|pack)\b/i);
  if (!match || !Number.isFinite(Number(match[1])) || Number(match[1]) <= 0) return undefined;
  const unit = match[2].toLowerCase();
  return { quantity: Number(match[1]), unit: unit === "ml" ? "mL" : unit === "l" ? "L" : ["ct", "count", "pack"].includes(unit) ? "each" : unit as Unit };
}

export function parseWalmartPrice(value: string): number | undefined {
  const match = value.match(/(?:CAD\s*)?\$\s*(\d{1,4}(?:[.,]\d{2})?)/i);
  return match ? Number(match[1].replace(",", ".")) : undefined;
}

export function walmartCandidate(raw: { name: string; href: string; text: string }, observedAt = new Date().toISOString()): ProductCandidate | undefined {
  const sourceUrl = productUrl(raw.href);
  const size = parseWalmartSize(raw.name);
  const price = parseWalmartPrice(raw.text);
  if (!sourceUrl || !raw.name.trim() || !size || price === undefined) return undefined;
  return { retailerId: "walmart-ca", retailerProductId: new URL(sourceUrl).pathname.split("/").at(-1)!, name: raw.name.trim(), packageQuantity: size.quantity, packageUnit: size.unit, price, currency: "CAD", available: !/out of stock|sold out|unavailable/i.test(raw.text), availabilityVerified: false, sourceUrl, retrievedAt: observedAt };
}

async function assertWalmart(page: Page) {
  const url = new URL(page.url());
  if (url.origin !== walmartOrigin) throw new Error(`Walmart navigation left the supported website (${url.origin}).`);
  const body = (await page.locator("body").innerText().catch(() => "")).slice(0, 1200);
  if (/access denied|captcha|verify you are human|unusual traffic|real shoppers, not robots|press and hold/i.test(body)) throw new Error("Walmart presented an identity check. Pantry Rescue stopped without attempting to bypass it or change the cart.");
}

export async function searchWalmartProducts(page: Page, ingredient: MissingIngredient): Promise<ProductCandidate[]> {
  const query = ingredient.searchTerms?.[0] ?? ingredient.ingredient;
  await page.goto(walmartOrigin, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await assertWalmart(page);
  const searchBox = page.locator('input[type="search"], input[placeholder*="Search" i], input[aria-label*="Search" i]').filter({ visible: true }).first();
  try { await searchBox.waitFor({ state: "visible", timeout: 10_000 }); }
  catch {
    await assertWalmart(page);
    throw new Error(`Walmart's search field was not available at ${page.url()}; no product or cart action was attempted.`);
  }
  await searchBox.fill(query);
  await searchBox.press("Enter");
  const productLinks = page.locator('a[href*="/en/ip/"]');
  try { await productLinks.first().waitFor({ state: "visible", timeout: 15_000 }); }
  catch {
    await assertWalmart(page);
    throw new Error(`Walmart search showed no readable product cards at ${page.url()}. The page may have changed, returned no matches, or require user attention.`);
  }
  await assertWalmart(page);
  const raw = await productLinks.evaluateAll((links) => links.map((link) => {
    let card: Element | null = link.closest('article, li, [data-testid*="product" i], [data-automation-id*="product" i]');
    if (!card) {
      card = link.parentElement;
      for (let depth = 0; depth < 4 && card && !/\$\s*\d/.test(card.textContent ?? ""); depth += 1) card = card.parentElement;
    }
    return { name: link.querySelector("img")?.getAttribute("alt") || link.textContent?.trim() || link.getAttribute("aria-label") || "", href: (link as HTMLAnchorElement).href, text: card?.textContent?.replace(/\s+/g, " ").trim() ?? "" };
  }));
  const unique = new Map<string, ProductCandidate>();
  for (const row of raw) { const candidate = walmartCandidate(row); if (candidate) unique.set(candidate.retailerProductId, candidate); }
  return [...unique.values()];
}

async function inspectProduct(page: Page, selection: ProductSelection): Promise<boolean> {
  if (!selection.product.sourceUrl || !productUrl(selection.product.sourceUrl)) return false;
  await page.goto(selection.product.sourceUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await assertWalmart(page);
  const heading = await page.getByRole("heading", { level: 1 }).first().textContent().catch(() => "");
  const text = (await page.locator("body").innerText()).slice(0, 3500);
  return Boolean(heading && heading.trim().toLowerCase() === selection.product.name.trim().toLowerCase()
    && parseWalmartPrice(text) === selection.product.price && !/out of stock|sold out/i.test(text));
}

export async function readWalmartCart(page: Page): Promise<CartLine[]> {
  await page.goto(`${walmartOrigin}/en/cart`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await assertWalmart(page);
  await page.getByRole("heading", { name: /cart/i }).first().waitFor({ state: "visible", timeout: 10_000 });
  const lines = await page.locator('a[href*="/en/ip/"]').evaluateAll((links) => links.map((link) => {
    const row = link.closest("article, li, [data-testid], [data-automation-id]") ?? link.parentElement?.parentElement;
    const text = row?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const quantityInput = row?.querySelector('input[type="number"], input[aria-label*="quantity" i]') as HTMLInputElement | null;
    return { href: (link as HTMLAnchorElement).href, name: link.querySelector("img")?.getAttribute("alt") || link.textContent?.trim() || link.getAttribute("aria-label") || "", text, quantity: quantityInput?.value ?? "" };
  }));
  if (!lines.length && !/your cart is empty|cart is empty|no items in your cart/i.test(await page.locator("body").innerText())) {
    throw new Error("The Walmart cart has no readable product lines or confirmed empty state. No cart mutation is safe.");
  }
  const parsed = lines.flatMap((line) => {
    const url = productUrl(line.href); const size = parseWalmartSize(line.name); const price = parseWalmartPrice(line.text); const quantity = Number(line.quantity);
    return url && size && price !== undefined && Number.isInteger(quantity) && quantity > 0
      ? [{ id: new URL(url).pathname.split("/").at(-1)!, name: line.name.trim(), size: `${size.quantity} ${size.unit}`, unitPrice: price, quantity }]
      : [];
  });
  if (lines.length && parsed.length !== lines.length) throw new Error("The retailer cart contains a product line that Pantry Rescue cannot read. No cart mutation is safe.");
  return parsed;
}

export async function previewWalmartBasket(config: Config, sessionId: string, ingredients: MissingIngredient[], postalCode: string) {
  return withCloudBrowser(config, sessionId, async (page, events) => {
    const selections: ProductSelection[] = []; const results: ShoppingResult[] = [];
    const candidates: { ingredientId: string; products: { id: string; name: string; size: string; price: number; available: boolean }[] }[] = [];
    const candidateProducts = new Map<string, ProductCandidate[]>();
    for (const [index, ingredient] of ingredients.entries()) {
      requireRunning(sessionId);
      if (index > 0) events.push(progress("DISCOVERY", `Moving to ${ingredient.ingredient}`, "ACTIVE"));
      events.push(progress("DISCOVERY", `Searching for ${ingredient.ingredient}`, "ACTIVE"));
      try {
        const products = await searchWalmartProducts(page, ingredient);
        candidateProducts.set(ingredient.id, products);
        candidates.push({ ingredientId: ingredient.id, products: products.map((item) => ({ id: item.retailerProductId, name: item.name, size: `${item.packageQuantity} ${item.packageUnit}`, price: item.price!, available: item.available })) });
        const selection = selectProduct(ingredient, products);
        if (!selection || !await inspectProduct(page, selection)) throw new Error("No product with a matching detail page, package, and observed price was verified.");
        selections.push(selection);
        events.push(progress("MATCHING", "Found possible matches", "COMPLETE", `${selection.product.name} · ${selection.product.packageQuantity} ${selection.product.packageUnit} · $${selection.product.price?.toFixed(2)}`));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Search could not be verified.";
        results.push({ ingredient, status: "NEEDS_ATTENTION", message });
        events.push(progress("DISCOVERY", `${ingredient.ingredient} needs attention`, "WARNING", message));
        if (/identity check|press and hold|captcha|verify you are human|real shoppers, not robots/i.test(message)) {
          pauseCloudDemoSession(sessionId, true);
          for (const remaining of ingredients.slice(index + 1)) results.push({ ingredient: remaining, status: "NEEDS_ATTENTION", message: "Shopping paused for Walmart identity verification; this item was not searched." });
          break;
        }
      }
    }
    events.push(progress("OPTIMIZATION", "Waiting for approval", "COMPLETE", "No cart changes have been made."));
    const id = randomUUID(); previews.set(sessionId, { id, selections, candidates: candidateProducts, results, expiresAt: Date.now() + 5 * 60_000, postalCode });
    const screenshot = `data:image/png;base64,${(await page.screenshot({ type: "png" })).toString("base64")}`;
    return { previewId: id, selections, candidates, results, events, screenshot };
  });
}

export async function buildWalmartBasket(config: Config, sessionId: string, previewId: string, approvedIngredientIds: string[], approvedProducts?: { ingredientId: string; retailerProductId: string }[]) {
  const preview = previews.get(sessionId);
  if (!preview || preview.id !== previewId || preview.expiresAt < Date.now()) throw new Error("Walmart product approval expired; search again.");
  if (approvedIngredientIds.length !== preview.selections.length || new Set(approvedIngredientIds).size !== preview.selections.length || !preview.selections.every((item) => approvedIngredientIds.includes(item.ingredient.id))) throw new Error("Approve every exact Walmart product before cart changes.");
  if (approvedProducts && (approvedProducts.length !== preview.selections.length || new Set(approvedProducts.map((item) => item.ingredientId)).size !== approvedProducts.length)) throw new Error("Approve one exact Walmart product for every ingredient.");
  const selections = preview.selections.map((original) => {
    const chosenId = approvedProducts ? approvedProducts.find((item) => item.ingredientId === original.ingredient.id)?.retailerProductId : original.product.retailerProductId;
    const candidate = preview.candidates.get(original.ingredient.id)?.find((item) => item.retailerProductId === chosenId);
    const chosen = candidate && selectProduct(original.ingredient, [candidate]);
    if (!chosen) throw new Error(`The approved Walmart product for ${original.ingredient.ingredient} was not in the inspected results. Search again.`);
    return chosen;
  });
  previews.delete(sessionId);
  return withCloudBrowser(config, sessionId, async (page, events) => {
    const results: ShoppingResult[] = [];
    let cartItems: CartLine[] = [];
    try { cartItems = await readWalmartCart(page); }
    catch (error) { throw new Error(`Cart baseline could not be inspected; no cart changes were made. ${error instanceof Error ? error.message : ""}`); }
    for (const [index, selection] of selections.entries()) {
      const { ingredient, product } = selection;
      try {
        requireRunning(sessionId);
        if (index > 0) events.push(progress("CART", `Moving to ${ingredient.ingredient}`, "ACTIVE"));
        if (cartItems.some((item) => item.id === product.retailerProductId)) throw new Error("This product was already in your cart; Pantry Rescue did not change it.");
        if (!await inspectProduct(page, selection)) throw new Error("The product changed since approval; search again.");
        events.push(progress("CART", `Adding ${ingredient.ingredient} to cart`, "ACTIVE", `Approved ${selection.quantity} × ${product.packageQuantity} ${product.packageUnit}`));
        const buttons = page.getByRole("button", { name: /^add to cart$/i }).filter({ visible: true });
        let clickError: unknown;
        try { for (let click = 0; click < selection.quantity; click += 1) { requireRunning(sessionId); if (await buttons.count() !== 1) throw new Error("The product page has no unique Add to cart action."); await buttons.click({ timeout: 8000 }); } }
        catch (error) { clickError = error; }
        events.push(progress("CART", "Verifying cart", "ACTIVE"));
        const after = await readWalmartCart(page);
        const line = after.find((item) => item.id === product.retailerProductId);
        if (!line || line.name.toLowerCase() !== product.name.toLowerCase() || line.size !== `${product.packageQuantity} ${product.packageUnit}` || line.quantity !== selection.quantity || line.unitPrice !== product.price) {
          throw new Error(clickError ? "Cart click was uncertain and exact cart contents could not be verified; no retry was attempted." : "Cart product, package, quantity, or price did not match the approved choice; no retry was attempted.");
        }
        cartItems = after;
        results.push({ ingredient, selection, status: "ADDED", cartActionSucceeded: true, message: "Exact product, package, quantity, and price verified in Walmart cart." });
        events.push(progress("CART", "Verifying cart", "COMPLETE", `${line.name} · ${line.size} × ${line.quantity}`));
      } catch (error) {
        const message = error instanceof Error ? error.message : "The cart action could not be verified.";
        results.push({ ingredient, selection, status: "NEEDS_ATTENTION", message });
        events.push(progress("CART", `${ingredient.ingredient} needs attention`, "WARNING", message));
      }
    }
    const complete = preview.results.length === 0 && results.every((result) => result.status === "ADDED");
    events.push(progress("CART", complete ? "Shopping complete" : "Shopping finished — some items need attention", complete ? "COMPLETE" : "WARNING", "Review the Walmart cart; checkout stays with you."));
    const screenshot = `data:image/png;base64,${(await page.screenshot({ type: "png" })).toString("base64")}`;
    return { results, cartItems, events, screenshot };
  });
}

export async function inspectWalmartCart(config: Config, sessionId: string) {
  return withCloudBrowser(config, sessionId, async (page) => {
    const cartItems = await readWalmartCart(page);
    return { cartItems, screenshot: `data:image/png;base64,${(await page.screenshot({ type: "png" })).toString("base64")}` };
  }, true);
}
