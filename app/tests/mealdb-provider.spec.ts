import { expect, test } from "@playwright/test";
import { searchSourcedRecipes } from "../server/mealDbProvider.ts";

test("TheMealDB mapper preserves ingredient measures, source, and image attribution", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ meals: [{
    idMeal: "meal-1", strMeal: "Test pasta", strCategory: "Vegetarian", strArea: "Italian",
    strMealThumb: "https://cdn.example/pasta.jpg", strInstructions: "Cook pasta.", strSource: "https://source.example/pasta",
    strIngredient1: "Pasta", strMeasure1: "200 g", strIngredient2: "Spinach", strMeasure2: "1 bag", strIngredient3: "", strMeasure3: "",
  }] }), { status: 200 });
  try {
    const recipes = await searchSourcedRecipes("pasta", "development-key");
    expect(recipes[0]).toMatchObject({ name: "Test pasta", imageUrl: "https://cdn.example/pasta.jpg/medium", sourceUrl: "https://source.example/pasta", provider: "TheMealDB" });
    expect(recipes[0]?.ingredients).toEqual([{ name: "Pasta", measure: "200 g" }, { name: "Spinach", measure: "1 bag" }]);
  } finally { globalThis.fetch = originalFetch; }
});
