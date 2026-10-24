import { expect, test } from "@playwright/test";

async function loadRescuePlan(page: import("@playwright/test").Page) {
  await page.route("**/api/recipes/discover**", (route) => route.fulfill({ json: { recipes: [] } }));
  await page.goto("/");
  await page.getByRole("button", { name: /try the sample pantry/i }).click();
  await page.getByRole("button", { name: /find rescue meals/i }).click();
}

test("an expiring ingredient leads to the meal plan", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Ingredient").fill("Spinach");
  await page.getByLabel("Amount").fill("150 g");
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel("Use-by date").fill(tomorrow);
  await page.getByRole("button", { name: /add to my kitchen/i }).click();
  await page.getByRole("button", { name: /find rescue meals/i }).click();
  await expect(page.getByRole("heading", { name: /good meals for what you have/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /creamy mushroom & spinach pasta/i })).toBeVisible();
});

test("selected meals determine gaps and changing them requires fresh approval", async ({ page }) => {
  await loadRescuePlan(page);
  await expect(page.getByRole("textbox", { name: "Search real recipes" })).toHaveValue("mushroom");
  await expect.poll(() => page.locator(".mealimg img").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.getByRole("button", { name: /review missing ingredients/i }).click();
  await expect(page.getByText("parmesan", { exact: true })).toBeVisible();
  await expect(page.getByText("spinach", { exact: true })).toHaveCount(0);
  await page.getByLabel("Amount to buy for parmesan").click();
  await expect(page.getByRole("checkbox", { name: /parmesan/i })).toBeChecked();
  await page.getByRole("button", { name: /approve shopping list/i }).click();
  await expect(page.getByRole("button", { name: /walmart canada/i })).toBeVisible();
  await page.getByRole("button", { name: /edit shopping list/i }).click();
  await page.getByRole("button", { name: /change meals/i }).click();
  await page.getByRole("button", { name: /selected · remove meal/i }).click();
  await expect(page.getByRole("heading", { name: /good meals for what you have/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /walmart canada/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /review missing ingredients/i })).toBeDisabled();
  await page.getByRole("button", { name: /edit my kitchen/i }).click();
  await page.getByRole("button", { name: /reset sample pantry/i }).click();
  await page.getByRole("button", { name: /find rescue meals/i }).click();
  await expect(page.getByRole("heading", { name: /good meals for what you have/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /walmart canada/i })).toHaveCount(0);
});

test("a sourced recipe keeps its attribution and own grocery gaps", async ({ page }) => {
  await page.route("**/api/recipes/discover**", (route) => route.fulfill({ json: { recipes: [{
    id: "mealdb-spinach", name: "Spinach supper", imageUrl: "https://cdn.example/spinach.jpg", provider: "TheMealDB", attribution: "Recipe and photo from TheMealDB.", sourceUrl: "https://source.example/spinach", instructions: "Cook the spinach.",
    ingredients: [{ name: "Baby spinach", measure: "150 g" }, { name: "Parmesan", measure: "150 g" }],
  }] } }));
  await page.goto("/");
  await page.getByRole("button", { name: /try the sample pantry/i }).click();
  await page.getByRole("button", { name: /find rescue meals/i }).click();
  await page.getByRole("button", { name: /view recipe/i }).click();
  await page.getByRole("button", { name: /cook this recipe/i }).click();
  await expect(page.getByRole("heading", { name: "Spinach supper" })).toBeVisible();
  await expect(page.getByText(/recipe and photo from themealdb/i)).toBeVisible();
  await expect(page.getByText("parmesan", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /approve shopping list/i }).click();
  await expect(page.getByRole("button", { name: /demo market/i })).toBeVisible();
});

test("ambiguous recipe measures must be resolved before approval", async ({ page }) => {
  await page.route("**/api/recipes/discover**", (route) => route.fulfill({ json: { recipes: [{
    id: "mealdb-basil", name: "Spinach with basil", provider: "TheMealDB", attribution: "TheMealDB", ingredients: [{ name: "Spinach", measure: "150 g" }, { name: "Basil", measure: "to taste" }],
  }] } }));
  await page.goto("/");
  await page.getByRole("button", { name: /try the sample pantry/i }).click();
  await page.getByRole("button", { name: /find rescue meals/i }).click();
  await page.getByRole("button", { name: /view recipe/i }).click();
  await page.getByRole("button", { name: /cook this recipe/i }).click();
  await expect(page.getByRole("button", { name: /approve shopping list/i })).toBeDisabled();
  await page.getByLabel("Quantity for Basil").fill("20");
  await page.getByLabel("Unit for Basil").selectOption("g");
  await expect(page.getByRole("button", { name: /approve shopping list/i })).toBeEnabled();
});

test("Metro observed listings remain an honest manual product handoff", async ({ page }) => {
  let searched: { ingredient: string }[] = [];
  await page.route("**/api/shopping/canadian/compare", async (route) => {
    searched = route.request().postDataJSON().ingredients;
    await route.fulfill({ json: { options: [{ retailerId: "metro", retailerName: "Metro", matchedIngredientCount: 1, totalIngredientCount: searched.length, estimatedTotal: 5.49, selections: [{ ingredient: searched[0], product: { name: "Parmesan wedge", packageQuantity: 200, packageUnit: "g", price: 5.49, sourceUrl: "https://www.metro.ca/en/online-grocery/aisles/parmesan", retrievedAt: new Date().toISOString() }, quantity: 1, reason: "Suitable size" }], warnings: [] }] } });
  });
  await loadRescuePlan(page);
  await page.getByRole("button", { name: /review missing ingredients/i }).click();
  await page.getByRole("button", { name: /approve shopping list/i }).click();
  await page.getByRole("button", { name: /metro product matches only/i }).click();
  await page.getByLabel("Canadian postal code").fill("M5V 1A1");
  await page.getByRole("button", { name: /check observed listings for metro/i }).click();
  await expect(page.getByText("Parmesan wedge")).toBeVisible();
  await expect(page.getByRole("link", { name: /review product/i })).toHaveAttribute("href", "https://www.metro.ca/en/online-grocery/aisles/parmesan");
  await expect(page.getByText(/has not opened a steel session or changed this retailer's cart/i)).toBeVisible();
  expect(searched.some((item) => item.ingredient === "spinach")).toBe(false);
});

test("Shop retailer labels stay distinct and Walmart setup copy stays concise", async ({ page }) => {
  await page.route("**/api/shopping/cloud-demo/status", (route) => route.fulfill({ json: { configured: true, sessionActive: false, message: "Ready." } }));
  await page.route("**/api/shopping/cloud-walmart/status", (route) => route.fulfill({ json: { configured: true, sessionActive: false, message: "Ready." } }));
  await loadRescuePlan(page);
  await page.getByRole("button", { name: /review missing ingredients/i }).click();
  await page.getByRole("button", { name: /approve shopping list/i }).click();
  await expect(page.getByRole("button", { name: /demo market verified agent demo/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /walmart canada experimental agent/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /metro product matches only/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /voilà retailer handoff/i })).toBeVisible();
  await page.getByRole("button", { name: /demo market verified agent demo/i }).click();
  await expect(page.getByRole("heading", { name: "Demo Market live agent" })).toBeVisible();
  await expect(page.getByRole("button", { name: /start live shopping agent/i })).toBeVisible();
  await page.getByRole("button", { name: /walmart canada experimental agent/i }).click();
  await expect(page.getByRole("heading", { name: "Walmart live agent" })).toBeVisible();
  await expect(page.getByText("Walmart may ask you to verify you're human.")).toBeVisible();
  await expect(page.getByText(/Choose your Walmart store or delivery area in the live browser/i)).toBeVisible();
  await page.getByLabel("Canadian postal code").fill("L6H 1A1");
  await expect(page.getByLabel("Canadian postal code")).toHaveValue("L6H 1A1");
  await page.getByRole("button", { name: /metro product matches only/i }).click();
  await expect(page.getByRole("heading", { name: /browser-agent cart building is not available/i })).toBeVisible();
  await page.getByRole("button", { name: /voilà retailer handoff/i }).click();
  await expect(page.getByRole("link", { name: /take over at voilà/i })).toBeVisible();
});

test("Demo Market browser searches approved gaps and stops at verified cart review", async ({ page }) => {
  let searched: { id: string; ingredient: string }[] = [];
  let cartApprovals = 0;
  await page.route("**/api/shopping/cloud-demo/status", (route) => route.fulfill({ json: { configured: true, sessionActive: false, message: "Ready to shop." } }));
  await page.route("**/api/shopping/cloud-demo/events", (route) => route.fulfill({ json: { events: [] } }));
  await page.route("**/api/shopping/cloud-demo/session", (route) => route.fulfill({ status: 201, json: { viewerUrl: "https://app.steel.dev/sessions/demo" } }));
  await page.route("https://app.steel.dev/**", (route) => route.fulfill({ contentType: "text/html", body: "<html><body>Demo browser</body></html>" }));
  await page.route("**/api/shopping/cloud-demo/preview", async (route) => {
    searched = route.request().postDataJSON().ingredients;
    await route.fulfill({ json: { previewId: "preview-1", viewerUrl: "https://app.steel.dev/sessions/demo", events: [], results: [], selections: searched.map((ingredient) => ({ ingredient, product: { name: ingredient.ingredient, packageQuantity: 1, packageUnit: "each", price: 2, currency: "CAD", available: true }, quantity: 1, reason: "Suitable package" })) } });
  });
  await page.route("**/api/shopping/cloud-demo/build", async (route) => {
    cartApprovals += 1;
    await route.fulfill({ json: { viewerUrl: "https://app.steel.dev/sessions/demo", events: [], results: searched.map((ingredient) => ({ ingredient, status: "ADDED", selection: { ingredient, product: { name: ingredient.ingredient, packageQuantity: 1, packageUnit: "each", price: 2 }, quantity: 1, reason: "Suitable package" } })), cartItems: searched.map((ingredient) => ({ id: ingredient.id, name: ingredient.ingredient, quantity: 1 })) } });
  });
  await loadRescuePlan(page);
  await page.getByRole("button", { name: /review missing ingredients/i }).click();
  await page.getByRole("button", { name: /approve shopping list/i }).click();
  await page.getByRole("button", { name: /demo market/i }).click();
  await page.getByLabel(/delivery location/i).fill("Toronto, ON");
  await page.getByRole("button", { name: /start live shopping agent/i }).click();
  await expect(page.getByTitle("Live Demo Market shopping browser")).toBeVisible();
  await page.getByRole("button", { name: /search approved products/i }).click();
  expect(cartApprovals).toBe(0);
  const buildCart = page.getByRole("button", { name: /add approved products to demo cart/i });
  await expect(buildCart).toBeDisabled();
  while (await page.getByRole("button", { name: "Approve product" }).count()) await page.getByRole("button", { name: "Approve product" }).first().click();
  await buildCart.click();
  await expect(page.getByRole("heading", { name: "Your cart is ready" })).toBeVisible();
  expect(cartApprovals).toBe(1);
  expect(searched.some((item) => item.ingredient === "spinach")).toBe(false);
});

test("Walmart browser path keeps location confirmation and exact cart approval separate", async ({ page }) => {
  let searched: { id: string; ingredient: string }[] = [];
  let cartWrites = 0;
  await page.route("**/api/shopping/cloud-walmart/status", (route) => route.fulfill({ json: { configured: true, sessionActive: false, message: "Ready for authorized browser work." } }));
  await page.route("**/api/shopping/cloud-walmart/session", (route) => route.fulfill({ status: 201, json: { viewerUrl: "https://app.steel.dev/sessions/walmart" } }));
  await page.route("**/api/shopping/cloud-walmart/events", (route) => route.fulfill({ json: { events: [] } }));
  await page.route("https://app.steel.dev/**", (route) => route.fulfill({ contentType: "text/html", body: "Live browser" }));
  await page.route("**/api/shopping/cloud-walmart/preview", async (route) => {
    const request = route.request().postDataJSON();
    expect(request.locationConfirmed).toBe(true);
    expect(request.postalCode).toBe("L6H 1A1");
    searched = request.ingredients;
    await route.fulfill({ json: { previewId: "walmart-preview", selections: searched.slice(0, 1).map((ingredient) => ({ ingredient, product: { name: "Parmesan 200 g", packageQuantity: 200, packageUnit: "g", price: 5.49 }, quantity: 1, reason: "Smallest suitable package" })), results: searched.slice(1).map((ingredient) => ({ ingredient, status: "NEEDS_ATTENTION", message: "No verified product found." })), events: [] } });
  });
  await page.route("**/api/shopping/cloud-walmart/build", (route) => { cartWrites += 1; void route.fulfill({ json: { results: [{ ingredient: searched[0], status: "NEEDS_ATTENTION", message: "Cart quantity could not be verified." }], cartItems: [], events: [] } }); });
  await loadRescuePlan(page);
  await page.getByRole("button", { name: /review missing ingredients/i }).click();
  await page.getByRole("button", { name: /approve shopping list/i }).click();
  await page.getByRole("button", { name: /walmart canada/i }).click();
  await page.getByRole("button", { name: /start live shopping agent/i }).click();
  await expect(page.getByTitle("Live Walmart Canada shopping browser")).toBeVisible();
  await page.getByLabel("Canadian postal code").fill("L6H 1A1");
  const search = page.getByRole("button", { name: /search approved products/i });
  await expect(search).toBeDisabled();
  await page.getByRole("checkbox", { name: /selected my store or delivery area/i }).check();
  await search.click();
  expect(cartWrites).toBe(0);
  await page.getByRole("button", { name: "Approve product" }).click();
  await page.getByRole("button", { name: /add approved products to walmart cart/i }).click();
  expect(cartWrites).toBe(1);
  await expect(page.getByRole("heading", { name: /cart needs a final review/i })).toBeVisible();
  await expect(page.getByText(/cart quantity could not be verified/i)).toBeVisible();
});

test("Walmart identity check pauses the agent and does not offer cart success", async ({ page }) => {
  let cartWrites = 0;
  await page.route("**/api/shopping/cloud-walmart/status", (route) => route.fulfill({ json: { configured: true, sessionActive: false, message: "Ready." } }));
  await page.route("**/api/shopping/cloud-walmart/session", (route) => route.fulfill({ status: 201, json: { viewerUrl: "https://app.steel.dev/sessions/walmart" } }));
  await page.route("**/api/shopping/cloud-walmart/events", (route) => route.fulfill({ json: { events: [] } }));
  await page.route("**/api/shopping/cloud-walmart/preview", (route) => route.fulfill({ json: { previewId: "blocked", selections: [], events: [], results: [{ ingredient: { id: "parmesan", ingredient: "parmesan" }, status: "NEEDS_ATTENTION", message: "Walmart presented an identity check." }] } }));
  await page.route("**/api/shopping/cloud-walmart/build", (route) => { cartWrites += 1; void route.fulfill({ status: 409, json: { error: "Paused" } }); });
  await page.route("https://app.steel.dev/**", (route) => route.fulfill({ contentType: "text/html", body: "Identity check" }));
  await loadRescuePlan(page);
  await page.getByRole("button", { name: /review missing ingredients/i }).click();
  await page.getByRole("button", { name: /approve shopping list/i }).click();
  await page.getByRole("button", { name: /walmart canada/i }).click();
  await page.getByRole("button", { name: /start live shopping agent/i }).click();
  await page.getByLabel("Canadian postal code").fill("L6H 1A1");
  await page.getByRole("checkbox", { name: /selected my store or delivery area/i }).check();
  await page.getByRole("button", { name: /search approved products/i }).click();
  await expect(page.getByRole("alert")).toContainText("Walmart needs you to verify you're human");
  await expect(page.getByRole("button", { name: "Resume agent" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open browser ↗" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your cart is ready" })).toHaveCount(0);
  expect(cartWrites).toBe(0);
});

test("an unmatched Demo Market item remains visible after other products reach the cart", async ({ page }) => {
  let matched: { id: string; ingredient: string };
  await page.route("**/api/shopping/cloud-demo/status", (route) => route.fulfill({ json: { configured: true, sessionActive: false, message: "Ready to shop." } }));
  await page.route("**/api/shopping/cloud-demo/events", (route) => route.fulfill({ json: { events: [] } }));
  await page.route("**/api/shopping/cloud-demo/session", (route) => route.fulfill({ status: 201, json: { viewerUrl: "https://app.steel.dev/sessions/demo" } }));
  await page.route("https://app.steel.dev/**", (route) => route.fulfill({ contentType: "text/html", body: "Demo browser" }));
  await page.route("**/api/shopping/cloud-demo/preview", async (route) => {
    const [first, second] = route.request().postDataJSON().ingredients as { id: string; ingredient: string }[];
    matched = first;
    await route.fulfill({ json: { previewId: "preview-2", viewerUrl: "https://app.steel.dev/sessions/demo", events: [], selections: [{ ingredient: first, product: { name: first.ingredient, packageQuantity: 1, packageUnit: "each", price: 2 }, quantity: 1, reason: "Suitable package" }], results: [{ ingredient: second, status: "NEEDS_ATTENTION", message: "No suitable product found." }] } });
  });
  await page.route("**/api/shopping/cloud-demo/build", (route) => route.fulfill({ json: { viewerUrl: "https://app.steel.dev/sessions/demo", events: [], results: [{ ingredient: matched, status: "ADDED", selection: { ingredient: matched, product: { name: matched.ingredient, packageQuantity: 1, packageUnit: "each", price: 2 }, quantity: 1, reason: "Suitable package" } }], cartItems: [{ id: matched.id, name: matched.ingredient, quantity: 1 }] } }));
  await loadRescuePlan(page);
  await page.getByRole("button", { name: /review missing ingredients/i }).click();
  await page.getByRole("button", { name: /approve shopping list/i }).click();
  await page.getByRole("button", { name: /demo market/i }).click();
  await page.getByLabel(/delivery location/i).fill("Toronto, ON");
  await page.getByRole("button", { name: /start live shopping agent/i }).click();
  await page.getByRole("button", { name: /search approved products/i }).click();
  await page.getByRole("button", { name: "Approve product" }).click();
  await page.getByRole("button", { name: /add approved products to demo cart/i }).click();
  await expect(page.getByRole("heading", { name: /cart needs a final review/i })).toBeVisible();
  await expect(page.getByText(/no suitable product found/i)).toBeVisible();
});

test("sample pasta gaps move through the agent browser, approval, and verified cart review", async ({ page }) => {
  let approvedIds: string[] = [];
  let approvedProducts: { ingredientId: string; retailerProductId: string }[] = [];
  let requested: { id: string; ingredient: string; requiredQuantity: number; unit: string }[] = [];
  let liveEvents: { stage: string; label: string; status: string; timestamp: string }[] = [];
  await page.route("**/api/shopping/cloud-demo/status", (route) => route.fulfill({ json: { configured: true, sessionActive: false, message: "Ready to shop." } }));
  await page.route("**/api/shopping/cloud-demo/session", (route) => route.fulfill({ status: 201, json: { viewerUrl: "https://app.steel.dev/sessions/demo" } }));
  await page.route("**/api/shopping/cloud-demo/events", (route) => route.fulfill({ json: { events: liveEvents } }));
  await page.route("https://app.steel.dev/**", (route) => route.fulfill({ contentType: "text/html", body: "<html>Live browser</html>" }));
  await page.route("**/api/shopping/cloud-demo/preview", async (route) => {
    requested = route.request().postDataJSON().ingredients;
    liveEvents = [{ stage: "DISCOVERY", label: "Searching for parmesan", status: "ACTIVE", timestamp: new Date().toISOString() }];
    const catalog: Record<string, { name: string; packageQuantity: number; packageUnit: string; price: number; quantity: number }> = {
      parmesan: { name: "Parmesan wedge", packageQuantity: 200, packageUnit: "g", price: 4.99, quantity: 1 },
      garlic: { name: "Garlic bulb", packageQuantity: 1, packageUnit: "each", price: 0.69, quantity: 2 },
      "vegetable stock": { name: "Vegetable stock", packageQuantity: 900, packageUnit: "mL", price: 2.79, quantity: 1 },
    };
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.fulfill({ json: { previewId: "pasta-preview", viewerUrl: "https://app.steel.dev/sessions/demo", events: [], results: [], selections: requested.map((ingredient) => ({ ingredient, product: { ...catalog[ingredient.ingredient], retailerId: "steel-demo-market", retailerProductId: ingredient.id, available: true }, quantity: catalog[ingredient.ingredient].quantity, reason: "Smallest suitable package" })), candidates: requested.map((ingredient) => ({ ingredientId: ingredient.id, products: [{ id: ingredient.id, ...catalog[ingredient.ingredient], size: `${catalog[ingredient.ingredient].packageQuantity} ${catalog[ingredient.ingredient].packageUnit}`, available: true }, ...(ingredient.ingredient === "parmesan" ? [{ id: "parmesan-large", name: "Parmesan block", size: "300 g", price: 6.49, available: true }] : [])] })) } });
  });
  await page.route("**/api/shopping/cloud-demo/build", (route) => {
    approvedIds = route.request().postDataJSON().approvedIngredientIds;
    approvedProducts = route.request().postDataJSON().approvedProducts;
    void route.fulfill({ json: { viewerUrl: "https://app.steel.dev/sessions/demo", screenshot: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", events: [], results: requested.map((ingredient) => ({ ingredient, status: "ADDED", selection: { ingredient, product: { name: ingredient.ingredient === "parmesan" ? "Parmesan block" : ingredient.ingredient, packageQuantity: ingredient.ingredient === "parmesan" ? 300 : ingredient.ingredient === "vegetable stock" ? 900 : 1, packageUnit: ingredient.unit, price: ingredient.ingredient === "parmesan" ? 6.49 : ingredient.ingredient === "vegetable stock" ? 2.79 : 0.69 }, quantity: ingredient.ingredient === "garlic" ? 2 : 1, reason: "Approved exact match" } })), cartItems: [
      { id: "parmesan-large", name: "Parmesan block", size: "300 g", unitPrice: 6.49, quantity: 1 },
      { id: "garlic", name: "Garlic bulb", size: "1 each", unitPrice: 0.69, quantity: 2 },
      { id: "stock-900", name: "Vegetable stock", size: "900 mL", unitPrice: 2.79, quantity: 1 },
    ] } });
  });
  await loadRescuePlan(page);
  await page.getByRole("button", { name: /review missing ingredients/i }).click();
  await expect(page.locator(".review-item")).toHaveCount(3);
  await expect(page.locator(".review-item").allTextContents()).resolves.toEqual(expect.arrayContaining([expect.stringContaining("parmesan"), expect.stringContaining("garlic"), expect.stringContaining("vegetable stock")]));
  await page.getByRole("button", { name: /approve shopping list/i }).click();
  await expect(page.getByRole("heading", { name: /shopping with pantry rescue/i })).toBeVisible();
  await page.getByRole("button", { name: /demo market/i }).click();
  await page.getByLabel(/delivery location/i).fill("Oakville, ON");
  await page.getByRole("button", { name: /start live shopping agent/i }).click();
  await expect(page.getByTitle("Live Demo Market shopping browser")).toBeVisible();
  await expect(page.getByRole("button", { name: /walmart canada/i })).toHaveCount(0);
  await expect(page.locator(".grocery-tracker")).toContainText("parmesan");
  await page.getByRole("button", { name: /search approved products/i }).click();
  await expect(page.locator(".agent-progress").getByText("Searching for parmesan")).toBeVisible();
  expect(requested.map((item) => item.ingredient).sort()).toEqual(["garlic", "parmesan", "vegetable stock"]);
  await expect(page.getByRole("button", { name: "Approve product" })).toHaveCount(3);
  await page.locator(".cloud-receipts .cloud-receipt").first().getByRole("button", { name: "Choose another" }).click();
  await page.getByRole("button", { name: /Parmesan block.*Choose this/i }).click();
  await expect(page.locator(".cloud-receipts")).toContainText("Parmesan block");
  await page.getByText("Advanced details").click();
  await expect(page.locator(".advanced-details")).toContainText("900 mL");
  while (await page.getByRole("button", { name: "Approve product" }).count()) await page.getByRole("button", { name: "Approve product" }).first().click();
  await page.getByRole("button", { name: /add approved products to demo cart/i }).click();
  expect(approvedIds).toHaveLength(3);
  expect(approvedProducts.find((item) => item.ingredientId === "parmesan")?.retailerProductId).toBe("parmesan-large");
  await expect(page.getByRole("heading", { name: "Your cart is ready" })).toBeVisible();
  await expect(page.locator(".cart-review")).toContainText("Garlic bulb");
  await expect(page.locator(".cart-review")).toContainText("Qty 2");
  await expect(page.locator(".cart-review")).toContainText("900 mL");
  await expect(page.getByAltText("Final browser cart captured after cart verification")).toBeVisible();
  await expect(page.getByRole("button", { name: /take over & review cart/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /checkout|place order/i })).toHaveCount(0);
});

test("takeover pauses browser mutations until a fresh cart inspection resumes the agent", async ({ page }) => {
  let takeover = false;
  let inspected = false;
  await page.route("**/api/shopping/cloud-demo/status", (route) => route.fulfill({ json: { configured: true, sessionActive: false, message: "Ready to shop." } }));
  await page.route("**/api/shopping/cloud-demo/session", (route) => route.fulfill({ status: 201, json: { viewerUrl: "https://app.steel.dev/sessions/demo" } }));
  await page.route("**/api/shopping/cloud-demo/events", (route) => route.fulfill({ json: { events: [] } }));
  await page.route("**/api/shopping/cloud-demo/pause", (route) => { takeover = route.request().postDataJSON().takeover; void route.fulfill({ json: { paused: true, takeover: true } }); });
  await page.route("**/api/shopping/cloud-demo/resume", (route) => { inspected = true; void route.fulfill({ json: { paused: false, takeover: false, cartItems: [{ id: "garlic", name: "Garlic bulb", quantity: 2 }] } }); });
  await page.route("https://app.steel.dev/**", (route) => route.fulfill({ contentType: "text/html", body: "Live browser" }));
  await loadRescuePlan(page);
  await page.getByRole("button", { name: /review missing ingredients/i }).click();
  await page.getByRole("button", { name: /approve shopping list/i }).click();
  await page.getByRole("button", { name: /demo market/i }).click();
  await page.getByLabel(/delivery location/i).fill("Oakville, ON");
  await page.getByRole("button", { name: /start live shopping agent/i }).click();
  await page.getByRole("button", { name: "Take over" }).click();
  expect(takeover).toBe(true);
  await expect(page.getByRole("button", { name: /search approved products/i })).toBeDisabled();
  await expect(page.getByRole("button", { name: /walmart canada/i })).toHaveCount(0);
  await page.getByRole("button", { name: "Resume agent" }).click();
  expect(inspected).toBe(true);
  await expect(page.getByRole("heading", { name: "Fresh cart inspection" })).toBeVisible();
  await expect(page.getByRole("button", { name: /search approved products/i })).toBeEnabled();
});

test("live browser remains prominent on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/shopping/cloud-demo/status", (route) => route.fulfill({ json: { configured: true, sessionActive: false, message: "Ready." } }));
  await page.route("**/api/shopping/cloud-demo/session", (route) => route.fulfill({ status: 201, json: { viewerUrl: "https://app.steel.dev/sessions/demo" } }));
  await page.route("**/api/shopping/cloud-demo/events", (route) => route.fulfill({ json: { events: [] } }));
  await page.route("https://app.steel.dev/**", (route) => route.fulfill({ contentType: "text/html", body: "Live browser" }));
  await loadRescuePlan(page);
  await page.getByRole("button", { name: /review missing ingredients/i }).click();
  await page.getByRole("button", { name: /approve shopping list/i }).click();
  await page.getByRole("button", { name: /demo market/i }).click();
  await page.getByRole("button", { name: /start live shopping agent/i }).click();
  const viewer = await page.getByTitle("Live Demo Market shopping browser").boundingBox();
  const controls = await page.getByRole("complementary", { name: /shopping agent controls/i }).boundingBox();
  expect(viewer).not.toBeNull();
  expect(controls).not.toBeNull();
  expect(viewer!.width).toBeGreaterThan(300);
  expect(viewer!.height).toBeGreaterThanOrEqual(420);
  expect(controls!.y).toBeGreaterThan(viewer!.y + viewer!.height);
});

test("a lost browser connection disables new shopping actions", async ({ page }) => {
  await page.route("**/api/shopping/cloud-demo/status", (route) => route.fulfill({ json: { configured: true, sessionActive: false, message: "Ready." } }));
  await page.route("**/api/shopping/cloud-demo/session", (route) => route.fulfill({ status: 201, json: { viewerUrl: "https://app.steel.dev/sessions/demo" } }));
  await page.route("**/api/shopping/cloud-demo/events", (route) => route.fulfill({ status: 503, json: { error: "Disconnected" } }));
  await page.route("https://app.steel.dev/**", (route) => route.fulfill({ contentType: "text/html", body: "Disconnected" }));
  await loadRescuePlan(page);
  await page.getByRole("button", { name: /review missing ingredients/i }).click();
  await page.getByRole("button", { name: /approve shopping list/i }).click();
  await page.getByRole("button", { name: /demo market/i }).click();
  await page.getByLabel(/delivery location/i).fill("Oakville, ON");
  await page.getByRole("button", { name: /start live shopping agent/i }).click();
  await expect(page.getByRole("alert")).toContainText("live browser connection is unavailable");
  await expect(page.getByRole("button", { name: /search approved products/i })).toBeDisabled();
});
