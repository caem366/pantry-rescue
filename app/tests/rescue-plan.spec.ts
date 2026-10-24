import { expect, test } from "@playwright/test";
import { buildRescuePlan, rankRescueRecipes, rescueRecipes } from "../src/lib/rescuePlan.ts";
import { selectProduct, type MissingIngredient, type ProductCandidate } from "../src/lib/shoppingAgent.ts";

const sample = [
  { id: "spinach", name: "Baby spinach", quantity: "1 bag", useSoon: true },
  { id: "mushrooms", name: "Cremini mushrooms", quantity: "1 bag", useSoon: true },
  { id: "pasta", name: "Penne pasta", quantity: "1 box", useSoon: false },
  { id: "chickpeas", name: "Chickpeas", quantity: "2 cans", useSoon: false },
  { id: "tomatoes", name: "Crushed tomatoes", quantity: "1 can", useSoon: false },
  { id: "tortillas", name: "Flour tortillas", quantity: "1 pack", useSoon: false },
  { id: "yogurt", name: "Greek yogurt", quantity: "500 g", useSoon: true },
  { id: "berries", name: "Frozen berries", quantity: "1 bag", useSoon: false },
];

test("recipe-derived gaps subtract real pantry quantities", () => {
  const plan = buildRescuePlan(sample);
  expect(plan.recipes.map((recipe) => recipe.name)).toContain("Creamy mushroom & spinach pasta");
  expect(plan.gaps).toEqual(expect.arrayContaining([
    expect.objectContaining({ ingredient: "parmesan", requiredQuantity: 150, unit: "g" }),
    expect.objectContaining({ ingredient: "vegetable stock", requiredQuantity: 750, unit: "mL" }),
    expect.objectContaining({ ingredient: "lemons", requiredQuantity: 2, unit: "each" }),
    expect.objectContaining({ ingredient: "avocados", requiredQuantity: 2, unit: "each" }),
  ]));
  expect(plan.gaps.some((gap) => gap.ingredient === "chickpeas")).toBe(false);
  expect(plan.rescuedCount).toBe(3);
});

test("partial pantry quantities remain a calculated gap", () => {
  const plan = buildRescuePlan(sample.map((item) => item.id === "chickpeas" ? { ...item, quantity: "1 can" } : item));
  expect(plan.gaps).toContainEqual(expect.objectContaining({ ingredient: "chickpeas", requiredQuantity: 1, unit: "each" }));
});

test("package selection converts compatible units and rejects unavailable or mismatched products", () => {
  const stock: MissingIngredient = { id: "stock", ingredient: "vegetable stock", requiredQuantity: 750, unit: "mL" };
  const products: ProductCandidate[] = [
    { retailerId: "test", retailerProductId: "small", name: "Vegetable stock", packageQuantity: 250, packageUnit: "mL", price: 1, currency: "CAD", available: true, retrievedAt: "2026-10-21" },
    { retailerId: "test", retailerProductId: "best", name: "Vegetable stock", packageQuantity: 0.9, packageUnit: "L", price: 3, currency: "CAD", available: true, retrievedAt: "2026-10-21" },
    { retailerId: "test", retailerProductId: "out", name: "Vegetable stock", packageQuantity: 900, packageUnit: "mL", price: 2, currency: "CAD", available: false, retrievedAt: "2026-10-21" },
  ];
  expect(selectProduct(stock, products)).toMatchObject({ product: { retailerProductId: "best" }, quantity: 1 });
});

test("expiry-first ranking favours the meal that rescues the earliest ingredients", () => {
  const pantry = [
    { id: "spinach", name: "Spinach", quantity: "150 g", useSoon: true, daysLeft: 2 },
    { id: "mushrooms", name: "Mushrooms", quantity: "200 g", useSoon: true, daysLeft: 1 },
    { id: "cream", name: "Heavy cream", quantity: "250 mL", useSoon: true, daysLeft: 3 },
  ];
  expect(rankRescueRecipes(pantry)[0].id).toBe("spinach-pasta");
  expect(buildRescuePlan(pantry, [rescueRecipes[0]]).gaps).toEqual(expect.arrayContaining([
    expect.objectContaining({ ingredient: "parmesan", requiredQuantity: 150, unit: "g" }),
  ]));
});

test("a multi-meal plan combines duplicate requirements before subtracting the pantry once", () => {
  const recipes = [
    { id: "one", name: "One", icon: "", rescue: "", ingredients: [{ ingredient: "lemon", quantity: 2, unit: "each" as const }] },
    { id: "two", name: "Two", icon: "", rescue: "", ingredients: [{ ingredient: "lemon", quantity: 1, unit: "each" as const }] },
  ];
  expect(buildRescuePlan([{ id: "lemon", name: "Lemons", quantity: "1 each", useSoon: true }], recipes).gaps)
    .toContainEqual(expect.objectContaining({ ingredient: "lemon", requiredQuantity: 2, unit: "each" }));
});
