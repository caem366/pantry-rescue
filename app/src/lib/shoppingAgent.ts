export type Unit = "g" | "kg" | "mL" | "L" | "each";
export type ShoppingStatus = "ADDED" | "NEEDS_ATTENTION" | "SKIPPED";
export type MissingIngredient = {
  id: string;
  ingredient: string;
  requiredQuantity: number;
  unit: Unit;
  dietaryConstraints?: string[];
  searchTerms?: string[];
  brandPreference?: string;
};
export type RetailerCapabilities = { productSearch: boolean; prices: boolean; availability: boolean; cartBuild: boolean; cartVerification: boolean; cartHandoff: boolean };
export type ProductCandidate = {
  retailerId: string; retailerProductId: string; name: string; brand?: string;
  packageQuantity?: number; packageUnit?: Unit; price?: number; currency: "CAD" | "USD";
  packageSizeLabel?: string; priceBasisQuantity?: number; priceBasisUnit?: Unit;
  available: boolean; availabilityVerified?: boolean; imageUrl?: string; sourceUrl?: string; retrievedAt: string;
};
export type ProductSelection = { ingredient: MissingIngredient; product: ProductCandidate; quantity: number; reason: string };
export type CartActionResult = { succeeded: boolean; message?: string };
export type ShoppingResult = { ingredient: MissingIngredient; selection?: ProductSelection; status: ShoppingStatus; message?: string; cartActionSucceeded?: boolean; userConfirmed?: boolean };
export type ProductSearchResult = { ingredient: MissingIngredient; selection?: ProductSelection; message?: string };

export interface RetailerAdapter {
  id: string;
  name: string;
  capabilities: RetailerCapabilities;
  searchProducts(ingredient: MissingIngredient): Promise<ProductCandidate[]>;
  addToCart?(selection: ProductSelection): Promise<CartActionResult>;
  verifyCartItem?(selection: ProductSelection): Promise<boolean>;
  getCartUrl?(): Promise<string | undefined>;
}

export type TaskStatus = "queued" | "searching" | "evaluating" | "added" | "needs_attention" | "skipped";
export type ShoppingTask = MissingIngredient & { status: TaskStatus; selectedProduct?: ProductCandidate; selectedQuantity?: number; reason?: string; cartVerified: boolean };

const observedAt = "2026-09-30T00:00:00.000Z";
const catalogs: Record<string, Record<string, ProductCandidate[]>> = {
  "uber-eats-simulated": {
    parmesan: [{ retailerId: "uber-eats-simulated", retailerProductId: "uber-parmesan", name: "Parmesan cheese wedge (SIMULATED)", packageQuantity: 200, packageUnit: "g", price: 6.19, currency: "CAD", available: true, retrievedAt: observedAt }],
    "vegetable stock": [{ retailerId: "uber-eats-simulated", retailerProductId: "uber-stock", name: "Vegetable stock broth carton (SIMULATED)", packageQuantity: 946, packageUnit: "mL", price: 3.79, currency: "CAD", available: true, retrievedAt: observedAt }],
    lemons: [{ retailerId: "uber-eats-simulated", retailerProductId: "uber-lemons", name: "Fresh lemons (SIMULATED)", packageQuantity: 1, packageUnit: "each", price: 0.99, currency: "CAD", available: true, retrievedAt: observedAt }],
    avocados: [{ retailerId: "uber-eats-simulated", retailerProductId: "uber-avocados", name: "Ripe avocados (SIMULATED)", packageQuantity: 1, packageUnit: "each", price: 1.49, currency: "CAD", available: true, retrievedAt: observedAt }],
  },
  "demo-market-a": {
    parmesan: [{ retailerId: "demo-market-a", retailerProductId: "a-parmesan", name: "Parmesan wedge", packageQuantity: 200, packageUnit: "g", price: 5.49, currency: "CAD", available: true, retrievedAt: observedAt }],
    garlic: [{ retailerId: "demo-market-a", retailerProductId: "a-garlic", name: "Garlic bulbs", packageQuantity: 1, packageUnit: "each", price: 0.79, currency: "CAD", available: true, retrievedAt: observedAt }],
    "vegetable stock": [{ retailerId: "demo-market-a", retailerProductId: "a-stock-473", name: "Vegetable stock", packageQuantity: 473, packageUnit: "mL", price: 2.49, currency: "CAD", available: true, retrievedAt: observedAt }, { retailerId: "demo-market-a", retailerProductId: "a-stock-946", name: "Vegetable stock", packageQuantity: 946, packageUnit: "mL", price: 3.29, currency: "CAD", available: true, retrievedAt: observedAt }],
    lemons: [{ retailerId: "demo-market-a", retailerProductId: "a-lemon", name: "Individual lemons", packageQuantity: 1, packageUnit: "each", price: 0.89, currency: "CAD", available: true, retrievedAt: observedAt }],
    avocados: [{ retailerId: "demo-market-a", retailerProductId: "a-avocado", name: "Ripe avocados", packageQuantity: 1, packageUnit: "each", price: 1.29, currency: "CAD", available: true, retrievedAt: observedAt }],
  },
  "demo-market-b": {
    parmesan: [{ retailerId: "demo-market-b", retailerProductId: "b-parmesan", name: "Parmesan wedge", packageQuantity: 200, packageUnit: "g", price: 4.99, currency: "CAD", available: true, retrievedAt: observedAt }],
    garlic: [{ retailerId: "demo-market-b", retailerProductId: "b-garlic", name: "Garlic bulbs", packageQuantity: 1, packageUnit: "each", price: 0.69, currency: "CAD", available: true, retrievedAt: observedAt }],
    "vegetable stock": [{ retailerId: "demo-market-b", retailerProductId: "b-stock-900", name: "Vegetable stock", packageQuantity: 900, packageUnit: "mL", price: 2.79, currency: "CAD", available: true, retrievedAt: observedAt }, { retailerId: "demo-market-b", retailerProductId: "b-stock-1800", name: "Vegetable stock", packageQuantity: 1800, packageUnit: "mL", price: 4.29, currency: "CAD", available: false, retrievedAt: observedAt }],
    lemons: [{ retailerId: "demo-market-b", retailerProductId: "b-lemon", name: "Individual lemons", packageQuantity: 1, packageUnit: "each", price: 0.69, currency: "CAD", available: true, retrievedAt: observedAt }],
    avocados: [{ retailerId: "demo-market-b", retailerProductId: "b-avocado", name: "Ripe avocados", packageQuantity: 1, packageUnit: "each", price: 1.09, currency: "CAD", available: true, retrievedAt: observedAt }],
  },
};

function canonical(quantity: number, unit: Unit) {
  if (unit === "L") return { quantity: quantity * 1000, unit: "mL" as const };
  if (unit === "kg") return { quantity: quantity * 1000, unit: "g" as const };
  return { quantity, unit };
}

function matchesIngredient(ingredient: MissingIngredient, candidate: ProductCandidate) {
  const normalizeSearch = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const searchable = normalizeSearch(`${candidate.name} ${candidate.brand ?? ""}`);
  const target = normalizeSearch(ingredient.ingredient);
  if (target.includes("iced coffee")) return searchable.includes("international delight") && (searchable.includes("iced coffee") || searchable.includes("cafe glace"));
  if (target.includes("oyster sauce")) return searchable.includes("oyster sauce") || searchable.includes("sauce huitre");
  if (target.includes("chinese broccoli") || target === "gai lan") return searchable.includes("chinese broccoli") || searchable.includes("brocoli chinois") || searchable.includes("gai lan");
  if (target.includes("nerds") && target.includes("gummy") && target.includes("cluster")) return ["nerds", "gummy", "cluster"].every((word) => searchable.includes(word));
  return [ingredient.ingredient, ...(ingredient.searchTerms ?? [])]
    .map(normalizeSearch)
    .filter(Boolean)
    .some((phrase) => phrase.split(/\s+/).every((word) => searchable.includes(word) || (word.endsWith("s") && searchable.includes(word.slice(0, -1)))));
}

/** Deterministically choose a relevant, available product with minimum overbuying. */
export function selectProduct(ingredient: MissingIngredient, candidates: ProductCandidate[]): ProductSelection | undefined {
  const required = canonical(ingredient.requiredQuantity, ingredient.unit);
  const matches = candidates.flatMap((candidate) => {
    const candidateSize = candidate.packageQuantity === undefined || !candidate.packageUnit ? undefined : canonical(candidate.packageQuantity, candidate.packageUnit);
    const priceBasis = candidate.priceBasisQuantity === undefined || !candidate.priceBasisUnit
      ? undefined
      : canonical(candidate.priceBasisQuantity, candidate.priceBasisUnit);
    if (!candidate.available || !matchesIngredient(ingredient, candidate)) return [];
    if ((ingredient.dietaryConstraints?.length ?? 0) > 0) return [];

    if (candidateSize?.unit === required.unit && candidateSize.quantity > 0) {
      const quantity = Math.max(1, Math.ceil(required.quantity / candidateSize.quantity));
      return quantity > 50 ? [] : [{ candidate, quantity, overage: candidateSize.quantity * quantity - required.quantity }];
    }
    if (required.unit === "each" && required.quantity === 1 && candidateSize?.quantity) {
      return [{ candidate, quantity: 1, overage: 0 }];
    }
    if (candidate.packageQuantity === undefined && priceBasis?.unit === required.unit && priceBasis.quantity > 0) {
      return [{ candidate, quantity: 1, overage: 0 }];
    }
    return [];
  }).sort((a, b) => a.overage - b.overage
    || estimateSelectionCost(ingredient, a.candidate, a.quantity) - estimateSelectionCost(ingredient, b.candidate, b.quantity)
    || Number(Boolean(b.candidate.brand && ingredient.brandPreference && b.candidate.brand.toLowerCase().includes(ingredient.brandPreference.toLowerCase())))
      - Number(Boolean(a.candidate.brand && ingredient.brandPreference && a.candidate.brand.toLowerCase().includes(ingredient.brandPreference.toLowerCase())))
    || a.candidate.name.localeCompare(b.candidate.name));
  // Prefer one package that satisfies the requirement; use multiple only when no practical single package exists.
  const match = matches.filter((entry) => entry.quantity === 1)[0] ?? matches[0];
  if (!match) return undefined;
  const reason = ingredient.dietaryConstraints?.length
    ? "This retailer response cannot verify the requested dietary attributes; review the product manually."
    : match.candidate.packageQuantity === undefined
      ? `Estimated by weight using the observed ${match.candidate.packageSizeLabel ?? "unit price"}; final weighed amount and checkout price may differ.`
      : `Selected ${match.quantity} package${match.quantity === 1 ? "" : "s"} to meet the approved quantity with minimal overbuying.`;
  return { ingredient, product: match.candidate, quantity: match.quantity, reason };
}

export function estimateSelectionCost(ingredient: MissingIngredient, candidate: ProductCandidate, quantity: number) {
  if (candidate.price === undefined) return Infinity;
  if (candidate.packageQuantity === undefined && candidate.priceBasisQuantity && candidate.priceBasisUnit) {
    const required = canonical(ingredient.requiredQuantity, ingredient.unit);
    const basis = canonical(candidate.priceBasisQuantity, candidate.priceBasisUnit);
    if (required.unit !== basis.unit || basis.quantity <= 0) return Infinity;
    return candidate.price * required.quantity / basis.quantity;
  }
  return candidate.price * quantity;
}

export async function findProductSelection(adapter: RetailerAdapter, ingredient: MissingIngredient, report?: ProgressReporter): Promise<ProductSearchResult> {
  try {
    report?.(progress("CART", `Searching for ${ingredient.ingredient}…`, "ACTIVE"));
    const candidates = await adapter.searchProducts(ingredient);
    report?.(progress("CART", `${ingredient.ingredient} — products found`, "COMPLETE", `${candidates.length} relevant product${candidates.length === 1 ? "" : "s"} found`));
    report?.(progress("CART", `Choosing ${ingredient.ingredient}…`, "ACTIVE"));
    const selection = selectProduct(ingredient, candidates);
    if (!selection) {
      report?.(progress("CART", `${ingredient.ingredient} needs your attention`, "WARNING", "No confident available product match was found"));
      return { ingredient, message: "No confident available product match was found." };
    }
    return { ingredient, selection };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The retailer could not safely search for this item.";
    report?.(progress("CART", `${ingredient.ingredient} needs your attention`, "FAILED", message));
    return { ingredient, message };
  }
}

export async function addApprovedProduct(adapter: RetailerAdapter, selection: ProductSelection, report?: ProgressReporter): Promise<ShoppingResult> {
  const { ingredient } = selection;
  if (selection.product.retailerId !== adapter.id || !selection.product.available
    || !Number.isInteger(selection.quantity) || selection.quantity < 1 || selection.quantity > 50) {
    return { ingredient, selection, status: "NEEDS_ATTENTION", message: "The approved product selection is no longer valid; review it again before adding." };
  }
  if (!adapter.addToCart) {
    report?.(progress("CART", `${ingredient.ingredient} needs your attention`, "WARNING", `${adapter.name} cannot build a verified cart`));
    return { ingredient, selection, status: "NEEDS_ATTENTION", message: `${adapter.name} cannot build a verified cart.` };
  }
  try {
    report?.(progress("CART", `Adding ${ingredient.ingredient}…`, "ACTIVE", selection.reason));
    const action = await adapter.addToCart(selection);
    if (!action.succeeded) {
      report?.(progress("CART", `${ingredient.ingredient} needs your attention`, "WARNING", action.message ?? "Cart action did not succeed"));
      return { ingredient, selection, status: "NEEDS_ATTENTION", message: action.message ?? "Cart action did not succeed." };
    }
    if (!adapter.verifyCartItem) {
      report?.(progress("CART", `${ingredient.ingredient} needs your attention`, "WARNING", action.message ?? "The cart write succeeded, but cart contents require your review"));
      return { ingredient, selection, status: "NEEDS_ATTENTION", message: action.message ?? "The cart write succeeded, but cart contents require your review.", cartActionSucceeded: true };
    }
    if (!(await adapter.verifyCartItem(selection))) {
      report?.(progress("CART", `${ingredient.ingredient} needs your attention`, "WARNING", "Cart action could not be verified"));
      return { ingredient, selection, status: "NEEDS_ATTENTION", message: "Cart action could not be verified.", cartActionSucceeded: true };
    }
    const size = selection.product.packageQuantity && selection.product.packageUnit ? ` — ${selection.product.packageQuantity} ${selection.product.packageUnit}` : "";
    report?.(progress("CART", `${ingredient.ingredient}${size} added`, "COMPLETE", "Added and verified in cart"));
    return { ingredient, selection, status: "ADDED", message: "Added and verified in cart.", cartActionSucceeded: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The retailer could not safely complete this item.";
    report?.(progress("CART", `${ingredient.ingredient} needs your attention`, "FAILED", message));
    return { ingredient, selection, status: "NEEDS_ATTENTION", message };
  }
}

export class DemoRetailerAdapter implements RetailerAdapter {
  readonly capabilities = { productSearch: true, prices: true, availability: true, cartBuild: true, cartVerification: true, cartHandoff: true };
  private cart = new Map<string, number>();
  readonly id: string;
  readonly name: string;
  constructor(id = "demo-market-a", name = "Demo Market A") {
    this.id = id;
    this.name = name;
  }
  async searchProducts(ingredient: MissingIngredient) { return catalogs[this.id]?.[ingredient.ingredient] ?? []; }
  async addToCart(selection: ProductSelection) { this.cart.set(selection.product.retailerProductId, selection.quantity); return { succeeded: true }; }
  async verifyCartItem(selection: ProductSelection) { return this.cart.get(selection.product.retailerProductId) === selection.quantity; }
  async getCartUrl() { return `#${this.id}-cart`; }
}

export class UberEatsSimulationAdapter extends DemoRetailerAdapter {
  constructor() {
    super("uber-eats-simulated", "Uber Eats (Simulated)");
  }
}

export function makeTasks(requirements: MissingIngredient[]): ShoppingTask[] { return requirements.map((requirement) => ({ ...requirement, status: "queued", cartVerified: false })); }
export function isOwned(ingredient: string, pantryNames: string[]) { return pantryNames.some((name) => ingredient.toLowerCase().split(" ").some((term) => name.includes(term))); }
import { progress, type ProgressReporter } from "./agentProgress.ts";
