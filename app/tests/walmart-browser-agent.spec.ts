import { expect, test } from "@playwright/test";
import { parseWalmartPrice, parseWalmartSize, readWalmartCart, searchWalmartProducts, walmartCandidate } from "../server/walmartBrowserAgent";

test("Walmart candidate extraction requires a real product URL, package size, and price", () => {
  const candidate = walmartCandidate({
    name: "Vegetable Stock 900 mL",
    href: "https://www.walmart.ca/en/ip/vegetable-stock/6000123456789",
    text: "Vegetable Stock 900 mL $2.79 Add",
  });
  expect(candidate).toMatchObject({ retailerId: "walmart-ca", retailerProductId: "6000123456789", packageQuantity: 900, packageUnit: "mL", price: 2.79, availabilityVerified: false });
  expect(walmartCandidate({ name: "Vegetable Stock", href: "https://other.example/en/ip/stock/123", text: "$2.79" })).toBeUndefined();
  expect(walmartCandidate({ name: "Vegetable Stock", href: "https://www.walmart.ca/en/ip/stock/123", text: "$2.79" })).toBeUndefined();
  expect(walmartCandidate({ name: "Vegetable Stock 900 mL", href: "https://www.walmart.ca/en/ip/stock/123", text: "Price unavailable" })).toBeUndefined();
});

test("Walmart sizes and prices are not guessed from incomplete text", () => {
  expect(parseWalmartSize("Oyster Sauce 510 g")).toEqual({ quantity: 510, unit: "g" });
  expect(parseWalmartSize("Lemons 2 ct")).toEqual({ quantity: 2, unit: "each" });
  expect(parseWalmartSize("Oyster Sauce, assorted sizes")).toBeUndefined();
  expect(parseWalmartPrice("Now $3.49")).toBe(3.49);
  expect(parseWalmartPrice("See price in cart")).toBeUndefined();
});

test("rendered Walmart-like search cards become real candidates without claiming local stock", async ({ page }) => {
  await page.route("https://www.walmart.ca/", (route) => route.fulfill({ contentType: "text/html", body: `<form action="/en/search"><input type="search" name="q" aria-label="Search Walmart"></form>` }));
  await page.route("https://www.walmart.ca/en/search**", (route) => route.fulfill({ contentType: "text/html", body: `<article data-testid="product"><a href="/en/ip/vegetable-stock/6000123456789"><img alt="Vegetable Stock 900 mL"></a><span>$2.79</span></article>` }));
  const products = await searchWalmartProducts(page, { id: "stock", ingredient: "vegetable stock", requiredQuantity: 750, unit: "mL" });
  expect(products).toHaveLength(1);
  expect(products[0]).toMatchObject({ name: "Vegetable Stock 900 mL", price: 2.79, availabilityVerified: false });
});

test("a Walmart identity check stops search without interacting with the challenge", async ({ page }) => {
  await page.route("https://www.walmart.ca/", (route) => route.fulfill({ contentType: "text/html", body: `<h1>We like real shoppers, not robots!</h1><p>Please press and hold the button below to verify yourself.</p><button>PRESS & HOLD</button>` }));
  await expect(searchWalmartProducts(page, { id: "stock", ingredient: "vegetable stock", requiredQuantity: 750, unit: "mL" })).rejects.toThrow(/identity check/i);
  await expect(page.getByRole("button", { name: /press & hold/i })).toBeVisible();
});

test("cart extraction fails closed when a retailer product line lacks verifiable quantity", async ({ page }) => {
  await page.route("https://www.walmart.ca/en/cart", (route) => route.fulfill({ contentType: "text/html", body: `<h1>Cart</h1><article><a href="/en/ip/vegetable-stock/6000123456789">Vegetable Stock 900 mL</a><span>$2.79</span></article>` }));
  await expect(readWalmartCart(page)).rejects.toThrow(/cannot read/i);
});

test("rendered cart receipts include product identity, package, price, and quantity", async ({ page }) => {
  await page.route("https://www.walmart.ca/en/cart", (route) => route.fulfill({ contentType: "text/html", body: `<h1>Cart</h1><article><a href="/en/ip/vegetable-stock/6000123456789">Vegetable Stock 900 mL</a><span>$2.79</span><input type="number" aria-label="Quantity" value="2"></article>` }));
  await expect(readWalmartCart(page)).resolves.toEqual([{ id: "6000123456789", name: "Vegetable Stock 900 mL", size: "900 mL", unitPrice: 2.79, quantity: 2 }]);
});
