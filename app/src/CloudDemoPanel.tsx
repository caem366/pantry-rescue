import { useEffect, useMemo, useState } from "react";
import { humanizeAgentEvent, mergeAgentEvents, type AgentProgressEvent } from "./lib/agentProgress";
import { selectProduct, type MissingIngredient, type ProductSelection, type ShoppingResult, type Unit } from "./lib/shoppingAgent";
import { apiFetch } from "./lib/api";

type CartItem = { id: string; name: string; size?: string; unitPrice?: number; quantity: number };
type Status = { configured: boolean; sessionActive: boolean; paused?: boolean; takeover?: boolean; viewerUrl?: string; message: string };
type Preview = { previewId: string; selections: ProductSelection[]; candidates?: { ingredientId: string; products: { id: string; name: string; size: string; price: number; available: boolean }[] }[]; results: ShoppingResult[]; events: AgentProgressEvent[]; screenshot?: string; viewerUrl: string };
type Run = { results: ShoppingResult[]; cartItems: CartItem[]; events: AgentProgressEvent[]; screenshot?: string; viewerUrl: string };
type Resume = { paused: boolean; takeover: boolean; cartItems: CartItem[]; screenshot?: string };
type TrackState = "queued" | "searching" | "found" | "waiting" | "adding" | "done" | "warn";
const identityCheck = (message: string) => /identity check|press and hold|captcha|verify you are human|real shoppers, not robots/i.test(message);

function candidateSelection(original: ProductSelection, candidate: NonNullable<Preview["candidates"]>[number]["products"][number]) {
  const match = candidate.size.match(/^(\d+(?:\.\d+)?)\s*(g|kg|mL|L|each)$/i);
  if (!match) return undefined;
  const unit = match[2].toLowerCase() === "ml" ? "mL" : match[2].toLowerCase() === "l" ? "L" : match[2].toLowerCase() === "each" ? "each" : match[2].toLowerCase() as Unit;
  return selectProduct(original.ingredient, [{ ...original.product, retailerProductId: candidate.id, name: candidate.name, packageQuantity: Number(match[1]), packageUnit: unit, price: candidate.price, available: candidate.available }]);
}

function groceryState(ingredient: MissingIngredient, events: AgentProgressEvent[], preview: Preview | null, run: Run | null, approvedIds: string[]): { state: TrackState; label: string } {
  const added = run?.results.find((result) => result.ingredient.id === ingredient.id);
  if (added?.status === "ADDED") return { state: "done", label: "In cart" };
  if (added) return { state: "warn", label: "Needs attention" };
  const failed = preview?.results.find((result) => result.ingredient.id === ingredient.id);
  if (failed) return { state: "warn", label: "Needs attention" };
  const selection = preview?.selections.find((item) => item.ingredient.id === ingredient.id);
  if (selection && approvedIds.includes(ingredient.id)) return { state: "waiting", label: "Approved" };
  if (selection) return { state: "waiting", label: "Waiting for approval" };
  const related = events.filter((event) => `${event.label} ${event.detail ?? ""}`.toLowerCase().includes(ingredient.ingredient.toLowerCase()));
  const latest = related.at(-1);
  if (latest?.status === "ACTIVE" && /adding/i.test(latest.label)) return { state: "adding", label: "Adding to cart" };
  if (latest?.status === "ACTIVE" && /searching|moving to/i.test(latest.label)) return { state: "searching", label: "Searching" };
  if (latest && /found possible matches/i.test(latest.label)) return { state: "found", label: "Found matches" };
  if (latest?.status === "FAILED" || latest?.status === "WARNING") return { state: "warn", label: "Needs attention" };
  return { state: "queued", label: "Queued" };
}

function Activity({ events }: { events: AgentProgressEvent[] }) {
  const visible = events.slice(-4).map(humanizeAgentEvent);
  return <section className="agent-progress" aria-live="polite">
    <p className="eyebrow">Shopping progress</p>
    {!visible.length && <p className="muted">Ready to look for your approved groceries.</p>}
    <div className="event-list">{visible.map((event, index) => <article className={`agent-event ${event.status.toLowerCase()}`} key={`${event.timestamp}-${index}`}><b>{event.status === "COMPLETE" ? "✓" : event.status === "ACTIVE" ? "●" : "!"}</b><div><strong>{event.label}</strong>{event.detail && <small>{event.detail}</small>}</div></article>)}</div>
  </section>;
}

function Receipt({ selection, status, approved, onApprove, onChooseAnother }: { selection: ProductSelection; status?: string; approved?: boolean; onApprove?: () => void; onChooseAnother?: () => void }) {
  return <article className="cloud-receipt">
    {selection.product.imageUrl && <img className="cloud-product-image" src={selection.product.imageUrl} alt="" loading="lazy" />}
    <div className="cloud-receipt-body"><p className="eyebrow">{status === "ADDED" ? "Verified in cart" : status === "NEEDS_ATTENTION" ? "Needs attention" : "Product match · approve before adding"}</p><strong>{selection.product.name}</strong>
      <small>Need {selection.ingredient.requiredQuantity} {selection.ingredient.unit} · {selection.product.packageQuantity} {selection.product.packageUnit} × {selection.quantity} · {selection.product.price === undefined ? "Price unavailable" : `$${selection.product.price.toFixed(2)} each · $${(selection.product.price * selection.quantity).toFixed(2)} total`}</small>
      <p><b>Why this one?</b> {selection.reason}</p>
      {onApprove && <div className="cloud-approval-actions"><button type="button" className={approved ? "secondary" : "primary"} aria-pressed={Boolean(approved)} onClick={onApprove}>{approved ? "Approved ✓" : "Approve product"}</button><button type="button" className="plain" onClick={onChooseAnother}>Choose another</button></div>}
    </div>
  </article>;
}

export default function CloudDemoPanel({ ingredients, onSessionChange, retailer = "demo" }: { ingredients: MissingIngredient[]; onSessionChange?: (active: boolean) => void; retailer?: "demo" | "walmart" }) {
  const isWalmart = retailer === "walmart";
  const endpoint = `/api/shopping/cloud-${isWalmart ? "walmart" : "demo"}`;
  const storeName = isWalmart ? "Walmart Canada" : "Demo Market";
  const [status, setStatus] = useState<Status | null>(null);
  const [location, setLocation] = useState("");
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [viewerUrl, setViewerUrl] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [approvedProductIds, setApprovedProductIds] = useState<string[]>([]);
  const [chosenProductIds, setChosenProductIds] = useState<Record<string, string>>({});
  const [alternativesFor, setAlternativesFor] = useState<string | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [resume, setResume] = useState<Resume | null>(null);
  const [events, setEvents] = useState<AgentProgressEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [controlBusy, setControlBusy] = useState(false);
  const [connectionLost, setConnectionLost] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { void apiFetch(`${endpoint}/status`).then(async (response) => { const next = await response.json() as Status; setStatus(next); onSessionChange?.(next.sessionActive); if (next.viewerUrl) setViewerUrl(next.viewerUrl); }).catch(() => setError("The shopping service is unavailable.")); }, [endpoint, onSessionChange]);
  useEffect(() => {
    if (!viewerUrl) return;
    let active = true;
    let failures = 0;
    const poll = () => { void apiFetch(`${endpoint}/events`).then(async (response) => {
      if (response.ok && active) {
        failures = 0; setConnectionLost(false);
        const payload = await response.json() as { events: AgentProgressEvent[] };
        setEvents((current) => mergeAgentEvents(current, payload.events));
      }
      if (response.status === 409 && active) {
        setError("The cloud browser session expired or disconnected. Start a new session before shopping further.");
        setViewerUrl("");
        setPreview(null);
        setStatus((current) => current ? { ...current, sessionActive: false } : current);
        onSessionChange?.(false);
      }
      if (!response.ok && response.status !== 409 && active && ++failures >= 3) setConnectionLost(true);
    }).catch(() => { if (active && ++failures >= 3) setConnectionLost(true); }); };
    poll();
    const timer = window.setInterval(poll, 600);
    return () => { active = false; window.clearInterval(timer); };
  }, [viewerUrl, onSessionChange, endpoint]);
  async function request(path: string, body: unknown) {
    const response = await apiFetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json() as { error?: string };
    if (!response.ok) throw new Error(payload.error ?? `Cloud browser request failed (${response.status}).`);
    return payload;
  }
  async function startSession() {
    setLoading(true); setError("");
    try { const response = await request(`${endpoint}/session`, {}) as Status; setViewerUrl(response.viewerUrl ?? ""); setConnectionLost(false); setStatus((current) => ({ ...current, ...response, sessionActive: true })); onSessionChange?.(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Shopping browser could not start."); }
    finally { setLoading(false); }
  }
  async function findProducts() {
    setLoading(true); setError(""); setRun(null); setResume(null);
    try {
      const next = await request(`${endpoint}/preview`, isWalmart ? { ingredients, postalCode: location, locationConfirmed } : { ingredients, deliveryLocation: location }) as Preview;
      setPreview(next); setApprovedProductIds([]); setChosenProductIds({}); setAlternativesFor(null); setEvents((current) => mergeAgentEvents(current, next.events));
      if (isWalmart && next.results.some((result) => identityCheck(result.message ?? ""))) {
        setStatus((current) => current ? { ...current, paused: true, takeover: true } : current);
        setError("Walmart needs you to verify you're human. Pantry Rescue is paused; take over the browser to continue.");
      }
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Cloud browser product search failed."); }
    finally { setLoading(false); }
  }
  async function buildCart() {
    if (!preview || connectionLost || preview.selections.some((selection) => !approvedProductIds.includes(selection.ingredient.id))) return;
    const selections = preview.selections.map((original) => {
      const chosenId = chosenProductIds[original.ingredient.id];
      const candidate = preview.candidates?.find((group) => group.ingredientId === original.ingredient.id)?.products.find((product) => product.id === chosenId);
      return candidate ? candidateSelection(original, candidate) : original;
    });
    if (selections.some((selection) => !selection)) return;
    setLoading(true); setError("");
    try { const next = await request(`${endpoint}/build`, { previewId: preview.previewId, approvedIngredientIds: preview.selections.map((selection) => selection.ingredient.id), approvedProducts: selections.map((selection) => ({ ingredientId: selection!.ingredient.id, retailerProductId: selection!.product.retailerProductId })) }) as Run; setRun({ ...next, results: [...preview.results, ...next.results] }); setEvents((current) => mergeAgentEvents(current, next.events)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Cloud browser cart build failed."); }
    finally { setLoading(false); }
  }
  async function pause(takeover: boolean) {
    setControlBusy(true); setError("");
    try { const next = await request(`${endpoint}/pause`, { takeover }) as Status; setStatus((current) => ({ ...current, ...next })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The agent could not pause."); }
    finally { setControlBusy(false); }
  }
  async function resumeAgent() {
    setControlBusy(true); setError("");
    try { const next = await request(`${endpoint}/resume`, {}) as Resume; setResume(next); setStatus((current) => current ? { ...current, paused: false, takeover: false } : current); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The agent could not resume."); }
    finally { setControlBusy(false); }
  }
  async function release() {
    setControlBusy(true); setError("");
    try { await request(`${endpoint}/release`, {}); setViewerUrl(""); setPreview(null); setRun(null); setResume(null); setEvents([]); setChosenProductIds({}); setAlternativesFor(null); setStatus((current) => current ? { ...current, sessionActive: false, paused: false, takeover: false } : current); onSessionChange?.(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Cloud browser session could not be cancelled."); }
    finally { setControlBusy(false); }
  }

  const paused = Boolean(status?.paused);
  const reviewedSelections = preview?.selections.map((original) => {
    const chosenId = chosenProductIds[original.ingredient.id];
    const candidate = preview.candidates?.find((group) => group.ingredientId === original.ingredient.id)?.products.find((product) => product.id === chosenId);
    return candidate ? candidateSelection(original, candidate) ?? original : original;
  }) ?? [];
  const previewTotal = reviewedSelections.reduce((total, selection) => total + (selection.product.price ?? 0) * selection.quantity, 0);
  const verifiedCount = run?.results.filter((result) => result.status === "ADDED").length ?? 0;
  const cartReady = Boolean(run && run.results.length === ingredients.length && verifiedCount === ingredients.length);
  const latest = events.at(-1);
  const headline = latest ? humanizeAgentEvent(latest).label : viewerUrl ? "Live shopping browser ready" : "Ready to shop";
  const tracker = useMemo(() => ingredients.map((ingredient) => ({ ingredient, ...groceryState(ingredient, events, preview, run, approvedProductIds) })), [ingredients, events, preview, run, approvedProductIds]);
  const searchDisabled = loading || paused || connectionLost || !location.trim() || (isWalmart && (!/^[A-Z]\d[A-Z][ -]?\d[A-Z]\d$/i.test(location.trim()) || !locationConfirmed));
  const workspaceActions = <>
    {isWalmart && viewerUrl && <div><label className="product-approval"><input type="checkbox" checked={locationConfirmed} onChange={(event) => setLocationConfirmed(event.target.checked)} /> I selected my store or delivery area in the live Walmart browser.</label><small className="shop-secondary-note">Local stock has not been independently verified.</small></div>}
    {resume && <section className="cart-review"><h3>Fresh cart inspection</h3>{resume.cartItems.length ? resume.cartItems.map((item) => <p key={item.id}><b>{item.name}</b><span>Qty {item.quantity}</span></p>) : <p><span>The cart is empty.</span></p>}</section>}
    {!preview && <button className="primary" disabled={searchDisabled} onClick={() => void findProducts()}>{loading ? `Searching ${storeName}…` : "Search approved products →"}</button>}
    {preview && !run && <>
      <section className="cloud-receipts" aria-label="Exact products found in cloud browser">
        <h3>Review product matches</h3><p className="muted">Nothing enters the cart until you approve each exact product.</p>
        {reviewedSelections.map((selection) => {
          const options = preview.candidates?.find((group) => group.ingredientId === selection.ingredient.id)?.products.filter((candidate) => candidate.id !== selection.product.retailerProductId && candidateSelection(selection, candidate)) ?? [];
          return <div key={selection.ingredient.id}>
            <Receipt selection={selection} approved={approvedProductIds.includes(selection.ingredient.id)} onApprove={paused || loading || connectionLost ? undefined : () => setApprovedProductIds((current) => current.includes(selection.ingredient.id) ? current.filter((id) => id !== selection.ingredient.id) : [...current, selection.ingredient.id])} onChooseAnother={paused || loading || connectionLost ? undefined : () => setAlternativesFor((current) => current === selection.ingredient.id ? null : selection.ingredient.id)} />
            {alternativesFor === selection.ingredient.id && <div className="cloud-alternatives"><p className="eyebrow">Other suitable products found</p>{options.length ? options.map((candidate) => <button type="button" key={candidate.id} onClick={() => { setChosenProductIds((current) => ({ ...current, [selection.ingredient.id]: candidate.id })); setApprovedProductIds((current) => current.filter((id) => id !== selection.ingredient.id)); setAlternativesFor(null); }}>{candidate.name} · {candidate.size} · ${candidate.price.toFixed(2)} <b>Choose this</b></button>) : <p className="muted">No other suitable match was found. <button type="button" className="plain" onClick={() => void findProducts()}>Search again</button></p>}</div>}
          </div>;
        })}
        {preview.results.map((result) => <p className="connection-error" key={result.ingredient.id}>{result.ingredient.ingredient}: {isWalmart && identityCheck(result.message ?? "") ? "Identity verification needed. Take over the browser to continue." : result.message ?? "Needs your attention"}</p>)}
      </section>
      <p className="muted">Estimated {storeName} product subtotal: <b>${previewTotal.toFixed(2)}</b>. Local stock, taxes, and delivery fees are not verified.</p>
      <button className="primary" disabled={loading || paused || connectionLost || !preview.selections.length || approvedProductIds.length !== preview.selections.length} onClick={() => void buildCart()}>{loading ? "Rechecking and adding…" : `Add approved products to ${isWalmart ? "Walmart" : "demo"} cart →`}</button>
    </>}
    {run && <>
      <section className="cloud-receipts" aria-label="Verified shopping receipts">{run.results.map((result) => result.selection ? <Receipt selection={result.selection} status={result.status} key={result.ingredient.id} /> : <p className="connection-error" key={result.ingredient.id}>{result.ingredient.ingredient}: {result.message ?? "Needs your attention"}</p>)}</section>
      <section className="cart-review"><h3>{cartReady ? "Your cart is ready" : "Your cart needs a final review"}</h3><strong>{verifiedCount}/{ingredients.length} groceries verified</strong>{run.cartItems.map((item) => <p key={item.id}><b>{item.name}</b><span>{item.size ? `${item.size} · ` : ""}Qty {item.quantity}{item.unitPrice === undefined ? "" : ` · $${(item.unitPrice * item.quantity).toFixed(2)}`}</span></p>)}<small>Pantry Rescue stops here. You control checkout, delivery, and payment.</small></section>
      {run.screenshot && <figure className="cart-evidence"><img src={run.screenshot} alt="Final browser cart captured after cart verification" /><figcaption>Final browser cart · captured after the agent's cart inspection</figcaption></figure>}
      {cartReady && (!paused ? <button className="primary" disabled={controlBusy} onClick={() => void pause(true)}>{controlBusy ? "Handing over…" : isWalmart ? "Take over & checkout →" : "Take over & review cart →"}</button> : <a className="primary" href={viewerUrl} target="_blank" rel="noreferrer">Open browser to {isWalmart ? "check out" : "review cart"} ↗</a>)}
      {run.results.some((result) => result.status !== "ADDED") && <button className="plain" disabled={loading || paused || connectionLost} onClick={() => void findProducts()}>Retry safely: search fresh products</button>}
    </>}
  </>;
  const advanced = <details className="advanced-details"><summary>Advanced details</summary><p>{status?.message}</p>{events.length ? <ol>{events.map((event, index) => <li key={`${event.timestamp}-${index}`}>{event.status} · {event.stage} · {event.label}{event.detail ? ` — ${event.detail}` : ""}</li>)}</ol> : <p>No raw agent events yet.</p>}{Boolean(preview?.candidates?.length) && <div><p>Products the agent inspected</p>{preview?.candidates?.map((group) => <div key={group.ingredientId}><b>{ingredients.find((item) => item.id === group.ingredientId)?.ingredient}</b>{group.products.map((product) => <p key={product.id}>{product.name} · {product.size} · ${product.price.toFixed(2)} {product.available ? "" : "· Unavailable"}</p>)}</div>)}</div>}{(preview?.screenshot || run?.screenshot || resume?.screenshot) && <img className="cloud-screenshot" src={run?.screenshot ?? resume?.screenshot ?? preview?.screenshot} alt="Cloud browser evidence" />}</details>;

  if (!status?.configured) {
    return <section className="results retailer-choice cloud-agent" aria-labelledby="cloud-demo-title">
      <p className="eyebrow">{isWalmart ? "Experimental live retailer · Walmart Canada" : "Supported browser-agent demo · Demo Market"}</p>
      <h2 id="cloud-demo-title">{isWalmart ? "Walmart live agent" : "Demo Market live agent"}</h2>
      <p className="connection-state">The cloud shopping browser is unavailable right now. Your approved shopping list is still ready for review.</p>
    </section>;
  }

  if (!viewerUrl) {
    return <section className="results retailer-choice cloud-agent" aria-labelledby="cloud-demo-title">
      <p className="eyebrow">{isWalmart ? "Experimental live retailer · Walmart Canada" : "Supported browser-agent demo · Demo Market"}</p>
      <h2 id="cloud-demo-title">{isWalmart ? "Walmart live agent" : "Demo Market live agent"}</h2>
      <p className="muted">Review exact product choices before anything enters the {isWalmart ? "Walmart" : "demo"} cart. Checkout is never submitted.</p>
      {isWalmart && <><p className="connection-state"><b>Walmart may ask you to verify you're human.</b><br />Pantry Rescue will pause and let you take over if that happens.</p><p className="muted">Choose your Walmart store or delivery area in the live browser before the agent starts searching.</p><small className="shop-secondary-note">Local stock has not been independently verified.</small></>}
      {error && <p className="connection-error" role="alert">{error}</p>}
      <label className="demo-search">{isWalmart ? "Canadian postal code" : "Delivery location for this task"}<input value={location} onChange={(event) => { setLocation(event.target.value); setLocationConfirmed(false); }} placeholder={isWalmart ? "L6H 1A1" : "e.g. Toronto, ON"} /></label>
      <button className="primary" disabled={loading} onClick={() => void startSession()}>{loading ? "Opening browser…" : "Start live shopping agent →"}</button>
      {events.length > 0 && <Activity events={events} />}
      {advanced}
    </section>;
  }

  return <section className="shopping-workspace cloud-agent" aria-labelledby="live-shop-title">
    <div className="browser-stage">
      <div className="browser-stage-head"><span>Live shopping browser</span><a href={viewerUrl} target="_blank" rel="noreferrer">Open live browser ↗</a></div>
      <iframe className="cloud-viewer" src={viewerUrl} title={`Live ${storeName} shopping browser`} referrerPolicy="no-referrer" />
      <p className="muted">{isWalmart ? "Choose your Walmart store or delivery area in the live browser before the agent starts searching." : "If the preview is unavailable, open the live browser in a new tab."}</p>
    </div>
    <aside className="agent-sidebar" aria-label="Shopping agent controls and progress">
      <p className="eyebrow">{storeName}</p>
      <h2 id="live-shop-title">{isWalmart ? "Walmart live agent" : "Demo Market live agent"}</h2>
      <p className={`connection-state ${paused ? "" : "connected"}`}>{paused ? "Agent paused — you control the live browser." : headline}</p>
      {connectionLost && <p className="connection-error" role="alert">The live browser connection is unavailable. Cart changes are disabled until Pantry Rescue reconnects; any in-progress action needs fresh verification.</p>}
      {error && <p className="connection-error" role="alert">{error}</p>}
      <label className="demo-search">{isWalmart ? "Canadian postal code" : "Delivery location for this task"}<input value={location} onChange={(event) => { setLocation(event.target.value); setLocationConfirmed(false); }} placeholder={isWalmart ? "L6H 1A1" : "e.g. Toronto, ON"} /></label>
      <div className="cloud-controls">{!paused ? <><button className="plain" disabled={controlBusy} onClick={() => void pause(true)}>Take over</button><button className="plain" disabled={controlBusy} onClick={() => void pause(false)}>Pause</button></> : <><button className="primary" disabled={loading || controlBusy} onClick={() => void resumeAgent()}>{controlBusy ? "Inspecting cart…" : "Resume agent"}</button>{status?.takeover && <a className="plain" href={viewerUrl} target="_blank" rel="noreferrer">Open browser ↗</a>}</>}<button className="plain danger" disabled={loading || controlBusy} onClick={() => void release()}>Cancel</button></div>
      <section className="grocery-tracker" aria-label="Grocery item tracker">
        <p className="eyebrow">Grocery list</p>
        {tracker.map(({ ingredient, state, label }) => <article className={`grocery-track-item ${state}`} key={ingredient.id}><b>{ingredient.ingredient}</b><span>{label}</span></article>)}
      </section>
      <Activity events={events} />
      {workspaceActions}
      {advanced}
    </aside>
  </section>;
}
