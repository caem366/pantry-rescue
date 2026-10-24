import type { MissingIngredient, ProductCandidate, RetailerAdapter, Unit } from "../src/lib/shoppingAgent.ts";

type SearchProduct = {
  id: string;
  name: string;
  brand?: string | null;
  size?: string | null;
  price?: number | null;
  store?: string;
  image?: string;
  link?: string;
  updated?: string;
};

type StorePrice = {
  store: string;
  price?: number | null;
  size?: string | null;
  link?: string;
  date?: string;
  timestamp?: number;
  unitPrice?: { value?: number | null; unit?: string };
};

type ProductDetail = SearchProduct & { prices?: StorePrice[] };
type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: { code?: string; message?: string } };
export type EpiceriesDiscovery = {
  candidatesByStore: Map<string, ProductCandidate[]>;
  ingredients: MissingIngredient[];
  searchedAt: string;
  warnings: string[];
};

const API_URL = "https://epiceries.ca/api";
const CACHE_TTL_MS = 5 * 60_000;
const MIN_REQUEST_INTERVAL_MS = 500;
const MAX_DETAILS_PER_INGREDIENT = 6;
const cache = new Map<string, { expiresAt: number; value: unknown }>();
let requestQueue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

const stores: Record<string, { id: string; name: string }> = {
  walmart: { id: "walmart-ca", name: "Walmart Canada" },
  maxi: { id: "maxi", name: "Maxi" },
  iga: { id: "iga", name: "IGA" },
  superc: { id: "superc", name: "Super C" },
  metro: { id: "metro", name: "Metro" },
  provigo: { id: "provigo", name: "Provigo" },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalize(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function ingredientSearch(ingredient: MissingIngredient): { terms: string[]; brandPreference?: string } {
  const normalized = normalize(ingredient.ingredient);
  if (normalized.includes("chinese broccoli") || normalized === "gai lan") {
    return { terms: ["Chinese broccoli", "gai lan", "brocoli chinois"] };
  }
  if (normalized.includes("oyster sauce")) {
    return { terms: ["Lee Kum Kee oyster sauce", "oyster sauce", "sauce huitre"], brandPreference: "Lee Kum Kee" };
  }
  if (normalized.includes("iced coffee")) {
    return { terms: ["International Delight iced coffee", "iced coffee", "cafe glace"], brandPreference: "International Delight" };
  }
  if (normalized.includes("nerds") && normalized.includes("gummy") && normalized.includes("cluster")) {
    return { terms: ["Nerds Gummy Clusters"] };
  }
  return { terms: [...new Set([ingredient.ingredient, ...(ingredient.searchTerms ?? [])])] };
}

function relevantProduct(ingredient: MissingIngredient, product: SearchProduct): boolean {
  const normalized = normalize(`${product.name} ${product.brand ?? ""}`);
  const target = normalize(ingredient.ingredient);
  if (target.includes("iced coffee")) {
    return normalized.includes("international delight")
      && (normalized.includes("iced coffee") || normalized.includes("cafe glace"));
  }
  if (target.includes("oyster sauce")) return normalized.includes("oyster sauce") || normalized.includes("sauce huitre");
  if (target.includes("chinese broccoli") || target === "gai lan") {
    return normalized.includes("chinese broccoli") || normalized.includes("brocoli chinois") || normalized.includes("gai lan");
  }
  if (target.includes("nerds") && target.includes("gummy") && target.includes("cluster")) {
    return ["nerds", "gummy", "cluster"].every((word) => normalized.includes(word));
  }
  const phrases = [ingredient.ingredient, ...(ingredient.searchTerms ?? [])].map(normalize).filter(Boolean);
  return phrases.some((phrase) => phrase.split(" ").every((word) => normalized.includes(word)));
}

function parsePackageSize(value?: string | null): { quantity?: number; unit?: Unit } {
  if (!value) return {};
  const normalized = value.replace(",", ".");
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l|oz|lb|lbs|ct|count|each)\b/i);
  if (!match) return {};
  const quantity = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(quantity) || quantity <= 0) return {};
  if (unit === "kg") return { quantity, unit: "kg" };
  if (unit === "g") return { quantity, unit: "g" };
  if (unit === "ml") return { quantity, unit: "mL" };
  if (unit === "l") return { quantity, unit: "L" };
  if (unit === "oz") return { quantity: Math.round(quantity * 28.3495), unit: "g" };
  if (unit === "lb" || unit === "lbs") return { quantity: Math.round(quantity * 453.592), unit: "g" };
  return { quantity, unit: "each" };
}

function parsePriceBasis(unitPrice?: StorePrice["unitPrice"]): { quantity?: number; unit?: Unit } {
  if (typeof unitPrice?.value !== "number" || !Number.isFinite(unitPrice.value) || unitPrice.value <= 0 || !unitPrice.unit) return {};
  const unit = normalize(unitPrice.unit);
  if (unit.includes("100 g") || unit.includes("100g")) return { quantity: 100, unit: "g" };
  if (unit === "kg") return { quantity: 1000, unit: "g" };
  if (unit.includes("100 ml") || unit.includes("100ml")) return { quantity: 100, unit: "mL" };
  if (unit === "l") return { quantity: 1000, unit: "mL" };
  if (unit.includes("unit") || unit.includes("ct")) return { quantity: 1, unit: "each" };
  return {};
}

function observationDate(price: StorePrice, product: SearchProduct): string {
  if (typeof price.date === "string" && !Number.isNaN(Date.parse(price.date))) return price.date;
  if (typeof price.timestamp === "number" && Number.isFinite(price.timestamp)) return new Date(price.timestamp * 1000).toISOString();
  if (product.updated && !Number.isNaN(Date.parse(product.updated))) return product.updated;
  return new Date().toISOString();
}

function cached<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

async function requestJson<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(API_URL);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const cacheKey = url.toString();
  const hit = cached<T>(cacheKey);
  if (hit !== undefined) return hit;

  let resolveQueued!: () => void;
  const previous = requestQueue;
  requestQueue = new Promise<void>((resolve) => { resolveQueued = resolve; });
  await previous;
  try {
    const wait = Math.max(0, lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now());
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    lastRequestAt = Date.now();
    if (!response.ok) throw new Error(`épiceries.ca returned HTTP ${response.status} for ${params.endpoint}.`);
    const envelope: unknown = await response.json();
    if (!isRecord(envelope) || envelope.ok !== true || !isRecord(envelope.data)) {
      const message = isRecord(envelope) && isRecord(envelope.error) && typeof envelope.error.message === "string"
        ? envelope.error.message
        : "The grocery data provider returned an invalid response.";
      throw new Error(`épiceries.ca: ${message}`);
    }
    const value = (envelope as ApiEnvelope<T> & { data: T }).data;
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value });
    if (cache.size > 300) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    return value;
  } finally {
    resolveQueued();
  }
}

async function searchProducts(query: string): Promise<SearchProduct[]> {
  const data = await requestJson<{ results?: unknown }>(
    { endpoint: "search", q: query, sort: "updated_desc", limit: "20" },
  );
  if (!Array.isArray(data.results)) throw new Error("épiceries.ca product search response did not contain results.");
  return data.results.filter((entry): entry is SearchProduct =>
    isRecord(entry) && typeof entry.id === "string" && typeof entry.name === "string",
  );
}

async function productDetails(id: string): Promise<ProductDetail> {
  return await requestJson<ProductDetail>({ endpoint: "product", id });
}

function toCandidate(product: SearchProduct, price: StorePrice): ProductCandidate | undefined {
  const store = stores[price.store];
  if (!store || typeof price.price !== "number" || !Number.isFinite(price.price) || price.price < 0) return undefined;
  const sizeLabel = price.size ?? product.size ?? undefined;
  const size = parsePackageSize(sizeLabel);
  const priceBasis = size.quantity === undefined ? parsePriceBasis(price.unitPrice) : {};
  const sourceUrl = price.link ?? product.link;
  if (!sourceUrl || !sourceUrl.startsWith("https://")) return undefined;
  const retrievedAt = observationDate(price, product);
  return {
    retailerId: store.id,
    retailerProductId: `${product.id}:${price.store}`,
    name: product.name,
    brand: product.brand ?? undefined,
    packageQuantity: size.quantity,
    packageUnit: size.unit,
    packageSizeLabel: sizeLabel ?? (priceBasis.quantity ? `per ${priceBasis.quantity} ${priceBasis.unit}` : undefined),
    priceBasisQuantity: priceBasis.quantity,
    priceBasisUnit: priceBasis.unit,
    price: price.price,
    currency: "CAD",
    available: true,
    availabilityVerified: false,
    imageUrl: product.image,
    sourceUrl,
    retrievedAt,
  };
}

export async function discoverEpiceriesOffers(ingredients: MissingIngredient[]): Promise<EpiceriesDiscovery> {
  const candidatesByStore = new Map<string, ProductCandidate[]>();
  const preparedIngredients: MissingIngredient[] = [];
  const warnings: string[] = [];

  for (const originalIngredient of ingredients) {
    const search = ingredientSearch(originalIngredient);
    const ingredient: MissingIngredient = {
      ...originalIngredient,
      searchTerms: [...new Set([...search.terms, ...(originalIngredient.searchTerms ?? [])])],
      brandPreference: originalIngredient.brandPreference ?? search.brandPreference,
    };
    preparedIngredients.push(ingredient);
    const products = new Map<string, SearchProduct>();
    for (const term of search.terms) {
      const matches = await searchProducts(term);
      for (const product of matches) {
        if (relevantProduct(ingredient, product)) products.set(product.id, product);
      }
    }

    const preferredBrand = ingredient.brandPreference?.toLowerCase();
    const ranked = [...products.values()].sort((a, b) =>
      Number(Boolean(b.brand?.toLowerCase().includes(preferredBrand ?? "\u0000")))
        - Number(Boolean(a.brand?.toLowerCase().includes(preferredBrand ?? "\u0000")))
        || a.name.localeCompare(b.name),
    ).slice(0, MAX_DETAILS_PER_INGREDIENT);

    for (const product of ranked) {
      let detail: ProductDetail;
      try {
        detail = await productDetails(product.id);
      } catch (error) {
        if (typeof product.store === "string" && typeof product.price === "number") {
          warnings.push(`Detailed store prices could not be retrieved for ${product.name}; its search-result price is shown only for ${stores[product.store]?.name ?? product.store}.`);
          const fallback = toCandidate(product, {
            store: product.store,
            price: product.price,
            size: product.size,
            link: product.link,
            date: product.updated,
          });
          if (fallback) candidatesByStore.set(fallback.retailerId, [...(candidatesByStore.get(fallback.retailerId) ?? []), fallback]);
          continue;
        }
        throw error;
      }

      const prices = Array.isArray(detail.prices) ? detail.prices : [];
      if (!prices.length && typeof detail.store === "string" && typeof detail.price === "number") {
        prices.push({ store: detail.store, price: detail.price, size: detail.size, link: detail.link, date: detail.updated });
      }
      for (const price of prices) {
        const candidate = toCandidate(detail, price);
        if (candidate) candidatesByStore.set(candidate.retailerId, [...(candidatesByStore.get(candidate.retailerId) ?? []), candidate]);
      }
    }
  }

  return { candidatesByStore, ingredients: preparedIngredients, searchedAt: new Date().toISOString(), warnings };
}

export function createEpiceriesStoreAdapters(offers: Map<string, ProductCandidate[]>): RetailerAdapter[] {
  return [
    { id: "walmart-ca", name: "Walmart Canada" },
    { id: "maxi", name: "Maxi" },
    { id: "iga", name: "IGA" },
    { id: "superc", name: "Super C" },
    { id: "metro", name: "Metro" },
    { id: "provigo", name: "Provigo" },
  ].map(({ id, name }): RetailerAdapter => ({
  id,
  name,
  capabilities: { productSearch: true, prices: true, availability: false, cartBuild: false, cartVerification: false, cartHandoff: true },
  async searchProducts(ingredient) {
    return (offers.get(id) ?? []).filter((candidate) => {
      const target = normalize(ingredient.ingredient);
      const source = normalize(`${candidate.name} ${candidate.brand ?? ""}`);
      if (target.includes("iced coffee")) return source.includes("international delight") && (source.includes("iced coffee") || source.includes("cafe glace"));
      if (target.includes("oyster sauce")) return source.includes("oyster sauce") || source.includes("sauce huitre");
      if (target.includes("chinese broccoli") || target === "gai lan") return source.includes("gai lan") || source.includes("brocoli chinois") || source.includes("chinese broccoli");
      if (target.includes("nerds") && target.includes("gummy") && target.includes("cluster")) return ["nerds", "gummy", "cluster"].every((word) => source.includes(word));
      const terms = [ingredient.ingredient, ...(ingredient.searchTerms ?? [])].map(normalize);
      return terms.some((term) => term && term.split(" ").every((word) => source.includes(word)));
    });
  },
}));
}
