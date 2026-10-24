import {
  addApprovedProduct,
  findProductSelection,
  selectProduct,
  type MissingIngredient,
  type ProductSelection,
  type ShoppingResult,
} from "../src/lib/shoppingAgent.ts";
import { progress, type AgentProgressEvent } from "../src/lib/agentProgress.ts";
import { KrogerAdapter } from "./krogerAdapter.ts";

export type KrogerPreview = {
  retailer: "kroger";
  selections: ProductSelection[];
  results: ShoppingResult[];
  events: AgentProgressEvent[];
};
export type KrogerShoppingRun = {
  retailer: "kroger";
  cartUrl: string;
  results: ShoppingResult[];
  events: AgentProgressEvent[];
};

export async function previewKrogerShopping(
  ingredients: MissingIngredient[],
  config: { accessToken: string; locationId: string },
): Promise<KrogerPreview> {
  const adapter = new KrogerAdapter(config);
  const selections: ProductSelection[] = [];
  const results: ShoppingResult[] = [];
  const events: AgentProgressEvent[] = [];
  const report = (event: AgentProgressEvent) => events.push(event);
  for (const ingredient of ingredients) {
    const result = await findProductSelection(adapter, ingredient, report);
    if (result.selection) selections.push(result.selection);
    else results.push({ ingredient, status: "NEEDS_ATTENTION", message: result.message ?? "No confident product match was found." });
  }
  report(progress("CART", "Kroger product review is ready", "COMPLETE", "No cart changes have been made. Review and approve each exact product first."));
  return { retailer: "kroger", selections, results, events };
}

export async function runKrogerShopping(
  selections: ProductSelection[],
  config: { accessToken: string; locationId: string },
): Promise<KrogerShoppingRun> {
  const adapter = new KrogerAdapter(config);
  const results: ShoppingResult[] = [];
  const events: AgentProgressEvent[] = [];
  const report = (event: AgentProgressEvent) => events.push(event);
  for (const selection of selections) results.push(await addApprovedProduct(adapter, selection, report));
  report(progress("CART", "Kroger cart writes complete", "COMPLETE", "Review each unverified item in the real Kroger cart before marking it added."));
  return { retailer: "kroger", cartUrl: await adapter.getCartUrl() ?? "https://www.kroger.com/", results, events };
}

export async function refreshKrogerSelections(
  selections: ProductSelection[],
  config: { accessToken: string; locationId: string },
): Promise<{ selections: ProductSelection[]; unchanged: boolean }> {
  const adapter = new KrogerAdapter(config);
  const refreshed: ProductSelection[] = [];
  for (const selection of selections) {
    const candidates = await adapter.searchProducts(selection.ingredient);
    const current = selectProduct(selection.ingredient, candidates);
    if (!current) return { selections: refreshed, unchanged: false };
    refreshed.push(current);
  }
  const unchanged = selections.every((selection, index) => {
    const current = refreshed[index];
    return current !== undefined
      && current.ingredient.id === selection.ingredient.id
      && current.quantity === selection.quantity
      && current.product.retailerId === selection.product.retailerId
      && current.product.retailerProductId === selection.product.retailerProductId
      && current.product.name === selection.product.name
      && current.product.brand === selection.product.brand
      && current.product.packageQuantity === selection.product.packageQuantity
      && current.product.packageUnit === selection.product.packageUnit
      && current.product.price === selection.product.price
      && current.product.currency === selection.product.currency
      && current.product.available === selection.product.available;
  });
  return { selections: refreshed, unchanged };
}
