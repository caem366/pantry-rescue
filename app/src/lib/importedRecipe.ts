import type { MissingIngredient, Unit } from "./shoppingAgent";

export type ImportedIngredient = { name: string; measure?: string };
type Pantry = { name: string; quantity: string };

const normal = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "").replace(/s$/, "");

function amount(value?: string): { quantity: number; unit: Unit } | undefined {
  const text = value?.trim().toLowerCase();
  if (!text) return undefined;
  const match = text.match(/^(?:(\d+)\s+)?(\d+(?:\.\d+)?|\d+\/\d+)(?:\s*([a-z]+))?$/);
  if (!match) return undefined;
  const fraction = match[2].includes("/")
    ? (() => { const [numerator, denominator] = match[2].split("/").map(Number); return numerator / denominator; })()
    : Number(match[2]);
  const quantity = Number(match[1] ?? 0) + fraction;
  if (!Number.isFinite(quantity) || quantity <= 0) return undefined;
  const unit = (match[3] ?? "each").toLowerCase();
  if (["clove", "cloves", "can", "cans", "bag", "bags", "box", "boxes", "pack", "packs", "each"].includes(unit)) return { quantity, unit: "each" };
  if (unit === "g") return { quantity, unit: "g" };
  if (unit === "kg") return { quantity: quantity * 1000, unit: "g" };
  if (unit === "ml") return { quantity, unit: "mL" };
  if (unit === "l") return { quantity: quantity * 1000, unit: "mL" };
  if (unit === "tsp") return { quantity: quantity * 5, unit: "mL" };
  if (unit === "tbsp") return { quantity: quantity * 15, unit: "mL" };
  if (["cup", "cups"].includes(unit)) return { quantity: quantity * 240, unit: "mL" };
  return undefined;
}

export function importedRecipeGaps(ingredients: ImportedIngredient[], pantry: Pantry[]) {
  const needsAttention: ImportedIngredient[] = [];
  const gaps: MissingIngredient[] = [];
  for (const ingredient of ingredients) {
    const required = amount(ingredient.measure);
    if (!required) {
      needsAttention.push(ingredient);
      continue;
    }
    const owned = pantry
      .filter((item) => normal(item.name).includes(normal(ingredient.name)) || normal(ingredient.name).includes(normal(item.name)))
      .reduce((total, item) => {
        const quantity = amount(item.quantity);
        return total + (quantity?.unit === required.unit ? quantity.quantity : 0);
      }, 0);
    if (owned < required.quantity) {
      gaps.push({
        id: `imported-${normal(ingredient.name)}`,
        ingredient: ingredient.name.toLowerCase(),
        requiredQuantity: required.quantity - owned,
        unit: required.unit,
        searchTerms: [ingredient.name],
      });
    }
  }
  return { gaps, needsAttention };
}
