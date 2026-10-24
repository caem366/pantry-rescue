import { estimateSelectionCost, selectProduct, type MissingIngredient, type ProductSelection, type RetailerAdapter } from "./shoppingAgent.ts";
import { progress, type ProgressReporter } from "./agentProgress.ts";

export type BasketOption = {
  retailerId: string; retailerName: string; selections: ProductSelection[];
  matchedIngredientCount: number; totalIngredientCount: number; subtotal: number;
  estimatedFees?: number; estimatedTotal: number; complete: boolean; warnings: string[];
  dataSource?: string; availabilityVerified?: boolean;
};

/** Compare whole single-store baskets. Incomplete baskets cannot outrank complete ones. */
export async function compareBaskets(
  retailers: RetailerAdapter[],
  ingredients: MissingIngredient[],
  report?: ProgressReporter,
): Promise<BasketOption[]> {
  const options: BasketOption[] = [];
  for (const retailer of retailers) {
    const selections: ProductSelection[] = [];
    const warnings: string[] = [];
    report?.(progress("DISCOVERY", `Checking ${retailer.name}…`, "ACTIVE"));
    for (const ingredient of ingredients) {
      report?.(progress("DISCOVERY", `Searching ${ingredient.ingredient} at ${retailer.name}…`, "ACTIVE"));
      const candidates = await retailer.searchProducts(ingredient);
      report?.(progress("DISCOVERY", `${ingredient.ingredient} — checked ${retailer.name}`, "COMPLETE", `${candidates.length} relevant product${candidates.length === 1 ? "" : "s"} found`));
      const selection = selectProduct(ingredient, candidates);
      if (selection) {
        selections.push(selection);
        const size = selection.product.packageQuantity && selection.product.packageUnit
          ? `${selection.product.packageQuantity} ${selection.product.packageUnit}` : "package size unavailable";
        const price = selection.product.price === undefined ? "price unavailable" : `$${selection.product.price.toFixed(2)}`;
        report?.(progress("MATCHING", `${ingredient.ingredient} — matched at ${retailer.name}`, "COMPLETE", `${size} · ${price}`));
      } else {
        warnings.push(`No confident match for ${ingredient.ingredient}.`);
        report?.(progress("MATCHING", `${ingredient.ingredient} — needs attention at ${retailer.name}`, "WARNING", "No suitable available product was found"));
      }
    }
    const pricedSelections = selections.filter((selection) => selection.product.price !== undefined);
    const subtotal = pricedSelections.reduce((total, selection) => total + estimateSelectionCost(selection.ingredient, selection.product, selection.quantity), 0);
    if (pricedSelections.length !== selections.length) warnings.push("One or more matched products have no observed price.");
    const complete = selections.length === ingredients.length && pricedSelections.length === ingredients.length;
    options.push({ retailerId: retailer.id, retailerName: retailer.name, selections, matchedIngredientCount: selections.length,
      totalIngredientCount: ingredients.length, subtotal, estimatedTotal: subtotal, complete, warnings,
      availabilityVerified: selections.length === ingredients.length && selections.every((selection) => selection.product.availabilityVerified === true) });
    report?.(progress("DISCOVERY", `${retailer.name} checked`, "COMPLETE", `${selections.length}/${ingredients.length} ingredients matched`));
  }
  report?.(progress("OPTIMIZATION", "Comparing complete baskets…", "ACTIVE"));
  const sorted = options.sort((a, b) => Number(b.complete) - Number(a.complete) || a.estimatedTotal - b.estimatedTotal);
  const best = bestCompleteBasket(sorted);
  report?.(progress("OPTIMIZATION", "Basket comparison complete", "COMPLETE", best
    ? `${best.retailerName} is the lowest estimated complete basket checked.`
    : "No complete basket was found among the stores checked."));
  return sorted;
}

export function bestCompleteBasket(options: BasketOption[]) { return options.find((option) => option.complete); }
