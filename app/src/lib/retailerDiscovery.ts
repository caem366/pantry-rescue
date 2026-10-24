import type { MissingIngredient, ProductCandidate, RetailerCapabilities } from "./shoppingAgent.ts";

export type FulfillmentLocation = {
  postalCode: string;
  fulfillment: "delivery" | "pickup";
  storeId?: string;
};

export type RetailerAccess = {
  automationAllowed: boolean;
  status: "REQUIRES_RETAILER_PERMISSION" | "APPROVED" | "BLOCKED";
  evidenceUrl: string;
  note: string;
};

export type RetailerDiscoveryRequest = {
  ingredient: MissingIngredient;
  location: FulfillmentLocation;
};

/** Discovery is intentionally separate from selection, approval, and cart execution. */
export interface RetailerDiscoveryAdapter {
  id: string;
  name: string;
  capabilities: Pick<RetailerCapabilities, "productSearch" | "prices" | "availability">;
  access: RetailerAccess;
  searchProducts(request: RetailerDiscoveryRequest): Promise<ProductCandidate[]>;
}

class PermissionRequiredDiscoveryAdapter implements RetailerDiscoveryAdapter {
  readonly capabilities = { productSearch: false, prices: false, availability: false };
  readonly id: string;
  readonly name: string;
  readonly access: RetailerAccess;

  constructor(id: string, name: string, access: RetailerAccess) {
    this.id = id;
    this.name = name;
    this.access = access;
  }

  async searchProducts(_request: RetailerDiscoveryRequest): Promise<ProductCandidate[]> {
    throw new Error(`${this.name} product discovery is disabled until Pantry Rescue has retailer permission for browser automation.`);
  }
}

const requiresPermission = (evidenceUrl: string, note: string): RetailerAccess => ({
  automationAllowed: false,
  status: "REQUIRES_RETAILER_PERMISSION",
  evidenceUrl,
  note,
});

// These are registry entries, not claims that browser automation is approved.
export const canadianRetailerDiscoveryAdapters: RetailerDiscoveryAdapter[] = [
  new PermissionRequiredDiscoveryAdapter(
    "walmart-ca",
    "Walmart Canada",
    requiresPermission(
      "https://www.walmart.ca/en/c/kp/terms",
      "Do not run browser product discovery until Walmart Canada grants express written permission or provides an approved integration.",
    ),
  ),
  new PermissionRequiredDiscoveryAdapter(
    "voila",
    "Voilà by Sobeys",
    requiresPermission(
      "https://voila.ca/content/terms-and-conditions--conditions-generales",
      "Voilà's terms limit use to personal, non-commercial use unless Sobeys permits otherwise in writing; retailer permission is required before automated discovery is enabled.",
    ),
  ),
  new PermissionRequiredDiscoveryAdapter(
    "metro-ca",
    "Metro",
    requiresPermission(
      "https://www.metro.ca/en/terms-of-use",
      "Metro's terms limit use to personal, non-commercial use; retailer permission is required before automated discovery is enabled.",
    ),
  ),
];
