import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "./lib/api";
import { importedRecipeGaps } from "./lib/importedRecipe";

export type Recipe = {
  id: string; name: string; category?: string; cuisine?: string; imageUrl?: string; instructions?: string;
  ingredients: { name: string; measure?: string }[]; sourceUrl?: string; provider: "TheMealDB"; attribution: string;
};
type PantryItem = { name: string; quantity: string; useSoon: boolean; daysLeft?: number };
const clean = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "").replace(/s$/, "");

export default function RecipeDiscovery({ items, onCook }: { items: PantryItem[]; onCook: (recipe: Recipe) => void }) {
  const [query, setQuery] = useState(() => [...items].filter((item) => item.useSoon).sort((left, right) => (left.daysLeft ?? Infinity) - (right.daysLeft ?? Infinity))[0]?.name.split(/\s+/).at(-1)?.replace(/s$/i, "") ?? "pasta");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error" | "empty">("idle");

  async function search() {
    setState("loading");
    setSelected(null);
    try {
      const response = await apiFetch(`/api/recipes/discover?q=${encodeURIComponent(query)}`);
      const body = await response.json() as { recipes?: Recipe[]; error?: string };
      if (!response.ok) throw new Error(body.error);
      setRecipes(body.recipes ?? []);
      setState(body.recipes?.length ? "idle" : "empty");
    } catch {
      setState("error");
    }
  }

  useEffect(() => { void search(); }, []);
  const owned = useMemo(() => new Set(items.map((item) => clean(item.name))), [items]);
  const match = (recipe: Recipe) => recipe.ingredients.filter((ingredient) => [...owned].some((item) => item.includes(clean(ingredient.name)) || clean(ingredient.name).includes(item)));
  const rescuedNames = (recipe: Recipe) => match(recipe).filter((ingredient) => items.some((item) => item.useSoon && (clean(item.name).includes(clean(ingredient.name)) || clean(ingredient.name).includes(clean(item.name))))).map((ingredient) => ingredient.name);
  const rescueMatches = useMemo(() => recipes.filter((recipe) => match(recipe).some((ingredient) => items.some((item) => item.useSoon && (clean(item.name).includes(clean(ingredient.name)) || clean(ingredient.name).includes(clean(item.name)))))).sort((left, right) => match(right).length - match(left).length), [recipes, items, owned]);

  if (selected) {
    const coverage = importedRecipeGaps(selected.ingredients, items);
    const readyCount = selected.ingredients.length - coverage.gaps.length - coverage.needsAttention.length;
    return <section className="results recipe-detail">
      <button className="plain" onClick={() => setSelected(null)}>← Back to recipe discovery</button>
      <div className="recipe-detail-photo"><span>Photo unavailable</span>{selected.imageUrl && <img className="recipe-hero-image" src={selected.imageUrl} alt={selected.name} onError={(event) => { event.currentTarget.hidden = true; }} />}</div>
      <p className="eyebrow">TheMealDB recipe · {selected.cuisine ?? "Cuisine unavailable"}</p>
      <h2>{selected.name}</h2>
      <p className="muted">{selected.category ?? "Recipe"} · {readyCount}/{selected.ingredients.length} measured ingredients covered by your kitchen</p>
      <div className="recipe-detail-grid"><section><h3>What you’ll need</h3>{selected.ingredients.map((ingredient) => { const gap = importedRecipeGaps([ingredient], items); const status = gap.needsAttention.length ? "Check amount" : gap.gaps.length ? `Need ${gap.gaps[0].requiredQuantity} ${gap.gaps[0].unit}` : "Already have"; return <p key={ingredient.name} className={gap.gaps.length || gap.needsAttention.length ? "recipe-missing" : "recipe-owned"}><span>{ingredient.measure ?? "Amount unavailable"} {ingredient.name}</span><small>{status}</small></p>; })}</section><section><h3>How to make it</h3>{selected.instructions ? selected.instructions.split(/\r?\n/).filter(Boolean).map((step, index) => <p key={index}><b>{index + 1}.</b> {step}</p>) : <p className="muted">Instructions unavailable from the source.</p>}</section></div>
      <p className="muted">{selected.attribution} {selected.sourceUrl && <a href={selected.sourceUrl} target="_blank" rel="noreferrer">View original source ↗</a>}</p>
      <button className="primary" onClick={() => onCook(selected)}>Cook this recipe →</button>
      <p className="connection-state">{coverage.gaps.length + coverage.needsAttention.length} ingredients need shopping-list review. You approve the list before any shopping.</p>
    </section>;
  }

  return <section className="results recipe-discovery"><div className="section-heading"><div><p className="eyebrow">From TheMealDB</p><h2>More ways to rescue your food</h2></div><p className="muted">Only recipes matching your use-soon ingredients appear here.</p></div><div className="recipe-search"><input aria-label="Search real recipes" value={query} onChange={(event) => setQuery(event.target.value)} /><button className="secondary" disabled={state === "loading" || !query.trim()} onClick={() => void search()}>{state === "loading" ? "Finding recipes…" : "Search recipes"}</button></div>{state === "loading" && <p className="muted" role="status">Looking for recipes that fit your kitchen…</p>}{state === "error" && <div className="connection-error"><b>Live recipes are unavailable right now.</b> Try again, or use the Pantry Rescue meal ideas above.</div>}{state === "empty" && <p className="muted">No sourced recipes found. Try another expiring ingredient or use the meal ideas above.</p>}{state === "idle" && !rescueMatches.length && <p className="muted">No sourced recipe matches your expiring ingredients yet. The meal ideas above remain tailored to your pantry.</p>}<div className="sourced-recipe-grid">{rescueMatches.map((recipe) => <article className="sourced-recipe" key={recipe.id}><div className="recipe-photo"><span>Photo unavailable</span>{recipe.imageUrl && <img src={recipe.imageUrl} alt={recipe.name} loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />}</div><div><p className="eyebrow">{recipe.cuisine ?? "Cuisine unavailable"}</p><h3>{recipe.name}</h3><p>Rescues {rescuedNames(recipe).join(" + ")}</p><button className="plain" onClick={() => setSelected(recipe)}>View recipe →</button><small>{recipe.attribution}</small></div></article>)}</div></section>;
}
