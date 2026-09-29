import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import "./index.css";
import PlannerPanel from "./PlannerPanel";

type Zone = "Fridge" | "Freezer" | "Pantry";
type PantryItem = {
  id: string;
  name: string;
  quantity: string;
  zone: Zone;
  useSoon: boolean;
  daysLeft?: number;
};
const key = "pantry-rescue-inventory";
const sample: PantryItem[] = [
  {
    id: "spinach",
    name: "Baby spinach",
    quantity: "1 bag",
    zone: "Fridge",
    useSoon: true,
    daysLeft: 2,
  },
  {
    id: "mushrooms",
    name: "Cremini mushrooms",
    quantity: "250 g",
    zone: "Fridge",
    useSoon: true,
    daysLeft: 2,
  },
  {
    id: "yogurt",
    name: "Greek yogurt",
    quantity: "500 g",
    zone: "Fridge",
    useSoon: true,
    daysLeft: 3,
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
  {
    id: "berries",
    name: "Frozen berries",
    quantity: "1 bag",
    zone: "Freezer",
    useSoon: false,
  },
];
function read(): PantryItem[] {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

export default function App() {
  const [items, setItems] = useState<PantryItem[]>(read);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [zone, setZone] = useState<Zone>("Fridge");
  const [soon, setSoon] = useState(false);
  const [days, setDays] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [planning, setPlanning] = useState(false);
  useEffect(() => localStorage.setItem(key, JSON.stringify(items)), [items]);
  const groups = useMemo(
    () =>
      ["Fridge", "Freezer", "Pantry"].map((zone) => ({
        zone: zone as Zone,
        items: items.filter((item) => item.zone === zone),
      })),
    [items],
  );
  const urgent = items.filter((item) => item.useSoon).length;
  function reset() {
    setName("");
    setQuantity("");
    setZone("Fridge");
    setSoon(false);
    setDays("");
    setEditing(null);
  }
  function save(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !quantity.trim()) {
      setNotice("Add an ingredient name and amount to save it.");
      return;
    }
    const item: PantryItem = {
      id: editing || crypto.randomUUID(),
      name: name.trim(),
      quantity: quantity.trim(),
      zone,
      useSoon: soon,
      daysLeft: soon && days ? Number(days) : undefined,
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
    setEditing(item.id);
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function loadSample() {
    setItems(sample.map((item) => ({ ...item })));
    reset();
    setNotice(
      "Sample pantry loaded. You can still edit anything before planning.",
    );
  }
  if (planning) return <PlannerPanel items={items} onBack={() => setPlanning(false)} />;
  return (
    <main className="app">
      <header>
        <a className="brand" href="#top">
          <b>P</b> Pantry Rescue
        </a>
        <span>Your kitchen, put to work</span>
      </header>
      <section className="hero" id="top">
        <p className="eyebrow">Your kitchen is full of possibilities</p>
        <h1>
          Make meals from what you have.
          <br />
          <em>Shop only for what you’re missing.</em>
        </h1>
        <p>
          Start with food already in your kitchen. Pantry Rescue turns it into a
          plan that wastes less and asks for less at checkout.
        </p>
      </section>
      <section className="setup">
        <div className="card">
          <div className="title">
            <i>01</i>
            <div>
              <p className="eyebrow">Your real kitchen</p>
              <h2>{editing ? "Update an ingredient" : "Add my groceries"}</h2>
            </div>
          </div>
          <p className="muted">
            Add what’s in your fridge, freezer, or pantry. A little context goes
            a long way.
          </p>
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
                Needs using soon?
              </label>
            </div>
            {soon && (
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
              <button className="primary">
                {editing ? "Save changes" : "Add to my kitchen"} →
              </button>
              {editing && (
                <button type="button" className="plain" onClick={reset}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
        <aside className="card sample">
          <div className="food" aria-hidden="true">
            🥬 🍄 🍋
          </div>
          <p className="eyebrow">Want to see the magic?</p>
          <h2>Try a sample pantry</h2>
          <p className="muted">
            Load a realistic kitchen with a few ingredients that need some love.
            It uses this exact editable pantry.
          </p>
          <button className="secondary" onClick={loadSample}>
            Load sample groceries →
          </button>
          <small>No separate demo. Change, add, or remove anything.</small>
        </aside>
      </section>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <section className="inventory">
        <div className="inventoryHead">
          <div>
            <p className="eyebrow">What’s in your kitchen</p>
            <h2>Your pantry, at a glance</h2>
          </div>
          <div>
            <b>{items.length}</b> ingredients · <b>{urgent}</b> use soon
          </div>
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
                    <article key={item.id}>
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
                            Use soon
                            {item.daysLeft ? ` · ${item.daysLeft} days` : ""}
                          </mark>
                        )}
                      </div>
                      <nav>
                        <button onClick={() => edit(item)}>Edit</button>
                        <button
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
      <section className="plan">
        <div>
          <p className="eyebrow">Ready when you are</p>
          <h2>
            {items.length >= 3
              ? "Let’s turn this into a rescue plan."
              : "Add at least 3 ingredients to start planning."}
          </h2>
          <p>
            {items.length >= 3
              ? `${items.length} ingredients added · ${urgent} should be used soon`
              : "The best plans start with a little more of your kitchen."}
          </p>
        </div>
        <button
          className="primary"
          disabled={items.length < 3}
          onClick={() => setPlanning(true)}
        >
          Plan with what I have →
        </button>
      </section>
    </main>
  );
}
