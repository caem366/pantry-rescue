import { expect, test } from "@playwright/test";
import { inspectDemoMarketProduct } from "../server/demoMarketDiscovery.ts";

test("controlled Demo Market supports visible search, add, and cart verification", async ({ page }) => {
  await page.goto("/#demo-market");
  await expect(page.getByRole("heading", { name: /demo market/i })).toBeVisible();
  await page.getByRole("textbox", { name: /search demo market/i }).fill("vegetable stock");
  await expect(page.getByText("Vegetable stock", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /add to cart/i }).first().click();
  await expect(page.getByText(/1 product selected/i)).toBeVisible();
  await expect(page.getByText(/vegetable stock.*qty 1/i)).toBeVisible();
});

test("controlled Demo Market exposes a product-detail page with structured facts", async ({ page }) => {
  await page.goto("/#demo-market/product/stock-900");
  const detail = page.getByTestId("demo-product-detail");
  await expect(detail).toContainText("Vegetable stock");
  await expect(detail).toContainText("900 mL");
  await expect(detail).toHaveAttribute("data-product-price", "2.79");
  await expect(detail).toHaveAttribute("data-product-available", "true");
});

test("browser discovery follows a rendered product page before using its facts", async ({ page }) => {
  await page.goto("/#demo-market");
  const product = await inspectDemoMarketProduct(page, "stock-900");
  expect(product).toMatchObject({ id: "stock-900", name: "Vegetable stock", size: "900 mL", price: 2.79, available: true });
  expect(product.sourceUrl).toContain("#demo-market/product/stock-900");
});

test("three different pasta gaps produce independently readable cart receipts", async ({ page }) => {
  await page.goto("/#demo-market");
  for (const [query, id, clicks] of [["parmesan", "parmesan", 1], ["garlic", "garlic", 2], ["vegetable stock", "stock-900", 1]] as const) {
    await page.getByRole("textbox", { name: /search demo market/i }).fill(query);
    const product = page.locator(`[data-testid="demo-product"][data-product-id="${id}"]`);
    await expect(product).toBeVisible();
    for (let count = 0; count < clicks; count += 1) await product.getByRole("button", { name: "Add to cart" }).click();
  }
  const cart = page.getByTestId("demo-cart");
  await expect(cart.getByTestId("cart-item")).toHaveCount(3);
  await expect(cart.locator('[data-product-id="parmesan"]')).toHaveAttribute("data-product-size", "200 g");
  await expect(cart.locator('[data-product-id="garlic"]')).toHaveAttribute("data-quantity", "2");
  await expect(cart.locator('[data-product-id="stock-900"]')).toHaveAttribute("data-unit-price", "2.79");
  await expect(cart).toContainText("$9.16");
  await expect(page.getByRole("button", { name: /checkout|place order/i })).toHaveCount(0);
});
