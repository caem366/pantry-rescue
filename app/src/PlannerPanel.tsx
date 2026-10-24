import { useMemo, useState } from "react";
import CloudDemoPanel from "./CloudDemoPanel";
import RecipeDiscovery, { type Recipe } from "./RecipeDiscovery";
import { apiFetch } from "./lib/api";
import { importedRecipeGaps } from "./lib/importedRecipe";
import { buildRescuePlan, rankRescueRecipes, rescueRecipes } from "./lib/rescuePlan";
import type { BasketOption } from "./lib/basketOptimizer";
import type { MissingIngredient, Unit } from "./lib/shoppingAgent";

type Item = { id: string; name: string; quantity: string; useSoon: boolean; daysLeft?: number };
type ActivePlan = { type: "curated"; ids: string[] } | { type: "imported"; recipe: Recipe };
type RetailerId = "walmart-ca" | "metro" | "voila" | "demo";
type Resolution = { quantity: string; unit: Unit };

const retailers: { id: RetailerId; name: string; capability: string; url?: string }[] = [
  { id: "demo", name: "Demo Market", capability: "Verified agent demo" },
  { id: "walmart-ca", name: "Walmart Canada", capability: "Experimental agent", url: "https://www.walmart.ca/" },
  { id: "metro", name: "Metro", capability: "Product matches only", url: "https://www.metro.ca/" },
  { id: "voila", name: "Voilà", capability: "Retailer handoff", url: "https://voila.ca/" },
];
const resolutionKey = (name: string, measure?: string) => `${name}:${measure ?? ""}`;

export default function PlannerPanel({ items, onBack }: { items: Item[]; onBack: () => void }) {
  const ranked = useMemo(() => rankRescueRecipes(items), [items]);
  const [plan, setPlan] = useState<ActivePlan>(() => ({ type: "curated", ids: ranked[0] ? [ranked[0].id] : [] }));
  const [step, setStep] = useState<"plan" | "review" | "shop">("plan");
  const [excluded, setExcluded] = useState<string[]>([]);
  const [quantityEdits, setQuantityEdits] = useState<Record<string, string>>({});
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});
  const [retailerId, setRetailerId] = useState<RetailerId | null>(null);
  const [postalCode, setPostalCode] = useState("");
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [observed, setObserved] = useState<BasketOption | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [agentSessionActive, setAgentSessionActive] = useState(false);

  const urgent = useMemo(() => items.filter((item) => item.useSoon).sort((a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity)), [items]);
  const curated = useMemo(() => plan.type === "curated" ? buildRescuePlan(items, rescueRecipes.filter((recipe) => plan.ids.includes(recipe.id))) : undefined, [items, plan]);
  const imported = useMemo(() => plan.type === "imported" ? importedRecipeGaps(plan.recipe.ingredients, items) : undefined, [items, plan]);
  const resolved = useMemo<MissingIngredient[]>(() => imported?.needsAttention.flatMap((ingredient) => {
    const key = resolutionKey(ingredient.name, ingredient.measure);
    const value = resolutions[key];
    const quantity = Number(value?.quantity);
    return value && Number.isFinite(quantity) && quantity > 0
      ? [{ id: `manual-${key.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`, ingredient: ingredient.name.toLowerCase(), requiredQuantity: quantity, unit: value.unit, searchTerms: [ingredient.name] }]
      : [];
  }) ?? [], [imported, resolutions]);
  const unresolved = imported?.needsAttention.filter((ingredient) => !resolved.some((gap) => gap.id === `manual-${resolutionKey(ingredient.name, ingredient.measure).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`)) ?? [];
  const gaps = useMemo(() => plan.type === "curated" ? curated?.gaps ?? [] : [...(imported?.gaps ?? []), ...resolved], [plan, curated, imported, resolved]);
  const shoppingList = useMemo(() => gaps.filter((gap) => !excluded.includes(gap.id)).map((gap) => ({ ...gap, requiredQuantity: quantityEdits[gap.id] === undefined ? gap.requiredQuantity : Number(quantityEdits[gap.id]) })), [gaps, excluded, quantityEdits]);
  const validList = shoppingList.length > 0 && shoppingList.every((gap) => Number.isFinite(gap.requiredQuantity) && gap.requiredQuantity > 0) && unresolved.length === 0;

  function changePlan(next: ActivePlan) {
    setPlan(next);
    setStep("plan");
    setExcluded([]);
    setQuantityEdits({});
    setResolutions({});
    setRetailerId(null);
    setObserved(null);
    setSearchError("");
  }

  function toggleMeal(id: string) {
    const ids = plan.type === "curated" ? plan.ids : [];
    changePlan({ type: "curated", ids: ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id] });
  }

  async function findProducts() {
    if (!retailerId || retailerId === "demo" || !validList) return;
    if (!/^[A-Z]\d[A-Z][ -]?\d[A-Z]\d$/i.test(postalCode.trim())) {
      setSearchError("Enter a valid Canadian postal code to continue.");
      return;
    }
    if (retailerId === "voila") return;
    setSearching(true);
    setSearchError("");
    setObserved(null);
    try {
      const response = await apiFetch("/api/shopping/canadian/compare", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: shoppingList, postalCode, fulfillment }),
      });
      if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("Product search is unavailable in this deployment.");
      const body = await response.json() as { options?: BasketOption[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Product search failed.");
      setObserved(body.options?.find((option) => option.retailerId === retailerId) ?? null);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Product search failed.");
    } finally {
      setSearching(false);
    }
  }

  const selectedRetailer = retailers.find((retailer) => retailer.id === retailerId);
  return <main className={`app consumer-app ${agentSessionActive ? "shopping-live" : ""}`}>
    <header><a className="brand" href="#top"><b>P</b> Pantry Rescue</a><button className="plain" disabled={agentSessionActive} onClick={onBack}>Edit my kitchen</button></header>
    <nav className="journey" aria-label="Your progress"><button className="done" disabled={agentSessionActive} onClick={onBack}>1 <b>Rescue</b></button><button className={step === "plan" ? "current" : "done"} disabled={agentSessionActive} onClick={() => setStep("plan")}>2 <b>Plan</b></button><span className={step === "plan" ? "" : "current"}>3 <b>Shop</b>{step === "review" && <small>Review list</small>}</span></nav>
    {step === "plan" && <>
      <div className="consumer-heading"><p className="eyebrow">Your rescue plan</p><h1>Good meals for what you have.</h1><p>{urgent.length ? `${urgent.length} ingredient${urgent.length === 1 ? "" : "s"} to rescue, starting with ${urgent[0].name}.` : "Add a use-by date in your kitchen to get rescue recommendations."}</p></div>
      <div className="rescue-chips">{urgent.map((item) => <span key={item.id}>{item.name} <b>{item.daysLeft === undefined ? "Use soon" : item.daysLeft <= 0 ? "Use today" : `${item.daysLeft} day${item.daysLeft === 1 ? "" : "s"}`}</b></span>)}</div>
      {ranked.length ? <section className="results consumer-section"><div className="section-heading"><div><p className="eyebrow">Suggested for your kitchen</p><h2>Meals that rescue your food</h2></div><p className="muted">Suggestions use food expiring soon and keep extra purchases small.</p></div><div className="mealgrid">{ranked.map((recipe) => {
        const selected = plan.type === "curated" && plan.ids.includes(recipe.id);
        const rescued = urgent.filter((item) => recipe.ingredients.some((ingredient) => [ingredient.ingredient, ...(ingredient.aliases ?? [])].some((name) => name.toLowerCase().includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(name.toLowerCase()))));
        const missing = buildRescuePlan(items, [recipe]).gaps.length;
        return <article className={`meal ${selected ? "chosen" : ""}`} key={recipe.id}><div className="mealimg"><span className="image-fallback">Photo unavailable</span>{recipe.imageUrl && <img src={recipe.imageUrl} alt={recipe.name} loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />}<span className="meal-photo-badge">{rescued.length} use-soon rescued</span></div><div className="meal-content"><p className="eyebrow">{recipe.rescue}</p><h3>{recipe.name}</h3><p className="meal-summary">Uses {rescued.map((item) => item.name).join(" + ")} before it spoils.</p><div className="meal-facts"><span>{missing} to buy</span><span>{recipe.ingredients.length - missing} covered by your kitchen</span></div><details><summary>View ingredients & method</summary><ul>{recipe.ingredients.map((ingredient) => <li key={ingredient.ingredient}>{ingredient.quantity} {ingredient.unit} {ingredient.ingredient}</li>)}</ul><ol>{recipe.instructions?.map((instruction) => <li key={instruction}>{instruction}</li>)}</ol></details>{recipe.imageCredit && <small className="photo-credit">Photo: <a href={recipe.imageCreditUrl} target="_blank" rel="noreferrer">{recipe.imageCredit}</a> · Unsplash License</small>}<button className={selected ? "secondary" : "primary"} aria-pressed={selected} onClick={() => toggleMeal(recipe.id)}>{selected ? "Selected · Remove meal" : "Add to meal plan"}</button></div></article>;
      })}</div></section> : <section className="results consumer-section"><h2>No strong rescue meal found yet</h2><p>Try adding more food you need to use, or search the sourced recipes below.</p></section>}
      <RecipeDiscovery items={items} onCook={(recipe) => { changePlan({ type: "imported", recipe }); setStep("review"); }} />
      <div className="consumer-next"><p>{plan.type === "imported" ? plan.recipe.name : `${plan.ids.length} meal${plan.ids.length === 1 ? "" : "s"} selected`} · {gaps.length} grocery gaps</p><button className="primary" disabled={plan.type === "curated" && !plan.ids.length} onClick={() => setStep("review")}>Review missing ingredients →</button></div>
    </>}
    {step === "review" && <>
      <div className="consumer-heading"><p className="eyebrow">Step 3 · Shopping list</p><h1>Only buy what you need.</h1><p>Pantry Rescue subtracted the amounts in your kitchen from the selected meal{plan.type === "curated" && plan.ids.length > 1 ? "s" : ""}.</p></div>
      <section className="results consumer-section"><div className="review-top"><div><p className="eyebrow">Your meal plan</p><h2>{plan.type === "imported" ? plan.recipe.name : rescueRecipes.filter((recipe) => plan.ids.includes(recipe.id)).map((recipe) => recipe.name).join(" + ")}</h2>{plan.type === "imported" && <p>{plan.recipe.attribution} {plan.recipe.sourceUrl && <a href={plan.recipe.sourceUrl} target="_blank" rel="noreferrer">Original recipe ↗</a>}</p>}</div><button className="plain" onClick={() => setStep("plan")}>Change meals</button></div>
        {Boolean(imported?.needsAttention.length) && <div className="attention-box"><h3>Check these measurements</h3><p>The recipe did not give a shop ready amount. Enter one before approving.</p>{imported?.needsAttention.map((ingredient) => { const key = resolutionKey(ingredient.name, ingredient.measure); const value = resolutions[key] ?? { quantity: "", unit: "each" as Unit }; return <div className="measure-row" key={key}><span>{ingredient.name} · {ingredient.measure ?? "amount unavailable"}</span><input aria-label={`Quantity for ${ingredient.name}`} type="number" min="0.01" step="any" value={value.quantity} onChange={(event) => setResolutions((current) => ({ ...current, [key]: { ...value, quantity: event.target.value } }))} /><select aria-label={`Unit for ${ingredient.name}`} value={value.unit} onChange={(event) => setResolutions((current) => ({ ...current, [key]: { ...value, unit: event.target.value as Unit } }))}><option value="each">each</option><option value="g">g</option><option value="mL">mL</option></select></div>; })}</div>}
        {gaps.length ? <div className="review-list">{gaps.map((gap) => <div className={`review-item ${excluded.includes(gap.id) ? "muted-item" : ""}`} key={gap.id}><label className="review-item-choice"><input type="checkbox" checked={!excluded.includes(gap.id)} onChange={() => setExcluded((current) => current.includes(gap.id) ? current.filter((id) => id !== gap.id) : [...current, gap.id])} /><span><b>{gap.ingredient}</b><small>Need {gap.requiredQuantity} {gap.unit} after pantry</small></span></label><input aria-label={`Amount to buy for ${gap.ingredient}`} type="number" min="0.01" step="any" disabled={excluded.includes(gap.id)} value={quantityEdits[gap.id] ?? gap.requiredQuantity} onChange={(event) => setQuantityEdits((current) => ({ ...current, [gap.id]: event.target.value }))} /><em>{gap.unit}</em></div>)}</div> : <p>You already have everything for this plan. No shopping needed.</p>}
        <div className="consumer-next"><p>{shoppingList.length} item{shoppingList.length === 1 ? "" : "s"} selected · Checkout always stays with you.</p><button className="primary" disabled={!validList} onClick={() => { setRetailerId(null); setObserved(null); setStep("shop"); }}>Approve shopping list →</button></div>
      </section>
    </>}
    {step === "shop" && <>
      {!agentSessionActive && <>
        <div className="consumer-heading"><p className="eyebrow">Step 4 · Shop</p><h1>Shopping with Pantry Rescue.</h1><p>{shoppingList.length} approved ingredient{shoppingList.length === 1 ? "" : "s"}. Choose a shopping path, then watch the agent work where browser access is supported.</p></div>
        <div className="consumer-next"><p>{shoppingList.map((gap) => `${gap.ingredient} ${gap.requiredQuantity} ${gap.unit}`).join(" · ")}</p><button className="plain" onClick={() => { setStep("review"); setObserved(null); }}>Edit shopping list</button></div>
        <section className="results consumer-section"><div className="section-heading"><div><p className="eyebrow">Choose your store</p><h2>Where would you like to shop?</h2></div><p className="muted">Demo Market is the verified agent demo. Other stores have limited support.</p></div><div className="retailer-grid">{retailers.map((retailer) => <button className={`retailer-option ${retailer.id} ${retailerId === retailer.id ? "selected" : ""}`} key={retailer.id} aria-pressed={retailerId === retailer.id} onClick={() => { setRetailerId(retailer.id); setObserved(null); setSearchError(""); }}><span className={`retailer-mark ${retailer.id}`}>{retailer.name[0]}</span><span><strong>{retailer.name}</strong><small>{retailer.capability}</small></span><span className="retailer-arrow" aria-hidden="true">→</span></button>)}</div></section>
      </>}
      {retailerId === "demo" && <CloudDemoPanel ingredients={shoppingList} onSessionChange={setAgentSessionActive} />}
      {retailerId === "walmart-ca" && <CloudDemoPanel retailer="walmart" ingredients={shoppingList} onSessionChange={setAgentSessionActive} />}
      {!agentSessionActive && retailerId && retailerId !== "demo" && retailerId !== "walmart-ca" && <section className="results consumer-section" aria-label={`${selectedRetailer?.name} shopping support`}>
        <p className="eyebrow">{selectedRetailer?.name} · limited support</p>
        <h2>Browser-agent cart building is not available here yet.</h2>
        <p className="muted">Pantry Rescue has not opened a Steel session or changed this retailer's cart. {retailerId === "voila" ? "Product discovery is not connected for this store." : "We can check observed product listings and prices, but these are not live store searches or verified local stock."} You can take over at the retailer with your approved list.</p>
        {retailerId !== "voila" && <>
          <div className="location-fields"><label>Canadian postal code<input aria-label="Canadian postal code" value={postalCode} onChange={(event) => setPostalCode(event.target.value.toUpperCase())} placeholder="M5V 1A1" maxLength={7} /></label><label>How will you shop?<select aria-label="Fulfillment preference" value={fulfillment} onChange={(event) => setFulfillment(event.target.value as "pickup" | "delivery")}><option value="pickup">Pickup</option><option value="delivery">Delivery</option></select></label></div>
          <button className="secondary" disabled={searching} onClick={() => void findProducts()}>{searching ? "Checking observed listings…" : `Check observed listings for ${selectedRetailer?.name} →`}</button>
          {searchError && <p className="connection-error" role="alert">{searchError}</p>}
          {observed && <div className="product-handoff"><h3>{observed.matchedIngredientCount}/{observed.totalIngredientCount} observed matches</h3><p>Estimated observed subtotal: ${observed.estimatedTotal.toFixed(2)} CAD · Local stock and cart unverified</p>{observed.selections.map((selection) => <article className="product-match" key={selection.ingredient.id}>{selection.product.imageUrl && <img src={selection.product.imageUrl} alt="" />}<div><b>{selection.product.name}</b><small>For {selection.ingredient.ingredient} · {selection.quantity} × {selection.product.packageSizeLabel ?? `${selection.product.packageQuantity ?? "?"} ${selection.product.packageUnit ?? ""}`} · {selection.product.price === undefined ? "Price unavailable" : `$${selection.product.price.toFixed(2)} CAD observed`}</small></div>{selection.product.sourceUrl && <a href={selection.product.sourceUrl} target="_blank" rel="noreferrer">Review product ↗</a>}</article>)}{observed.warnings.map((warning) => <p className="muted" key={warning}>{warning}</p>)}</div>}
        </>}
        <a className="plain retailer-handoff" href={selectedRetailer?.url} target="_blank" rel="noreferrer">Take over at {selectedRetailer?.name} ↗</a>
      </section>}
    </>}
  </main>;
}
