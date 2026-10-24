import type {
  CartActionResult,
  MissingIngredient,
  ProductCandidate,
  ProductSelection,
  RetailerAdapter,
  Unit,
} from "../src/lib/shoppingAgent.ts";

const API_ROOT = "https://api.kroger.com/v1";

type KrogerRecord = Record<string, unknown>;
type KrogerConfig = {
  accessToken: string;
  locationId: string;
  fetcher?: typeof fetch;
};

function record(value: unknown): KrogerRecord | undefined {
  return value && typeof value === "object" ? value as KrogerRecord : undefined;
}

function parsePackageSize(value: unknown): { quantity: number; unit: Unit } | undefined {
  if (typeof value !== "string") return undefined;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(fl\s?oz|oz|lb|ml|l|g|kg|ct|ea|each)\b/i);
  if (!match) return undefined;
  const quantity = Number(match[1]);
  const unit = match[2].toLowerCase().replace(/\s/g, "");
  if (unit === "floz") return { quantity: quantity * 29.5735, unit: "mL" };
  if (unit === "oz") return { quantity: quantity * 28.3495, unit: "g" };
  if (unit === "lb") return { quantity: quantity * 453.592, unit: "g" };
  if (unit === "ml") return { quantity, unit: "mL" };
  if (unit === "l") return { quantity, unit: "L" };
  if (unit === "g") return { quantity, unit: "g" };
  if (unit === "kg") return { quantity, unit: "kg" };
  return { quantity, unit: "each" };
}

function numeric(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export class KrogerAdapter implements RetailerAdapter {
  readonly id = "kroger";
  readonly name = "Kroger";
  private readonly config: KrogerConfig;
  readonly capabilities = {
    productSearch: true,
    prices: true,
    availability: true,
    cartBuild: true,
    cartVerification: false,
    cartHandoff: true,
  };
  private readonly fetcher: typeof fetch;

  constructor(config: KrogerConfig) {
    this.config = config;
    this.fetcher = config.fetcher ?? fetch;
  }

  async searchProducts(ingredient: MissingIngredient): Promise<ProductCandidate[]> {
    if (!this.config.locationId) throw new Error("Choose a Kroger location before searching so availability is grounded.");
    const params = new URLSearchParams({
      "filter.term": ingredient.ingredient,
      "filter.limit": "20",
      "filter.locationId": this.config.locationId,
    });
    const response = await this.fetcher(`${API_ROOT}/products?${params}`, {
      headers: { Authorization: `Bearer ${this.config.accessToken}`, Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Kroger product search failed (${response.status}).`);
    const body = record(await response.json());
    const products = Array.isArray(body?.data) ? body.data : [];
    return products.flatMap((value) => {
      const product = record(value);
      if (!product) return [];
      const items = Array.isArray(product.items) ? product.items : [];
      const item = items.map(record).find((candidate) => candidate !== undefined);
      const upc = item?.upc ?? product.upc;
      if (typeof upc !== "string" || !/^\d{8,14}$/.test(upc)) return [];
      const name = typeof product.description === "string" ? product.description : "";
      if (!name) return [];
      const size = parsePackageSize(item?.size ?? product.size);
      const priceRecord = record(item?.price);
      const price = numeric(priceRecord?.regular);
      return [{
        retailerId: this.id,
        retailerProductId: upc,
        name,
        brand: typeof product.brand === "string" ? product.brand : undefined,
        packageQuantity: size?.quantity,
        packageUnit: size?.unit,
        price,
        currency: "USD" as const,
        available: Boolean(item),
        retrievedAt: new Date().toISOString(),
      }];
    });
  }

  async addToCart(selection: ProductSelection): Promise<CartActionResult> {
    if (!/^\d{8,14}$/.test(selection.product.retailerProductId)) {
      return { succeeded: false, message: "Kroger requires a product UPC; no safe cart request was sent." };
    }
    if (!Number.isInteger(selection.quantity) || selection.quantity < 1 || selection.quantity > 50) {
      return { succeeded: false, message: "The selected quantity is outside the safe cart limit." };
    }
    const response = await this.fetcher(`${API_ROOT}/cart/add`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ items: [{ upc: selection.product.retailerProductId, quantity: selection.quantity }] }),
    });
    if (!response.ok) return { succeeded: false, message: `Kroger did not accept the cart write (${response.status}).` };
    return {
      succeeded: true,
      message: "Kroger accepted the cart write. Review the real cart and confirm this item; API cart contents are not verified.",
    };
  }

  async getCartUrl() {
    return "https://www.kroger.com/cart";
  }

  async verifyCartItem(_selection: ProductSelection): Promise<boolean> {
    return false;
  }
}
