import type { MissingIngredient, ProductCandidate, RetailerAdapter, Unit } from "./shoppingAgent.ts";

type EvidenceProduct = ProductCandidate & { ingredient: string };
export type RetailerEvidence = { retailerName: string; location: string; retrievedAt: string; products: EvidenceProduct[] };

const units = new Set<Unit>(["g", "kg", "mL", "L", "each"]);

/** Validates product facts a shopper collected from a retailer page; it never authorizes cart writes. */
export function parseRetailerEvidence(input: string): RetailerEvidence {
  const value: unknown = JSON.parse(input);
  if (!value || typeof value !== "object") throw new Error("Use one retailer evidence object.");
  const record = value as Record<string, unknown>;
  if (typeof record.retailerName !== "string" || !record.retailerName.trim()) throw new Error("Add the retailer name.");
  if (typeof record.location !== "string" || !record.location.trim()) throw new Error("Add the delivery location or store.");
  if (typeof record.retrievedAt !== "string" || Number.isNaN(Date.parse(record.retrievedAt))) throw new Error("Add a valid retrieval time.");
  if (!Array.isArray(record.products) || !record.products.length) throw new Error("Add at least one product.");
  const retailerName = record.retailerName;
  const location = record.location;
  const retrievedAt = record.retrievedAt;
  const retailerId = `imported-evidence:${retailerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
  const products = record.products.map((raw, index): EvidenceProduct => {
    if (!raw || typeof raw !== "object") throw new Error(`Product ${index + 1} is invalid.`);
    const product = raw as Record<string, unknown>;
    const sourceUrl = typeof product.sourceUrl === "string" ? product.sourceUrl : "";
    if (!sourceUrl || !/^https:\/\//.test(sourceUrl)) throw new Error(`Product ${index + 1} needs an HTTPS product URL.`);
    if (typeof product.ingredient !== "string" || typeof product.name !== "string" || !product.ingredient.trim() || !product.name.trim()) throw new Error(`Product ${index + 1} needs an ingredient and product name.`);
    if (typeof product.packageQuantity !== "number" || product.packageQuantity <= 0 || !units.has(product.packageUnit as Unit)) throw new Error(`Product ${index + 1} needs a valid package size.`);
    if (typeof product.price !== "number" || product.price < 0) throw new Error(`Product ${index + 1} needs a valid CAD price.`);
    if (typeof product.available !== "boolean") throw new Error(`Product ${index + 1} must state availability.`);
    return {
      ingredient: product.ingredient.trim().toLowerCase(), retailerId, retailerProductId: typeof product.retailerProductId === "string" ? product.retailerProductId : `evidence-${index + 1}`,
      name: product.name.trim(), packageQuantity: product.packageQuantity, packageUnit: product.packageUnit as Unit,
      price: product.price, currency: "CAD", available: product.available, sourceUrl, retrievedAt,
    };
  });
  return { retailerName: retailerName.trim(), location: location.trim(), retrievedAt, products };
}

export class ImportedEvidenceAdapter implements RetailerAdapter {
  readonly id: string;
  readonly name: string;
  readonly capabilities = { productSearch: true, prices: true, availability: true, cartBuild: false, cartVerification: false, cartHandoff: false };
  private readonly evidence: RetailerEvidence;
  constructor(evidence: RetailerEvidence) {
    this.evidence = evidence;
    this.id = evidence.products[0].retailerId;
    this.name = `${evidence.retailerName} · provided evidence`;
  }
  async searchProducts(ingredient: MissingIngredient) {
    return this.evidence.products.filter((product) => product.ingredient === ingredient.ingredient.toLowerCase());
  }
}
