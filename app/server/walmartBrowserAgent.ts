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
    await page.goto(walmartOrigin, { waitUntil: "commit", timeout: 30_000 });
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
  const pack = value.match(/\bpack of (\d+)\b/i);
  if (pack && Number(pack[1]) > 0) return { quantity: Number(pack[1]), unit: "each" };
  const match = value.match(/(?:^|\s|,|\()([\d.]+)\s*(kg|g|ml|l|ct|count|pack)\b/i);
  if (!match || !Number.isFinite(Number(match[1])) || Number(match[1]) <= 0) return undefined;
  const unit = match[2].toLowerCase();
  return { quantity: Number(match[1]), unit: unit === "ml" ? "mL" : unit === "l" ? "L" : ["ct", "count", "pack"].includes(unit) ? "each" : unit as Unit };
}

export function parseWalmartPrice(value: string): number | undefined {
  const match = value.match(/(?:CAD\s*)?\$\s*(\d{1,4})(?:[.,\s](\d{2}))?(?!\d)/i);
  return match ? Number(`${match[1]}.${match[2] ?? "00"}`) : undefined;
}

export function walmartCandidate(raw: { name: string; href: string; text: string }, observedAt = new Date().toISOString()): ProductCandidate | undefined {
  const sourceUrl = productUrl(raw.href);
  const name = raw.name.replace(/^Image:\s*/i, "").trim();
  const size = parseWalmartSize(name);
  const currentPrice = raw.text.match(/(?:current price(?:\s+now)?|now)\s*(?:is\s*)?(?:CAD\s*)?\$\s*\d{1,4}(?:[.,\s]\d{2})?/i)?.[0];
  const price = parseWalmartPrice(currentPrice ?? raw.text);
  if (!sourceUrl || !name || price === undefined) return undefined;
  return { retailerId: "walmart-ca", retailerProductId: new URL(sourceUrl).pathname.split("/").at(-1)!, name, packageQuantity: size?.quantity, packageUnit: size?.unit, price, currency: "CAD", available: !/out of stock|sold out|unavailable/i.test(raw.text), availabilityVerified: false, sourceUrl, retrievedAt: observedAt };
}

async function assertWalmart(page: Page) {
  const url = new URL(page.url());
  if (url.origin !== walmartOrigin) throw new Error(`Walmart navigation left the supported website (${url.origin}).`);
  const body = (await page.locator("body").innerText().catch(() => "")).slice(0, 1200);
  if (/access denied|captcha|verify you are human|unusual traffic|real shoppers, not robots|press and hold/i.test(body)) throw new Error("Walmart presented an identity check. Pantry Rescue stopped without attempting to bypass it or change the cart.");
}

export async function searchWalmartProducts(page: Page, ingredient: MissingIngredient): Promise<ProductCandidate[]> {
  const variants: Record<string, string[]> = {
    garlic: ["fresh garlic", "garlic bulb", "garlic cloves"],
    parmesan: ["parmesan cheese", "grated parmesan"],
    "vegetable stock": [],
  };
  const queries = [ingredient.ingredient, ...(variants[ingredient.ingredient.trim().toLowerCase()] ?? [])];
  for (const query of queries) {
    await page.goto(walmartOrigin, { waitUntil: "commit", timeout: 30_000 });
    await assertWalmart(page);
    const searchBox = page.locator('input[type="search"], input[placeholder*="Search" i], input[aria-label*="Search" i]').filter({ visible: true }).first();
    try { await searchBox.waitFor({ state: "visible", timeout: 10_000 }); }
    catch {
      await assertWalmart(page);
      throw new Error(`Walmart's search field was not available at ${page.url()}; no product or cart action was attempted.`);
    }
    await searchBox.fill(query);
    await searchBox.press("Enter");
    try {
      await page.waitForURL((url) => /\/search\b/.test(url.pathname), { timeout: 10_000 });
      await page.waitForFunction(() => /there were no search results for/i.test(document.body.innerText)
        || [...document.querySelectorAll('a[href*="/en/ip/"]')].some((link) => Boolean((link as HTMLElement).getClientRects().length)), null, { timeout: 15_000 });
    } catch {
      await assertWalmart(page);
      throw new Error(`Walmart search did not reach readable results for “${query}” at ${page.url()}.`);
    }
    await assertWalmart(page);
    if (/there were no search results for/i.test(await page.locator("body").innerText())) continue;
    const raw = await page.locator('a[href*="/en/ip/"]').evaluateAll((links) => links.map((link) => {
      let card: Element | null = link.closest('article, li, [data-testid*="product" i], [data-automation-id*="product" i]');
      if (!card) {
        card = link.parentElement;
        for (let depth = 0; depth < 4 && card && !/\$\s*\d/.test(card.textContent ?? ""); depth += 1) card = card.parentElement;
      }
      return { name: link.querySelector("img")?.getAttribute("alt") || link.textContent?.trim() || link.getAttribute("aria-label") || "", href: (link as HTMLAnchorElement).href, text: card?.textContent?.replace(/\s+/g, " ").trim() ?? "" };
    }));
    const unique = new Map<string, ProductCandidate>();
    for (const row of raw) { const candidate = walmartCandidate(row); if (candidate) unique.set(candidate.retailerProductId, { ...candidate, searchQuery: query }); }
    return [...unique.values()];
  }
  throw new Error(`Walmart showed no search results for ${ingredient.ingredient} after: ${queries.join(", ")}.`);
}

export async function inspectWalmartProduct(page: Page, candidate: ProductCandidate): Promise<ProductCandidate | undefined> {
  if (!candidate.sourceUrl || !productUrl(candidate.sourceUrl)) return undefined;
  await page.goto(candidate.sourceUrl, { waitUntil: "commit", timeout: 30_000 });
  await assertWalmart(page);
  const actualUrl = productUrl(page.url());
  if (!actualUrl || new URL(actualUrl).pathname.split("/").at(-1) !== candidate.retailerProductId) return undefined;
  const heading = await page.getByRole("heading", { level: 1 }).first().textContent({ timeout: 10_000 }).catch(() => "");
  const text = (await page.locator("body").innerText()).slice(0, 8000);
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/(\d)\s+(g|kg|ml|l)\b/g, "$1$2").trim();
  const currentPrice = text.match(/current price (?:is\s*)?(?:CAD\s*)?\$\s*\d{1,4}(?:[.,\s]\d{2})?/i)?.[0];
  const sizeText = text.match(/\bSize\s*\n\s*([\d.]+\s*(?:kg|g|ml|l|ct|count|pack))\b/i)?.[1];
  const detailSize = parseWalmartSize(heading ?? "") ?? (sizeText ? parseWalmartSize(sizeText) : undefined);
  const cardSize = candidate.packageQuantity && candidate.packageUnit ? `${candidate.packageQuantity} ${candidate.packageUnit}` : undefined;
  if (!heading || normalize(heading) !== normalize(candidate.name)
    || !currentPrice || parseWalmartPrice(currentPrice) !== candidate.price
    || /sorry, this item is out of stock|currently out of stock/i.test(text)
    || (detailSize && cardSize && `${detailSize.quantity} ${detailSize.unit}` !== cardSize)) return undefined;
  const size = detailSize ?? (cardSize ? { quantity: candidate.packageQuantity!, unit: candidate.packageUnit! } : undefined);
  return { ...candidate, packageQuantity: size?.quantity, packageUnit: size?.unit };
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
  const body = await page.locator("body").innerText();
  const emptyCart = /your cart is empty|cart is empty|no items in your cart/i.test(body)
    || (/\bcart\s*\(\s*0\s*items?\s*\)/i.test(body) && /time to start shopping/i.test(body));
  if (!lines.length && !emptyCart) {
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

export async function addVerifiedWalmartProduct(page: Page, selection: ProductSelection, before: CartLine[], beforeClick: () => void = () => {}): Promise<CartLine[]> {
  const { product } = selection;
  if (before.some((item) => item.id === product.retailerProductId)) throw new Error("This product was already in your cart; Pantry Rescue did not change it.");
  if (!await inspectWalmartProduct(page, product)) throw new Error("The product changed since approval; search again.");
  const buttons = page.getByRole("button", { name: /^add(?: to cart)?$/i }).filter({ visible: true });
  let clickError: unknown;
  try {
    for (let click = 0; click < selection.quantity; click += 1) {
      beforeClick();
      if (await buttons.count() !== 1) throw new Error("The product page has no unique Add to cart action.");
      await buttons.click({ timeout: 8000 });
    }
  } catch (error) { clickError = error; }
  let after: CartLine[];
  try { after = await readWalmartCart(page); }
  catch (error) { throw new Error(`Cart state could not be verified after the add attempt; no retry was attempted. ${error instanceof Error ? error.message : ""}`); }
  const line = after.find((item) => item.id === product.retailerProductId);
  if (!line || line.name.toLowerCase() !== product.name.toLowerCase() || line.size !== `${product.packageQuantity} ${product.packageUnit}` || line.quantity !== selection.quantity || line.unitPrice !== product.price) {
    throw new Error(clickError ? "Cart click was uncertain and exact cart contents could not be verified; no retry was attempted." : "Cart product, package, quantity, or price did not match the approved choice; no retry was attempted.");
  }
  return after;
}

export async function previewWalmartBasket(config: Config, sessionId: string, ingredients: MissingIngredient[], postalCode: string) {
  return withCloudBrowser(config, sessionId, async (page, events) => {
    const selections: ProductSelection[] = []; const results: ShoppingResult[] = [];
    const candidateProducts = new Map<string, ProductCandidate[]>();
    for (const [index, ingredient] of ingredients.entries()) {
      requireRunning(sessionId);
      if (index > 0) events.push(progress("DISCOVERY", `Moving to ${ingredient.ingredient}`, "ACTIVE"));
      events.push(progress("DISCOVERY", `Searching for ${ingredient.ingredient}`, "ACTIVE"));
      try {
        const products = await searchWalmartProducts(page, ingredient);
        candidateProducts.set(ingredient.id, products);
        let selection = selectProduct(ingredient, products);
        if (!selection) {
          const words = ingredient.ingredient.toLowerCase().split(/\s+/);
          for (const candidate of products.filter((item) => words.every((word) => item.name.toLowerCase().includes(word))).slice(0, 6)) {
            const checked = await inspectWalmartProduct(page, candidate);
            if (checked) candidateProducts.set(ingredient.id, [...(candidateProducts.get(ingredient.id) ?? []).filter((item) => item.retailerProductId !== checked.retailerProductId), checked]);
          }
          selection = selectProduct(ingredient, candidateProducts.get(ingredient.id) ?? []);
        }
        if (!selection) throw new Error("No Walmart result had a verified ingredient match, current price, and measurable package size.");
        const inspected = await inspectWalmartProduct(page, selection.product);
        if (!inspected) throw new Error("The selected Walmart product page did not confirm its name, package, and current price.");
        selection = selectProduct(ingredient, [inspected]);
        if (!selection) throw new Error("The inspected product does not cover the approved ingredient quantity.");
        if (selection.product.searchQuery) selection = { ...selection, reason: `Found with “${selection.product.searchQuery}”. ${selection.reason}` };
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
    const candidates = [...candidateProducts].map(([ingredientId, products]) => ({ ingredientId, products: products.map((item) => ({ id: item.retailerProductId, name: item.name, size: item.packageQuantity && item.packageUnit ? `${item.packageQuantity} ${item.packageUnit}` : "Size not shown", price: item.price!, available: item.available })) }));
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
        events.push(progress("CART", `Adding ${ingredient.ingredient} to cart`, "ACTIVE", `Approved ${selection.quantity} × ${product.packageQuantity} ${product.packageUnit}`));
        cartItems = await addVerifiedWalmartProduct(page, selection, cartItems, () => requireRunning(sessionId));
        const line = cartItems.find((item) => item.id === product.retailerProductId)!;
        results.push({ ingredient, selection, status: "ADDED", cartActionSucceeded: true, message: "Exact product, package, quantity, and price verified in Walmart cart." });
        events.push(progress("CART", "Verifying cart", "COMPLETE", `${line.name} · ${line.size} × ${line.quantity}`));
      } catch (error) {
        const message = error instanceof Error ? error.message : "The cart action could not be verified.";
        results.push({ ingredient, selection, status: "NEEDS_ATTENTION", message });
        events.push(progress("CART", `${ingredient.ingredient} needs attention`, "WARNING", message));
        const identityCheck = /identity check|press and hold|captcha|verify you are human|real shoppers, not robots/i.test(message);
        if (identityCheck || /cart state could not be verified|cart click was uncertain|cart product, package, quantity, or price did not match/i.test(message)) {
          pauseCloudDemoSession(sessionId, true);
          for (const remaining of selections.slice(index + 1)) results.push({ ingredient: remaining.ingredient, selection: remaining, status: "NEEDS_ATTENTION", message: identityCheck ? "Shopping paused for Walmart identity verification; this item was not added." : "Shopping paused because the Walmart cart could not be safely verified; this item was not added." });
          break;
        }
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
