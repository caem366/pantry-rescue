export type SourcedRecipe = {
  id: string;
  name: string;
  category?: string;
  cuisine?: string;
  imageUrl?: string;
  instructions?: string;
  ingredients: { name: string; measure?: string }[];
  sourceUrl?: string;
  provider: "TheMealDB";
  attribution: string;
};

type MealDbMeal = Record<string, string | null> & {
  idMeal: string; strMeal: string; strCategory: string | null; strArea: string | null;
  strMealThumb: string | null; strInstructions: string | null; strSource: string | null;
};

function mapMeal(meal: MealDbMeal): SourcedRecipe {
  const ingredients = Array.from({ length: 20 }, (_, index) => index + 1).flatMap((position) => {
    const name = meal[`strIngredient${position}`]?.trim();
    return name ? [{ name, measure: meal[`strMeasure${position}`]?.trim() || undefined }] : [];
  });
  return {
    id: meal.idMeal,
    name: meal.strMeal,
    category: meal.strCategory ?? undefined,
    cuisine: meal.strArea ?? undefined,
    imageUrl: meal.strMealThumb ? `${meal.strMealThumb}/medium` : undefined,
    instructions: meal.strInstructions ?? undefined,
    ingredients,
    sourceUrl: meal.strSource ?? undefined,
    provider: "TheMealDB",
    attribution: "Recipe data and meal artwork from TheMealDB.",
  };
}

export async function searchSourcedRecipes(query: string, apiKey = process.env.THEMEALDB_API_KEY ?? "1") {
  if (!apiKey) throw new Error("THEMEALDB_API_KEY is not configured on the shopping service.");
  const response = await fetch(`https://www.themealdb.com/api/json/v1/${encodeURIComponent(apiKey)}/search.php?s=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`TheMealDB recipe search failed (${response.status}).`);
  const body = await response.json() as { meals: MealDbMeal[] | null };
  return (body.meals ?? []).map(mapMeal);
}
