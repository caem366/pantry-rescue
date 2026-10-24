import type { Page } from "playwright";

export type DiscoveredDemoProduct = { id: string; name: string; size: string; price: number; available: boolean; sourceUrl: string };

/** Reads only rendered, controlled-store product facts; cart actions live elsewhere. */
export async function discoverDemoMarketProducts(page: Page, query: string): Promise<DiscoveredDemoProduct[]> {
  await page.getByTestId("demo-search").fill(query);
  await page.getByTestId("demo-product").first().waitFor({ state: "visible", timeout: 10_000 });
  return await page.getByTestId("demo-product").evaluateAll((cards) => cards.map((card) => ({
    id: card.getAttribute("data-product-id") ?? "",
    name: card.getAttribute("data-product-name") ?? "",
    size: card.getAttribute("data-product-size") ?? "",
    price: Number(card.getAttribute("data-product-price")),
    available: card.getAttribute("data-product-available") === "true",
    sourceUrl: (card.querySelector("a") as HTMLAnchorElement | null)?.href ?? "",
  })).filter((product) => product.id && product.name && Number.isFinite(product.price) && product.sourceUrl));
}

export async function inspectDemoMarketProduct(page: Page, productId: string): Promise<DiscoveredDemoProduct> {
  await page.getByTestId(`view-product-${productId}`).click();
  const detail = page.getByTestId("demo-product-detail");
  await detail.waitFor({ state: "visible", timeout: 10_000 });
  return await detail.evaluate((card) => ({
    id: card.getAttribute("data-product-id") ?? "",
    name: card.getAttribute("data-product-name") ?? "",
    size: card.getAttribute("data-product-size") ?? "",
    price: Number(card.getAttribute("data-product-price")),
    available: card.getAttribute("data-product-available") === "true",
    sourceUrl: window.location.href,
  }));
}
