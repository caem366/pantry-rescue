import { expect, test } from "@playwright/test";
import { canadianRetailerDiscoveryAdapters } from "../src/lib/retailerDiscovery.ts";

test("Canadian discovery candidates remain disabled without retailer permission", async () => {
  const walmart = canadianRetailerDiscoveryAdapters.find((adapter) => adapter.id === "walmart-ca")!;
  expect(walmart.access).toMatchObject({ automationAllowed: false, status: "REQUIRES_RETAILER_PERMISSION" });
  expect(walmart.capabilities).toEqual({ productSearch: false, prices: false, availability: false });
  await expect(walmart.searchProducts({
    ingredient: { id: "coffee", ingredient: "iced coffee", requiredQuantity: 1, unit: "each" },
    location: { postalCode: "M5V 1A1", fulfillment: "delivery" },
  })).rejects.toThrow(/disabled until Pantry Rescue has retailer permission/i);
});
