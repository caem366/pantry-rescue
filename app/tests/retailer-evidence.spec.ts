import { expect, test } from "@playwright/test";
import { bestCompleteBasket, compareBaskets } from "../src/lib/basketOptimizer";
import { ImportedEvidenceAdapter, parseRetailerEvidence } from "../src/lib/retailerEvidence";
import type { MissingIngredient } from "../src/lib/shoppingAgent";

const evidence = JSON.stringify({
  retailerName: "Walmart Canada", location: "M5V 1A1 · delivery", retrievedAt: "2026-10-21T14:30:00.000Z",
  products: [
    { ingredient: "parmesan", name: "Parmesan wedge", packageQuantity: 200, packageUnit: "g", price: 4.49, available: true, sourceUrl: "https://www.walmart.ca/product/parmesan" },
    { ingredient: "vegetable stock", name: "Vegetable stock", packageQuantity: 900, packageUnit: "mL", price: 2.49, available: true, sourceUrl: "https://www.walmart.ca/product/stock" },
  ],
});

test("provided retailer evidence participates in basket comparison but cannot write a cart", async () => {
  const adapter = new ImportedEvidenceAdapter(parseRetailerEvidence(evidence));
  const gaps: MissingIngredient[] = [
    { id: "parmesan", ingredient: "parmesan", requiredQuantity: 150, unit: "g" },
    { id: "stock", ingredient: "vegetable stock", requiredQuantity: 750, unit: "mL" },
  ];
  const option = bestCompleteBasket(await compareBaskets([adapter], gaps));
  expect(option).toMatchObject({ retailerId: "imported-evidence:walmart-canada", complete: true, estimatedTotal: 6.98 });
  expect(adapter.capabilities.cartBuild).toBeFalsy();
  expect(adapter.capabilities.cartVerification).toBeFalsy();
});

test("evidence rejects a product without a verifiable HTTPS source URL", () => {
  expect(() => parseRetailerEvidence(evidence.replace("https://www.walmart.ca/product/stock", "not-a-url"))).toThrow(/HTTPS product URL/);
});
