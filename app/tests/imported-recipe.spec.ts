import { expect, test } from "@playwright/test";
import { importedRecipeGaps } from "../src/lib/importedRecipe.ts";

test("imported recipes preserve partial gaps and flag measurements that need a person", () => {
  const result = importedRecipeGaps([
    { name: "Parmesan", measure: "150 g" },
    { name: "Vegetable stock", measure: "1 1/2 cups" },
    { name: "Basil", measure: "to taste" },
  ], [
    { name: "Parmesan", quantity: "50 g" },
    { name: "Vegetable stock", quantity: "100 mL" },
  ]);

  expect(result.gaps).toEqual(expect.arrayContaining([
    expect.objectContaining({ ingredient: "parmesan", requiredQuantity: 100, unit: "g" }),
    expect.objectContaining({ ingredient: "vegetable stock", requiredQuantity: 260, unit: "mL" }),
  ]));
  expect(result.needsAttention).toEqual([{ name: "Basil", measure: "to taste" }]);
});

test("a complete compatible pantry match does not create a shopping gap", () => {
  const result = importedRecipeGaps([{ name: "Lemon", measure: "2 each" }], [{ name: "Lemons", quantity: "2 each" }]);
  expect(result.gaps).toEqual([]);
  expect(result.needsAttention).toEqual([]);
});
