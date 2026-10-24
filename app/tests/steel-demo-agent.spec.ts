import { expect, test } from "@playwright/test";
import { reconcileCartItem } from "../server/steelDemoAgent";
import type { ProductSelection } from "../src/lib/shoppingAgent";

const selection: ProductSelection = {
  ingredient: { id: "stock", ingredient: "vegetable stock", requiredQuantity: 750, unit: "mL" },
  product: { retailerId: "steel-demo-market", retailerProductId: "stock-900", name: "Vegetable stock", packageQuantity: 900, packageUnit: "mL", price: 2.79, currency: "CAD", available: true, retrievedAt: "2026-10-21T00:00:00.000Z" },
  quantity: 1,
  reason: "Smallest suitable package.",
};
const cartItem = { id: "stock-900", name: "Vegetable stock", size: "900 mL", unitPrice: 2.79, quantity: 1 };

test("cloud cart reconciliation verifies an uncertain action without repeating it", () => {
  expect(reconcileCartItem([], [cartItem], selection)).toMatchObject({ status: "ADDED" });
  expect(reconcileCartItem([], [{ ...cartItem, quantity: 2 }], selection)).toMatchObject({ status: "NEEDS_ATTENTION" });
});

test("cloud cart reconciliation refuses to stack onto an existing user cart item", () => {
  expect(reconcileCartItem([cartItem], [cartItem], selection)).toMatchObject({ status: "NEEDS_ATTENTION" });
});

test("an uncertain click or a manual quantity change never becomes added", () => {
  expect(reconcileCartItem([], [], selection)).toMatchObject({ status: "NEEDS_ATTENTION" });
  expect(reconcileCartItem([], [{ ...cartItem, quantity: 2 }], selection)).toMatchObject({ status: "NEEDS_ATTENTION" });
  expect(reconcileCartItem([], [{ ...cartItem, size: "1.8 L" }], selection)).toMatchObject({ status: "NEEDS_ATTENTION" });
  expect(reconcileCartItem([], [{ ...cartItem, unitPrice: 4.29 }], selection)).toMatchObject({ status: "NEEDS_ATTENTION" });
});
