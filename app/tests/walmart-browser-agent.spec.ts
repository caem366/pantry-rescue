import { expect, test } from "@playwright/test";
import { addVerifiedWalmartProduct, buildWalmartBasket, inspectWalmartProduct, parseWalmartPrice, parseWalmartSize, readWalmartCart, searchWalmartProducts, walmartCandidate } from "../server/walmartBrowserAgent";
import { selectProduct } from "../src/lib/shoppingAgent";

test("Walmart candidate extraction requires a real product URL, package size, and price", () => {
  const candidate = walmartCandidate({
    name: "Vegetable Stock 900 mL",
    href: "https://www.walmart.ca/en/ip/vegetable-stock/6000123456789",
    text: "Vegetable Stock 900 mL $2.79 Add",
  });
  expect(candidate).toMatchObject({ retailerId: "walmart-ca", retailerProductId: "6000123456789", packageQuantity: 900, packageUnit: "mL", price: 2.79, availabilityVerified: false });
  expect(walmartCandidate({ name: "Vegetable Stock", href: "https://other.example/en/ip/stock/123", text: "$2.79" })).toBeUndefined();
  expect(walmartCandidate({ name: "Vegetable Stock", href: "https://www.walmart.ca/en/ip/stock/123", text: "$2.79" })).toMatchObject({ name: "Vegetable Stock", packageQuantity: undefined, price: 2.79 });
  expect(walmartCandidate({ name: "Vegetable Stock 900 mL", href: "https://www.walmart.ca/en/ip/stock/123", text: "Price unavailable" })).toBeUndefined();
  expect(walmartCandidate({ name: "Parmesan Cheese 200 g", href: "https://www.walmart.ca/en/ip/parmesan/456", text: "Was $12.97 Now $10 98 current price $10.98" })).toMatchObject({ price: 10.98 });
});

test("Walmart sizes and prices are not guessed from incomplete text", () => {
  expect(parseWalmartSize("Oyster Sauce 510 g")).toEqual({ quantity: 510, unit: "g" });
  expect(parseWalmartSize("Lemons 2 ct")).toEqual({ quantity: 2, unit: "each" });
  expect(parseWalmartSize("Garlic, Pack of 3")).toEqual({ quantity: 3, unit: "each" });
  expect(parseWalmartSize("Oyster Sauce, assorted sizes")).toBeUndefined();
  expect(parseWalmartPrice("Now $3.49")).toBe(3.49);
  expect(parseWalmartPrice("Now $6 87 current price $6.87")).toBe(6.87);
  expect(parseWalmartPrice("See price in cart")).toBeUndefined();
});

test("a Walmart detail page verifies its own current price instead of the header cart total", async ({ page }) => {
  const url = "https://www.walmart.ca/en/ip/vegetable-stock/6000123456789";
  const candidate = walmartCandidate({ name: "Image: Vegetable Stock", href: url, text: "Now $2 79 current price $2.79" })!;
  await page.route(url, (route) => route.fulfill({ contentType: "text/html", body: `<header>0 $0.00</header><h1>Vegetable Stock</h1><p>Current price is CAD$2.79</p><dl><dt>Size</dt><dd>900mL</dd></dl>` }));
  const inspected = await inspectWalmartProduct(page, candidate);
  expect(inspected).toMatchObject({ name: "Vegetable Stock", packageQuantity: 900, packageUnit: "mL", price: 2.79 });
  expect(selectProduct({ id: "stock", ingredient: "vegetable stock", requiredQuantity: 750, unit: "mL" }, [inspected!])).toMatchObject({ quantity: 1 });
  await page.unroute(url);
  await page.route(url, (route) => route.fulfill({ contentType: "text/html", body: `<h1>Vegetable Stock</h1><p>Current price is CAD$3.29</p><dl><dt>Size</dt><dd>900mL</dd></dl>` }));
  await expect(inspectWalmartProduct(page, candidate)).resolves.toBeUndefined();
});

test("detail verification tolerates a harmless product URL query change but not a different product ID", async ({ page }) => {
  const url = "https://www.walmart.ca/en/ip/parmesan/6000197050105";
  const candidate = walmartCandidate({ name: "Parmesan Cheese 200 g", href: `${url}?classType=REGULAR`, text: "$10.98" })!;
  await page.route("**/en/ip/parmesan/6000197050105**", (route) => route.fulfill({ contentType: "text/html", body: `<script>history.replaceState(null, "", "${url}")</script><h1>Parmesan Cheese 200g</h1><p>Current price is CAD$10.98</p>` }));
  await expect(inspectWalmartProduct(page, candidate)).resolves.toMatchObject({ retailerProductId: "6000197050105", packageQuantity: 200, packageUnit: "g" });
});

test("related broth does not silently satisfy vegetable stock", () => {
  const candidate = walmartCandidate({ name: "Campbell's Vegetable Broth 900 mL", href: "https://www.walmart.ca/en/ip/broth/10179026", text: "$2.79" })!;
  expect(selectProduct({ id: "stock", ingredient: "vegetable stock", requiredQuantity: 750, unit: "mL" }, [candidate])).toBeUndefined();
});

test("Walmart's visible zero-result message triggers a narrow garlic search variant", async ({ page }) => {
  const searched: string[] = [];
  await page.route("https://www.walmart.ca/", (route) => route.fulfill({ contentType: "text/html", body: `<form action="/en/search"><input type="search" name="q" aria-label="Search Walmart"></form>` }));
  await page.route("https://www.walmart.ca/en/search**", (route) => {
    const query = new URL(route.request().url()).searchParams.get("q") ?? "";
    searched.push(query);
    return route.fulfill({ contentType: "text/html", body: query === "fresh garlic"
      ? `<article data-testid="product"><a href="/en/ip/garlic/123"><img alt="Fresh Garlic, Pack of 3"></a><span>Now $0 98</span></article>`
      : `<h1>There were no search results for ${query}.</h1>` });
  });
  const products = await searchWalmartProducts(page, { id: "garlic", ingredient: "garlic", requiredQuantity: 2, unit: "each" });
  expect(searched).toEqual(["garlic", "fresh garlic"]);
  expect(products).toMatchObject([{ name: "Fresh Garlic, Pack of 3", packageQuantity: 3, packageUnit: "each", price: 0.98, searchQuery: "fresh garlic" }]);
});

test("garlic variants stop after a successful exact-ingredient search, without broad substitutions", async ({ page }) => {
  const searched: string[] = [];
  await page.route("https://www.walmart.ca/", (route) => route.fulfill({ contentType: "text/html", body: `<form action="/en/search"><input type="search" name="q" aria-label="Search Walmart"></form>` }));
  await page.route("https://www.walmart.ca/en/search**", (route) => {
    const query = new URL(route.request().url()).searchParams.get("q") ?? "";
    searched.push(query);
    return route.fulfill({ contentType: "text/html", body: query === "garlic cloves"
      ? `<article data-testid="product"><a href="/en/ip/garlic-cloves/456"><img alt="Garlic Cloves 3 ct"></a><span>$1.49</span></article>`
      : `<h1>There were no search results for ${query}.</h1>` });
  });
  const products = await searchWalmartProducts(page, { id: "garlic", ingredient: "garlic", requiredQuantity: 2, unit: "each" });
  expect(searched).toEqual(["garlic", "fresh garlic", "garlic bulb", "garlic cloves"]);
  expect(products[0]).toMatchObject({ searchQuery: "garlic cloves", retailerProductId: "456" });
});

test("Walmart cart building rejects missing product approval before browser access", async () => {
  await expect(buildWalmartBasket({ apiKey: "", marketUrl: "" }, "unused", "unapproved", ["garlic"])).rejects.toThrow(/approval expired/i);
});

test("an approved Walmart product is added only after the cart line is independently verified", async ({ page }) => {
  let clicks = 0;
  await page.exposeFunction("recordAdd", () => { clicks += 1; });
  await page.route("https://www.walmart.ca/en/ip/garlic/123", (route) => route.fulfill({ contentType: "text/html", body: `<h1>Garlic, Pack of 3</h1><p>Current price is CAD$0.98</p><button onclick="window.recordAdd()">Add</button>` }));
  await page.route("https://www.walmart.ca/en/cart", (route) => route.fulfill({ contentType: "text/html", body: clicks
    ? `<h1>Cart (1 item)</h1><article><a href="/en/ip/garlic/123">Garlic, Pack of 3</a><span>$0.98</span><input type="number" aria-label="Quantity" value="1"></article>`
    : `<h1>Cart (0 items)</h1><p>Time to start shopping!</p>` }));
  const ingredient = { id: "garlic", ingredient: "garlic", requiredQuantity: 2, unit: "each" as const };
  const candidate = walmartCandidate({ name: "Garlic, Pack of 3", href: "https://www.walmart.ca/en/ip/garlic/123", text: "$0.98" })!;
  const selection = selectProduct(ingredient, [candidate])!;
  const cart = await addVerifiedWalmartProduct(page, selection, []);
  expect(clicks).toBe(1);
  expect(cart).toEqual([{ id: "123", name: "Garlic, Pack of 3", size: "3 each", unitPrice: 0.98, quantity: 1 }]);
});

test("a cart quantity mismatch stops safely after one click", async ({ page }) => {
  let clicks = 0;
  await page.exposeFunction("recordAdd", () => { clicks += 1; });
  await page.route("https://www.walmart.ca/en/ip/garlic/123", (route) => route.fulfill({ contentType: "text/html", body: `<h1>Garlic, Pack of 3</h1><p>Current price is CAD$0.98</p><button onclick="window.recordAdd()">Add</button>` }));
  await page.route("https://www.walmart.ca/en/cart", (route) => route.fulfill({ contentType: "text/html", body: `<h1>Cart (2 items)</h1><article><a href="/en/ip/garlic/123">Garlic, Pack of 3</a><span>$0.98</span><input type="number" aria-label="Quantity" value="2"></article>` }));
  const candidate = walmartCandidate({ name: "Garlic, Pack of 3", href: "https://www.walmart.ca/en/ip/garlic/123", text: "$0.98" })!;
  const selection = selectProduct({ id: "garlic", ingredient: "garlic", requiredQuantity: 2, unit: "each" }, [candidate])!;
  await expect(addVerifiedWalmartProduct(page, selection, [])).rejects.toThrow(/did not match/i);
  expect(clicks).toBe(1);
});

test("rendered Walmart-like search cards become real candidates without claiming local stock", async ({ page }) => {
  await page.route("https://www.walmart.ca/", (route) => route.fulfill({ contentType: "text/html", body: `<form action="/en/search"><input type="search" name="q" aria-label="Search Walmart"></form>` }));
  await page.route("https://www.walmart.ca/en/search**", (route) => route.fulfill({ contentType: "text/html", body: `<article data-testid="product"><a href="/en/ip/vegetable-stock/6000123456789"><img alt="Vegetable Stock 900 mL"></a><span>$2.79</span></article>` }));
  const products = await searchWalmartProducts(page, { id: "stock", ingredient: "vegetable stock", requiredQuantity: 750, unit: "mL" });
  expect(products).toHaveLength(1);
  expect(products[0]).toMatchObject({ name: "Vegetable Stock 900 mL", price: 2.79, availabilityVerified: false });
});

test("a Walmart identity check stops search without interacting with the challenge", async ({ page }) => {
  await page.route("https://www.walmart.ca/", (route) => route.fulfill({ contentType: "text/html", body: `<h1>We like real shoppers, not robots!</h1><p>Please press and hold the button below to verify yourself.</p><button>PRESS & HOLD</button>` }));
  await expect(searchWalmartProducts(page, { id: "stock", ingredient: "vegetable stock", requiredQuantity: 750, unit: "mL" })).rejects.toThrow(/identity check/i);
  await expect(page.getByRole("button", { name: /press & hold/i })).toBeVisible();
});

test("cart extraction fails closed when a retailer product line lacks verifiable quantity", async ({ page }) => {
  await page.route("https://www.walmart.ca/en/cart", (route) => route.fulfill({ contentType: "text/html", body: `<h1>Cart</h1><article><a href="/en/ip/vegetable-stock/6000123456789">Vegetable Stock 900 mL</a><span>$2.79</span></article>` }));
  await expect(readWalmartCart(page)).rejects.toThrow(/cannot read/i);
});

test("Walmart's explicit zero-item cart can be inspected, but a loading cart cannot", async ({ page }) => {
  await page.route("https://www.walmart.ca/en/cart", (route) => route.fulfill({ contentType: "text/html", body: `<h1>Cart (0 items)</h1><p>Sign in to see your saved items.</p><p>Time to start shopping!</p>` }));
  await expect(readWalmartCart(page)).resolves.toEqual([]);
  await page.unroute("https://www.walmart.ca/en/cart");
  await page.route("https://www.walmart.ca/en/cart", (route) => route.fulfill({ contentType: "text/html", body: `<h1>Cart (0 items)</h1><p>Loading cart...</p>` }));
  await expect(readWalmartCart(page)).rejects.toThrow(/confirmed empty state/i);
});

test("rendered cart receipts include product identity, package, price, and quantity", async ({ page }) => {
  await page.route("https://www.walmart.ca/en/cart", (route) => route.fulfill({ contentType: "text/html", body: `<h1>Cart</h1><article><a href="/en/ip/vegetable-stock/6000123456789">Vegetable Stock 900 mL</a><span>$2.79</span><input type="number" aria-label="Quantity" value="2"></article>` }));
  await expect(readWalmartCart(page)).resolves.toEqual([{ id: "6000123456789", name: "Vegetable Stock 900 mL", size: "900 mL", unitPrice: 2.79, quantity: 2 }]);
});
