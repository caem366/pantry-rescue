import type { MissingIngredient, Unit } from "./shoppingAgent.ts";

export type PantryInventoryItem = { id: string; name: string; quantity: string; useSoon: boolean; daysLeft?: number };
type RecipeIngredient = { ingredient: string; quantity: number; unit: Unit; aliases?: string[] };
export type RescueRecipe = { id: string; name: string; rescue: string; imageUrl?: string; imageCredit?: string; imageCreditUrl?: string; ingredients: RecipeIngredient[]; instructions?: string[] };
export type RescuePlan = { recipes: RescueRecipe[]; gaps: MissingIngredient[]; ownedIngredientCount: number; rescuedCount: number };

export const rescueRecipes: RescueRecipe[] = [
  { id: "spinach-pasta", name: "Creamy mushroom & spinach pasta", rescue: "Pantry Rescue meal idea", imageUrl: "/mushroom-spinach-pasta.jpg", imageCredit: "Eaters Collective / Unsplash", imageCreditUrl: "https://unsplash.com/photos/pasta-dish-on-white-plate-ddZYOtZUnBk", instructions: ["Cook the pasta according to its package directions.", "Cook the sliced mushrooms in a pan until tender. Add garlic, stock, and cream; simmer until lightly thickened.", "Stir in spinach until wilted. Toss with pasta and finish with Parmesan."], ingredients: [
    { ingredient: "pasta", quantity: 1, unit: "each", aliases: ["penne"] },
    { ingredient: "spinach", quantity: 150, unit: "g", aliases: ["baby spinach"] },
    { ingredient: "mushrooms", quantity: 200, unit: "g", aliases: ["cremini mushrooms"] },
    { ingredient: "heavy cream", quantity: 250, unit: "mL", aliases: ["cream"] },
    { ingredient: "parmesan", quantity: 150, unit: "g" },
    { ingredient: "garlic", quantity: 2, unit: "each" },
    { ingredient: "vegetable stock", quantity: 750, unit: "mL" },
  ] },
  { id: "chickpea-bowls", name: "Chickpea & avocado tacos", rescue: "Pantry Rescue meal idea", imageUrl: "/chickpea-tortillas.jpg", imageCredit: "Shannon Nickerson / Unsplash", imageCreditUrl: "https://unsplash.com/photos/Qc2ePRQhV5c", instructions: ["Drain the chickpeas and cook in a skillet until warmed through and lightly crisp. Stir in crushed tomatoes and cook until thickened.", "Warm the tortillas, fill with chickpeas and chopped avocado, then finish with lemon juice."], ingredients: [
    { ingredient: "chickpeas", quantity: 2, unit: "each" },
    { ingredient: "tortillas", quantity: 1, unit: "each", aliases: ["flour tortillas"] },
    { ingredient: "tomatoes", quantity: 1, unit: "each", aliases: ["crushed tomatoes"] },
    { ingredient: "avocados", quantity: 2, unit: "each", aliases: ["avocado"] },
    { ingredient: "lemons", quantity: 2, unit: "each", aliases: ["lemon"] },
  ] },
  { id: "berry-yogurt", name: "Warm berry yogurt bowls", rescue: "Pantry Rescue meal idea", imageUrl: "/berry-yogurt.jpg", imageCredit: "Mari Helin / Unsplash", imageCreditUrl: "https://unsplash.com/photos/a-bowl-of-yogurt-with-raspberries-on-top-9oDxUu6CUOw", instructions: ["Warm the berries gently until they release their juices.", "Spoon over yogurt and serve."], ingredients: [
    { ingredient: "yogurt", quantity: 500, unit: "g", aliases: ["greek yogurt"] },
    { ingredient: "berries", quantity: 1, unit: "each", aliases: ["frozen berries"] },
  ] },
];

function normalize(value: string) { return value.toLowerCase().replace(/[^a-z]/g, "").replace(/s$/, ""); }
function parsedQuantity(value: string): { quantity: number; unit: Unit } | undefined {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(g|kg|ml|l|can(?:s)?|bag(?:s)?|box(?:es)?|pack(?:s)?|each)?\b/i);
  if (!match) return undefined;
  const quantity = Number(match[1]);
  const token = (match[2] ?? "each").toLowerCase();
  if (token === "kg") return { quantity: quantity * 1000, unit: "g" };
  if (token === "l") return { quantity: quantity * 1000, unit: "mL" };
  if (token === "g") return { quantity, unit: "g" };
  if (token === "ml") return { quantity, unit: "mL" };
  return { quantity, unit: "each" };
}
function matches(item: PantryInventoryItem, ingredient: RecipeIngredient) {
  const itemName = normalize(item.name);
  return [ingredient.ingredient, ...(ingredient.aliases ?? [])].map(normalize).some((term) => itemName.includes(term) || term.includes(itemName));
}

export function rankRescueRecipes(items: PantryInventoryItem[], recipes = rescueRecipes) {
  return recipes.filter((recipe) => items.some((item) => item.useSoon && recipe.ingredients.some((ingredient) => matches(item, ingredient)))).sort((left, right) => {
    const score = (recipe: RescueRecipe) => recipe.ingredients.reduce((total, ingredient) => {
      const matchesSoon = items.filter((item) => item.useSoon && matches(item, ingredient));
      return total + matchesSoon.reduce((sum, item) => sum + 10 + Math.max(0, 7 - (item.daysLeft ?? 7)), 0);
    }, 0) - buildRescuePlan(items, [recipe]).gaps.length;
    return score(right) - score(left) || left.name.localeCompare(right.name);
  });
}
function ownedQuantity(items: PantryInventoryItem[], ingredient: RecipeIngredient) {
  return items.filter((item) => matches(item, ingredient)).reduce((total, item) => {
    const parsed = parsedQuantity(item.quantity);
    return total + (parsed?.unit === ingredient.unit ? parsed.quantity : 0);
  }, 0);
}

export function buildRescuePlan(items: PantryInventoryItem[], recipes = rescueRecipes): RescuePlan {
  const requirements = new Map<string, RecipeIngredient>();
  for (const recipe of recipes) for (const ingredient of recipe.ingredients) {
    const key = `${ingredient.ingredient}:${ingredient.unit}`;
    const current = requirements.get(key);
    requirements.set(key, { ...ingredient, quantity: ingredient.quantity + (current?.quantity ?? 0) });
  }
  const gaps: MissingIngredient[] = [];
  let ownedIngredientCount = 0;
  for (const ingredient of requirements.values()) {
    const owned = ownedQuantity(items, ingredient);
    if (owned >= ingredient.quantity) ownedIngredientCount += 1;
    else gaps.push({ id: ingredient.ingredient.replace(/\s+/g, "-"), ingredient: ingredient.ingredient, requiredQuantity: ingredient.quantity - owned, unit: ingredient.unit });
  }
  const rescuedCount = items.filter((item) => item.useSoon && recipes.some((recipe) => recipe.ingredients.some((ingredient) => matches(item, ingredient)))).length;
  return { recipes, gaps, ownedIngredientCount, rescuedCount };
}
