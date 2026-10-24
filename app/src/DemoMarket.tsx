import { useEffect, useMemo, useState } from "react";

type Product = { id: string; name: string; size: string; price: number; available: boolean };
const products: Product[] = [
  { id: "parmesan", name: "Parmesan wedge", size: "200 g", price: 4.99, available: true },
  { id: "garlic", name: "Garlic bulb", size: "1 each", price: 0.69, available: true },
  { id: "stock-900", name: "Vegetable stock", size: "900 mL", price: 2.79, available: true },
  { id: "stock-1800", name: "Vegetable stock family size", size: "1.8 L", price: 4.29, available: false },
  { id: "lemons", name: "Individual lemons", size: "1 each", price: 0.69, available: true },
  { id: "avocados", name: "Ripe avocados", size: "1 each", price: 1.09, available: true },
];

export default function DemoMarket({ onExit }: { onExit: () => void }) {
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [path, setPath] = useState(() => window.location.hash);
  useEffect(() => { const sync = () => setPath(window.location.hash); window.addEventListener("hashchange", sync); return () => window.removeEventListener("hashchange", sync); }, []);
  const detail = products.find((product) => product.id === path.match(/^#demo-market\/product\/(.+)$/)?.[1]);
  const results = useMemo(() => products.filter((product) => product.name.toLowerCase().includes(query.trim().toLowerCase())), [query]);
  const cartItems = products.filter((product) => cart[product.id]);
  const subtotal = cartItems.reduce((sum, product) => sum + product.price * cart[product.id], 0);
  function add(product: Product) { setCart((current) => ({ ...current, [product.id]: (current[product.id] ?? 0) + 1 })); }
  if (detail) return <main className="app demo-market"><header><a className="brand" href="#demo-market"><b>D</b> Demo Market</a><button className="plain" onClick={onExit}>← Back to Pantry Rescue</button></header><section className="results" data-testid="demo-product-detail" data-product-id={detail.id} data-product-name={detail.name} data-product-size={detail.size} data-product-price={detail.price} data-product-available={detail.available ? "true" : "false"}><p className="eyebrow">Product details · Demo Market</p><h2>{detail.name}</h2><p>{detail.size} · ${detail.price.toFixed(2)}</p><p className="muted">{detail.available ? "Available for the selected Demo Market task." : "Currently unavailable."}</p><button className="secondary" disabled={!detail.available} onClick={() => add(detail)}>Add to cart</button><a className="cart-link" href="#demo-market">Back to results</a></section></main>;
  return <main className="app demo-market">
    <header><a className="brand" href="#demo-market"><b>D</b> Demo Market</a><button className="plain" onClick={onExit}>← Back to Pantry Rescue</button></header>
    <section className="hero compact"><p className="eyebrow">Controlled retailer environment</p><h1>Demo Market<br /><em>grocery storefront.</em></h1><p>A functional test retailer for Pantry Rescue's browser-shopping flow. No checkout is available.</p></section>
    <section className="demo-layout">
      <section className="results"><p className="eyebrow">Search products</p><label className="demo-search">What are you looking for?<input data-testid="demo-search" aria-label="Search Demo Market" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try vegetable stock" /></label>
        <div className="demo-products">{results.map((product) => <article className="demo-product" data-testid="demo-product" data-product-id={product.id} data-product-name={product.name} data-product-size={product.size} data-product-price={product.price} data-product-available={product.available ? "true" : "false"} key={product.id}><div><h3 data-testid="product-name">{product.name}</h3><p data-testid="product-size">{product.size} · ${product.price.toFixed(2)}</p>{!product.available && <mark>Unavailable</mark>}</div><a data-testid={`view-product-${product.id}`} href={`#demo-market/product/${product.id}`}>View product</a><button className="secondary" data-testid={`add-to-cart-${product.id}`} disabled={!product.available} onClick={() => add(product)}>Add to cart</button></article>)}
          {!results.length && <p className="muted">No matching products found. The shopping agent should mark this ingredient Needs attention.</p>}
        </div>
      </section>
      <aside className="results demo-cart" data-testid="demo-cart" aria-live="polite"><p className="eyebrow">Your cart</p><h2>{cartItems.length ? `${cartItems.length} product${cartItems.length === 1 ? "" : "s"} selected` : "Your cart is empty"}</h2>
        {cartItems.map((product) => <p data-testid="cart-item" data-product-id={product.id} data-product-size={product.size} data-unit-price={product.price} data-quantity={cart[product.id]} key={product.id}><span><b>{product.name}</b><small>{product.size} · qty {cart[product.id]}</small></span><strong>${(product.price * cart[product.id]).toFixed(2)}</strong></p>)}
        <div className="demo-total"><span>Estimated subtotal</span><b>${subtotal.toFixed(2)}</b></div><small>Review only — checkout and payment stay with the user.</small>
      </aside>
    </section>
  </main>;
}
