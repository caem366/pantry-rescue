import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import "./index.css";
import "./consumer.css";
import PlannerPanel from "./PlannerPanel";
import DemoMarket from "./DemoMarket";
import { rescueRecipes } from "./lib/rescuePlan";

type Zone = "Fridge" | "Freezer" | "Pantry";
type PantryItem = {
  id: string;
  name: string;
  quantity: string;
  zone: Zone;
  useSoon: boolean;
  daysLeft?: number;
  expiresOn?: string;
};
const key = "pantry-rescue-inventory";
const demoKey = "pantry-rescue-sample-active";
const personalKey = "pantry-rescue-personal-inventory";
const futureDate = (days: number) => { const date = new Date(); date.setDate(date.getDate() + days); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };
const daysUntil = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  const today = new Date();
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86_400_000);
};
const sample = (): PantryItem[] => [
  {
    id: "mushrooms",
    name: "Cremini mushrooms",
    quantity: "200 g",
    zone: "Fridge",
    useSoon: true,
    daysLeft: 1,
    expiresOn: futureDate(1),
  },
  {
    id: "spinach",
    name: "Baby spinach",
    quantity: "150 g",
    zone: "Fridge",
    useSoon: true,
    daysLeft: 2,
    expiresOn: futureDate(2),
  },
  {
    id: "cream",
    name: "Heavy cream",
    quantity: "250 mL",
    zone: "Fridge",
    useSoon: true,
    daysLeft: 3,
    expiresOn: futureDate(3),
  },
  {
    id: "berries",
    name: "Frozen berries",
    quantity: "1 bag",
    zone: "Freezer",
    useSoon: false,
  },
  {
    id: "pasta",
    name: "Penne pasta",
    quantity: "1 box",
    zone: "Pantry",
    useSoon: false,
  },
  {
    id: "chickpeas",
    name: "Chickpeas",
    quantity: "2 cans",
    zone: "Pantry",
    useSoon: false,
  },
  {
    id: "tomatoes",
    name: "Crushed tomatoes",
    quantity: "1 can",
    zone: "Pantry",
    useSoon: false,
  },
  {
    id: "tortillas",
    name: "Flour tortillas",
    quantity: "1 pack",
    zone: "Pantry",
    useSoon: false,
  },
];
function read(): PantryItem[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [demoMarket, setDemoMarket] = useState(() => window.location.hash.startsWith("#demo-market"));
  const [items, setItems] = useState<PantryItem[]>(read);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [zone, setZone] = useState<Zone>("Fridge");
  const [soon, setSoon] = useState(false);
  const [days, setDays] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [demoLoaded, setDemoLoaded] = useState(() => localStorage.getItem(demoKey) === "1");
  const [planning, setPlanning] = useState(() => window.location.hash.startsWith("#planner"));
  useEffect(() => localStorage.setItem(key, JSON.stringify(items)), [items]);
  const inventory = useMemo(() => items.map((item) => {
    const daysLeft = item.expiresOn ? daysUntil(item.expiresOn) : item.daysLeft;
    return { ...item, daysLeft, useSoon: item.useSoon || (daysLeft !== undefined && daysLeft <= 3) };
  }), [items]);
  const groups = useMemo(
    () =>
      ["Fridge", "Freezer", "Pantry"].map((zone) => ({
        zone: zone as Zone,
        items: inventory.filter((item) => item.zone === zone),
      })),
    [inventory],
  );
  const urgent = inventory.filter((item) => item.useSoon).length;
  function reset() {
    setName("");
    setQuantity("");
    setZone("Fridge");
    setSoon(false);
    setDays("");
    setExpiresOn("");
    setEditing(null);
  }
  function save(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !quantity.trim()) {
      setNotice("Add an ingredient name and amount to save it.");
      return;
    }
    if (soon && !expiresOn && (!days || !Number.isInteger(Number(days)) || Number(days) < 1)) {
      setNotice("Add a use-by date, or enter at least one day for an ingredient that needs using soon.");
      return;
    }
    const expiryDays = expiresOn ? daysUntil(expiresOn) : undefined;
    const item: PantryItem = {
      id: editing || crypto.randomUUID(),
      name: name.trim(),
      quantity: quantity.trim(),
      zone,
      useSoon: soon || (expiryDays !== undefined && expiryDays <= 3),
      daysLeft: expiryDays ?? (soon && days ? Number(days) : undefined),
      expiresOn: expiresOn || undefined,
    };
    setItems((current) =>
      editing
        ? current.map((old) => (old.id === editing ? item : old))
        : [...current, item],
    );
    setNotice(
      editing ? `${item.name} updated.` : `${item.name} added to your kitchen.`,
    );
    reset();
  }
  function edit(item: PantryItem) {
    setName(item.name);
    setQuantity(item.quantity);
    setZone(item.zone);
    setSoon(item.useSoon);
    setDays(item.daysLeft?.toString() || "");
    setExpiresOn(item.expiresOn || "");
    setEditing(item.id);
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function loadSample() {
    if (!demoLoaded) {
      if (items.length && !window.confirm("Replace your current kitchen with the sample pantry? Your ingredients will be saved so you can return to them.")) return;
      localStorage.setItem(personalKey, JSON.stringify(items));
    }
    setItems(sample());
    setDemoLoaded(true);
    localStorage.setItem(demoKey, "1");
    reset();
    setNotice(
      demoLoaded ? "Sample pantry reset to today's quantities and use-by dates." : "Sample pantry loaded. You can still edit anything before planning.",
    );
  }
  function restorePersonal() {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(personalKey) || "[]");
      setItems(Array.isArray(saved) ? saved : []);
    } catch {
      setItems([]);
    }
    setDemoLoaded(false);
    localStorage.removeItem(demoKey);
    localStorage.removeItem(personalKey);
    reset();
    setNotice("Your personal kitchen is back.");
  }
  useEffect(() => {
    const syncRoute = () => setDemoMarket(window.location.hash.startsWith("#demo-market"));
    window.addEventListener("hashchange", syncRoute);
    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);
  function exitDemoMarket() {
    window.location.hash = "";
    setDemoMarket(false);
  }
  if (demoMarket) return <DemoMarket onExit={exitDemoMarket} />;
  if (planning) return <PlannerPanel items={inventory} onBack={() => { window.location.hash = ""; setPlanning(false); }} />;
  return (
    <main className="app consumer-app">
      <header>
        <a className="brand" href="#top">
          <b>P</b> Pantry Rescue
        </a>
        <span>Your kitchen, put to work</span>
      </header>
      <nav className="journey" aria-label="Your progress"><span className="current">1 <b>Rescue</b></span><span>2 <b>Plan</b></span><span>3 <b>Shop</b></span></nav>
      <section className="consumer-heading" id="top"><p className="eyebrow">Good food, put to work</p><h1>What needs using up?</h1><p>Add what you have. We’ll find a meal that uses it before it spoils.</p></section>
      <section className="setup">
        <div className="card">
          <div className="title">
            <i>01</i>
            <div>
            <p className="eyebrow">Start with what you have</p>
            <h2>{editing ? "Update an ingredient" : "Start with your kitchen"}</h2>
            </div>
          </div>
          <p className="muted">Add food that needs using soon, plus any staples you already own.</p>
          <form onSubmit={save}>
            <label>
              Ingredient
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Baby spinach"
              />
            </label>
            <label>
              Amount
              <input
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 1 bag"
              />
            </label>
            <label>
              Use-by date
              <input aria-label="Use-by date" type="date" value={expiresOn} onChange={(event) => { setExpiresOn(event.target.value); setSoon(false); }} />
            </label>
            <div className="row">
              <label>
                Where is it?
                <select
                  value={zone}
                  onChange={(e) => setZone(e.target.value as Zone)}
                >
                  <option>Fridge</option>
                  <option>Freezer</option>
                  <option>Pantry</option>
                </select>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={soon}
                  onChange={(e) => setSoon(e.target.checked)}
                />{" "}
                Needs rescuing soon?
              </label>
            </div>
            {soon && !expiresOn && (
              <label>
                About how many days?
                <input
                  type="number"
                  min="1"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  placeholder="2"
                />
              </label>
            )}
            <div className="actions">
              <button className="secondary">
                {editing ? "Save changes" : "Add to my kitchen"}
              </button>
              {editing && (
                <button type="button" className="plain" onClick={reset}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
        <aside className="sample-story">
          <div className="sample-photo"><img src={rescueRecipes[0].imageUrl} alt="Pasta with mushrooms and spinach" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} /><span>From what’s already in your fridge</span></div>
          <div className="sample-story-content"><p className="eyebrow">See how it works</p><h2>Tonight, sorted.</h2><p>Try mushrooms, spinach and cream nearing their use-by dates, plus five freezer and pantry staples.</p><div className="sample-actions"><button className="secondary" onClick={loadSample}>{demoLoaded ? "Reset sample pantry" : "Try the sample pantry"}</button>{demoLoaded && <button className="plain" onClick={restorePersonal}>Return to my kitchen</button>}</div><small>Photo: <a href={rescueRecipes[0].imageCreditUrl} target="_blank" rel="noreferrer">{rescueRecipes[0].imageCredit}</a> · Unsplash License</small></div>
        </aside>
      </section>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <section className="plan"><div><p className="eyebrow">Next up</p><h2>{urgent ? `${urgent} ingredient${urgent === 1 ? "" : "s"} expiring soon · ${items.length} ingredient${items.length === 1 ? "" : "s"} available` : "Add food with a use-by date to begin."}</h2><p>{urgent ? "We’ll build meals around these ingredients and shop for only the gaps." : "We’ll build meals around the food that needs using first."}</p></div><button className="primary" disabled={!urgent} onClick={() => { window.location.hash = "planner"; setPlanning(true); }}>Find rescue meals →</button></section>
      <section className="inventory">
        <div className="inventoryHead">
          <div><p className="eyebrow">Your kitchen</p><h2>What you already have</h2></div>
          <div aria-live="polite"><b>{items.length}</b> ingredient{items.length === 1 ? "" : "s"} available · <b>{urgent}</b> expiring soon</div>
        </div>
        {!items.length ? (
          <div className="empty">
            <b>⌂</b>
            <h3>Your kitchen is waiting</h3>
            <p>
              Add a few groceries, or load the sample pantry to see what Pantry
              Rescue can do.
            </p>
          </div>
        ) : (
          <div className="zones">
            {groups.map((group) => (
              <section className="zone" key={group.zone}>
                <h3>
                  {group.zone}
                  <small>{group.items.length}</small>
                </h3>
                {group.items.length ? (
                  group.items.map((item) => (
                    <article key={item.id} className={item.useSoon ? "use-soon-item" : undefined}>
                      <span>
                        {item.zone === "Freezer"
                          ? "❄"
                          : item.zone === "Pantry"
                            ? "▦"
                            : "◒"}
                      </span>
                      <div>
                        <strong>{item.name}</strong>
                        <small>{item.quantity}</small>
                        {item.useSoon && (
                          <mark>
                            {item.daysLeft === undefined ? "Use soon" : item.daysLeft <= 0 ? "Use today" : `Use within ${item.daysLeft} day${item.daysLeft === 1 ? "" : "s"}`}
                          </mark>
                        )}
                      </div>
                      <nav>
                        <button aria-label={`Edit ${item.name}`} onClick={() => edit(item)}>Edit</button>
                        <button
                          aria-label={`Remove ${item.name}`}
                          onClick={() =>
                            setItems((old) =>
                              old.filter((entry) => entry.id !== item.id),
                            )
                          }
                        >
                          Remove
                        </button>
                      </nav>
                    </article>
                  ))
                ) : (
                  <p className="muted">Nothing here yet.</p>
                )}
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
