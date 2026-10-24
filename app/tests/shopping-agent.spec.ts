import { expect, test } from "@playwright/test";
import { addApprovedProduct, DemoRetailerAdapter, findProductSelection, selectProduct, UberEatsSimulationAdapter, type MissingIngredient, type ProductSelection, type RetailerAdapter } from "../src/lib/shoppingAgent";
import { bestCompleteBasket, compareBaskets } from "../src/lib/basketOptimizer";

test("the demo adapter selects and verifies two individual lemons", async () => {
  const lemon: MissingIngredient = { id: "lemon", ingredient: "lemons", requiredQuantity: 2, unit: "each" };
  const adapter = new DemoRetailerAdapter();
  const review = await findProductSelection(adapter, lemon);
  expect(review.selection?.product.name).toBe("Individual lemons");
  const result = await addApprovedProduct(adapter, review.selection!);
  expect(result.status).toBe("ADDED");
  expect(result.selection?.product.name).toBe("Individual lemons");
  expect(result.selection?.quantity).toBe(2);
});

test("the selector picks the smallest sufficient stock package", async () => {
  const stock: MissingIngredient = { id: "stock", ingredient: "vegetable stock", requiredQuantity: 750, unit: "mL" };
  const review = await findProductSelection(new DemoRetailerAdapter(), stock);
  expect(review.selection?.product.packageQuantity).toBe(946);
});

test("the basket optimizer selects the lowest-cost complete store checked", async () => {
  const ingredients: MissingIngredient[] = [
    { id: "lemon", ingredient: "lemons", requiredQuantity: 2, unit: "each" },
    { id: "stock", ingredient: "vegetable stock", requiredQuantity: 750, unit: "mL" },
    { id: "parmesan", ingredient: "parmesan", requiredQuantity: 150, unit: "g" },
  ];
  const options = await compareBaskets([
    new DemoRetailerAdapter("demo-market-a", "Demo Market A"),
    new DemoRetailerAdapter("demo-market-b", "Demo Market B"),
  ], ingredients);
  expect(options).toHaveLength(2);
  expect(bestCompleteBasket(options)?.retailerId).toBe("demo-market-b");
  expect(bestCompleteBasket(options)?.matchedIngredientCount).toBe(3);
  expect(bestCompleteBasket(options)?.estimatedTotal).toBe(9.16);
});

test("comparison emits observable discovery, matching, and completion events", async () => {
  const ingredient: MissingIngredient = { id: "stock", ingredient: "vegetable stock", requiredQuantity: 750, unit: "mL" };
  const events: { stage: string; status: string; label: string }[] = [];
  await compareBaskets([
    new DemoRetailerAdapter("demo-market-a", "Demo Market A"),
    new DemoRetailerAdapter("demo-market-b", "Demo Market B"),
  ], [ingredient], (event) => events.push(event));
  expect(events.some((event) => event.stage === "DISCOVERY" && event.status === "COMPLETE")).toBeTruthy();
  expect(events.some((event) => event.stage === "MATCHING" && event.status === "COMPLETE" && event.label.includes("vegetable stock"))).toBeTruthy();
  expect(events.at(-1)).toMatchObject({ stage: "OPTIMIZATION", status: "COMPLETE" });
});

test("product search does not write a cart before exact selection approval", async () => {
  const lemon: MissingIngredient = { id: "lemon", ingredient: "lemons", requiredQuantity: 2, unit: "each" };
  let writes = 0;
  const base = new DemoRetailerAdapter();
  const adapter: RetailerAdapter = {
    id: base.id,
    name: base.name,
    capabilities: base.capabilities,
    searchProducts: (ingredient) => base.searchProducts(ingredient),
    addToCart: async (selection: ProductSelection) => {
      writes += 1;
      return await base.addToCart(selection);
    },
    verifyCartItem: (selection) => base.verifyCartItem(selection),
  };
  const review = await findProductSelection(adapter, lemon);
  expect(review.selection).toBeDefined();
  expect(writes).toBe(0);
  await addApprovedProduct(adapter, review.selection!);
  expect(writes).toBe(1);
});

test("cart progress only completes after the verified approved-cart action", async () => {
  const lemon: MissingIngredient = { id: "lemon", ingredient: "lemons", requiredQuantity: 2, unit: "each" };
  const adapter = new DemoRetailerAdapter();
  const events: { stage: string; status: string; label: string }[] = [];
  const review = await findProductSelection(adapter, lemon);
  const result = await addApprovedProduct(adapter, review.selection!, (event) => events.push(event));
  expect(result.status).toBe("ADDED");
  expect(events.at(-1)).toMatchObject({ stage: "CART", status: "COMPLETE" });
  expect(events.at(-1)?.label).toContain("added");
});

test("Uber Eats simulation searches its separate simulated catalog", async () => {
  const stock: MissingIngredient = { id: "stock", ingredient: "vegetable stock", requiredQuantity: 750, unit: "mL" };
  const adapter = new UberEatsSimulationAdapter();
  const review = await findProductSelection(adapter, stock);
  expect(review.selection?.product).toMatchObject({
    retailerId: "uber-eats-simulated",
    name: "Vegetable stock broth carton (SIMULATED)",
  });
});

test("Canadian French retailer listings match the intended branded grocery products", () => {
  const ingredient: MissingIngredient = { id: "iced", ingredient: "International Delight iced coffee", requiredQuantity: 1.89, unit: "L", brandPreference: "International Delight" };
  const selection = selectProduct(ingredient, [{
    retailerId: "walmart-ca", retailerProductId: "coffee", name: "Café glacé à la vanille", brand: "International Delight", packageQuantity: 1.89, packageUnit: "L", price: 6.98, currency: "CAD", available: true, retrievedAt: "2026-10-22T07:00:33+00:00",
  }]);
  expect(selection).toMatchObject({ quantity: 1, product: { retailerId: "walmart-ca", name: "Café glacé à la vanille" } });
});

test("one unspecified sale unit can select one observed weighed produce package", () => {
  const selection = selectProduct({ id: "gai-lan", ingredient: "Chinese broccoli", requiredQuantity: 1, unit: "each" }, [{
    retailerId: "walmart-ca", retailerProductId: "gai-lan", name: "Gaï lan", packageQuantity: 340, packageUnit: "g", price: 6.55, currency: "CAD", available: true, retrievedAt: "2026-10-22T07:00:33+00:00",
  }]);
  expect(selection).toMatchObject({ quantity: 1, product: { name: "Gaï lan" } });
});
