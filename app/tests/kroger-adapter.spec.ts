import { expect, test } from "@playwright/test";
import { KrogerAdapter } from "../server/krogerAdapter.ts";
import { KrogerOAuth } from "../server/krogerOAuth.ts";
import { addApprovedProduct, findProductSelection, type MissingIngredient } from "../src/lib/shoppingAgent.ts";

const lemon: MissingIngredient = { id: "lemons", ingredient: "lemons", requiredQuantity: 3, unit: "each" };

test("Kroger product search uses the authorized location and maps UPC, size, and price", async () => {
  let requestedUrl = "";
  const adapter = new KrogerAdapter({
    accessToken: "test-access-token",
    locationId: "location-1",
    fetcher: async (input, init) => {
      requestedUrl = String(input);
      expect(init?.headers).toMatchObject({ Authorization: "Bearer test-access-token" });
      return Response.json({ data: [{ upc: "012345678901", description: "Lemon", brand: "Fresh", items: [{ upc: "012345678901", size: "1 ct", price: { regular: 0.79 } }] }] });
    },
  });
  const products = await adapter.searchProducts(lemon);
  expect(new URL(requestedUrl).searchParams.get("filter.locationId")).toBe("location-1");
  expect(products[0]).toMatchObject({
    retailerProductId: "012345678901",
    name: "Lemon",
    packageQuantity: 1,
    packageUnit: "each",
    price: 0.79,
    available: true,
  });
});

test("a successful Kroger cart write stays unverified until a person reviews the real cart", async () => {
  const calls: { url: string; method: string }[] = [];
  const adapter = new KrogerAdapter({
    accessToken: "test-access-token",
    locationId: "location-1",
    fetcher: async (input, init) => {
      calls.push({ url: String(input), method: init?.method ?? "GET" });
      return Response.json({
        data: [{
          upc: "012345678901",
          description: "Lemon",
          items: [{ upc: "012345678901", size: "1 ct" }],
        }],
      });
    },
  });
  const review = await findProductSelection(adapter, lemon);
  expect(calls).toHaveLength(1);
  const result = await addApprovedProduct(adapter, review.selection!);
  expect(result.status).toBe("NEEDS_ATTENTION");
  expect(result.cartActionSucceeded).toBe(true);
  expect(result.selection?.quantity).toBe(3);
  expect(calls).toHaveLength(2);
  expect(calls[1]).toMatchObject({ url: "https://api.kroger.com/v1/cart/add", method: "PUT" });
  expect(calls.some((call) => /checkout|order/i.test(call.url))).toBe(false);
});

test("Kroger cart writes are not retried after an ambiguous server response", async () => {
  let cartWrites = 0;
  const adapter = new KrogerAdapter({
    accessToken: "test-access-token",
    locationId: "location-1",
    fetcher: async (input, init) => {
      if (String(input).endsWith("/products?filter.term=lemons&filter.limit=20&filter.locationId=location-1")) {
        return Response.json({ data: [{ upc: "012345678901", description: "Lemon", items: [{ upc: "012345678901", size: "1 ct" }] }] });
      }
      if (init?.method === "PUT") {
        cartWrites += 1;
        return new Response(null, { status: 503 });
      }
      throw new Error("Unexpected Kroger request.");
    },
  });
  const review = await findProductSelection(adapter, lemon);
  const result = await addApprovedProduct(adapter, review.selection!);
  expect(result.status).toBe("NEEDS_ATTENTION");
  expect(result.cartActionSucceeded).toBeUndefined();
  expect(cartWrites).toBe(1);
});

test("Kroger OAuth state is session-bound and stores the returned access token privately", async () => {
  const auth = new KrogerOAuth({
    clientId: "public-client-id",
    clientSecret: "test-client-secret",
    redirectUri: "http://127.0.0.1:3000/api/shopping/kroger/callback",
  }, async (_input, init) => {
    expect(init?.method).toBe("POST");
    expect(String(init?.body)).toContain("grant_type=authorization_code");
    return Response.json({ access_token: "private-token", expires_in: 3600 });
  });
  const authorizationUrl = new URL(auth.begin("browser-session", "http://127.0.0.1:5173/planner"));
  expect(authorizationUrl.origin).toBe("https://api.kroger.com");
  expect(authorizationUrl.searchParams.get("scope")).toContain("cart.basic:write");
  const state = authorizationUrl.searchParams.get("state") ?? "";
  await expect(auth.complete("different-session", state, "oauth-code"))
    .rejects.toThrow(/state is invalid/i);
  const newUrl = new URL(auth.begin("browser-session", "https://attacker.example/path"));
  const returnTo = await auth.complete("browser-session", newUrl.searchParams.get("state") ?? "", "oauth-code");
  expect(returnTo).toBe("http://127.0.0.1:5173");
  expect(auth.getAccessToken("browser-session")).toBe("private-token");
});

test("Kroger candidates are not auto-selected when dietary attributes cannot be verified", async () => {
  const constrained = { ...lemon, dietaryConstraints: ["organic"] };
  const adapter = new KrogerAdapter({
    accessToken: "test-access-token",
    locationId: "location-1",
    fetcher: async () => Response.json({
      data: [{ upc: "012345678901", description: "Lemon", items: [{ upc: "012345678901", size: "1 ct" }] }],
    }),
  });
  const result = await findProductSelection(adapter, constrained);
  expect(result.selection).toBeUndefined();
  expect(result.message).toMatch(/no confident available product match/i);
});
