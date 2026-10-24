import { bestCompleteBasket, compareBaskets } from "../src/lib/basketOptimizer.ts";
import { createEpiceriesStoreAdapters, discoverEpiceriesOffers } from "../server/epiceriesProvider.ts";
import type { MissingIngredient } from "../src/lib/shoppingAgent.ts";

const basket: MissingIngredient[] = [
  { id: "iced-coffee", ingredient: "International Delight iced coffee", requiredQuantity: 1.89, unit: "L" },
  { id: "oyster-sauce", ingredient: "Lee Kum Kee oyster sauce", requiredQuantity: 1, unit: "each" },
  { id: "gai-lan", ingredient: "Chinese broccoli", requiredQuantity: 1, unit: "each" },
  { id: "nerds", ingredient: "Nerds Gummy Clusters", requiredQuantity: 142, unit: "g" },
];

const discovery = await discoverEpiceriesOffers(basket);
const walmart = discovery.candidatesByStore.get("walmart-ca") ?? [];
if (!walmart.some((product) => product.price !== undefined && product.sourceUrl)) {
  throw new Error("The public provider returned no observed Walmart Canada product with a price and source URL.");
}
const options = await compareBaskets(createEpiceriesStoreAdapters(discovery.candidatesByStore), discovery.ingredients);
const walmartBasket = options.find((option) => option.retailerId === "walmart-ca");
console.log(JSON.stringify({
  source: "épiceries.ca",
  searchedAt: discovery.searchedAt,
  walmartSelections: walmartBasket?.selections.map(({ ingredient, product, quantity }) => ({ ingredient: ingredient.ingredient, product: product.name, packageSizeLabel: product.packageSizeLabel, price: product.price, quantity, sourceUrl: product.sourceUrl, retrievedAt: product.retrievedAt })),
  bestCompleteBasket: bestCompleteBasket(options)?.retailerName ?? null,
  baskets: options.map(({ retailerName, matchedIngredientCount, totalIngredientCount, complete, estimatedTotal, warnings }) => ({ retailerName, matchedIngredientCount, totalIngredientCount, complete, estimatedTotal, warnings })),
}, null, 2));
