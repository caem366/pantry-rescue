import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { previewKrogerShopping, refreshKrogerSelections, runKrogerShopping } from "./shoppingService.ts";
import { KrogerOAuth } from "./krogerOAuth.ts";
import { buildCloudDemoBasket, cloudDemoConfigured, cloudDemoSessionEvents, cloudDemoSessionStatus, pauseCloudDemoSession, previewCloudDemoBasket, recordCloudDemoEvent, releaseCloudDemoSession, resumeCloudDemoSession, resumeCloudSessionAfterInspection, startCloudDemoSession } from "./steelDemoAgent.ts";
import { progress } from "../src/lib/agentProgress.ts";
import { buildWalmartBasket, forgetWalmartPreview, inspectWalmartCart, openWalmartHome, previewWalmartBasket } from "./walmartBrowserAgent.ts";
import type { MissingIngredient, ProductSelection, Unit } from "../src/lib/shoppingAgent.ts";
import { canadianRetailerDiscoveryAdapters } from "../src/lib/retailerDiscovery.ts";
import { compareBaskets } from "../src/lib/basketOptimizer.ts";
import { createEpiceriesStoreAdapters, discoverEpiceriesOffers } from "./epiceriesProvider.ts";
import { searchSourcedRecipes } from "./mealDbProvider.ts";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";
const cookieName = "pantry_kroger_session";
const allowedOrigins = (process.env.CORS_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
const units = new Set<Unit>(["g", "kg", "mL", "L", "each"]);
const sessions = new Set<string>();
const pendingKrogerPreviews = new Map<string, { id: string; selections: ProductSelection[]; expiresAt: number }>();
const oauth = new KrogerOAuth({
  clientId: process.env.KROGER_CLIENT_ID ?? "",
  clientSecret: process.env.KROGER_CLIENT_SECRET ?? "",
  redirectUri: process.env.KROGER_REDIRECT_URI ?? "",
});
const locationId = process.env.KROGER_LOCATION_ID ?? "";
const cloudDemoConfig = { apiKey: process.env.STEEL_API_KEY ?? "", marketUrl: process.env.DEMO_MARKET_URL ?? "" };
const cloudSessions = new Map<string, string>();
const walmartConfig = { apiKey: process.env.STEEL_API_KEY ?? "", marketUrl: "https://www.walmart.ca/" };
const walmartBrowserEnabled = process.env.WALMART_BROWSER_ENABLED === "true";
const walmartSessions = new Map<string, string>();
const maxCloudSessions = Math.max(1, Math.min(Number(process.env.MAX_CLOUD_SESSIONS ?? 3), 10));

class RequestError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

function sendJson(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
}

function applyCors(request: IncomingMessage, response: ServerResponse) {
  const origin = request.headers.origin;
  if (!origin || !allowedOrigins.includes(origin)) return;
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Vary", "Origin");
}

function cookieValue(request: IncomingMessage): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  const pair = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  return pair?.slice(cookieName.length + 1);
}

function sessionId(request: IncomingMessage, response: ServerResponse): string {
  const existing = cookieValue(request);
  if (existing && sessions.has(existing)) return existing;
  const created = randomUUID();
  sessions.add(created);
  const crossSite = allowedOrigins.length > 0 ? "; SameSite=None; Secure" : "; SameSite=Lax";
  response.setHeader("Set-Cookie", `${cookieName}=${created}; HttpOnly${crossSite}; Path=/; Max-Age=86400`);
  return created;
}

function isMissingIngredient(value: unknown): value is MissingIngredient {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && item.id.length > 0 && item.id.length <= 100
    && typeof item.ingredient === "string" && item.ingredient.trim().length > 0 && item.ingredient.length <= 120
    && typeof item.requiredQuantity === "number" && Number.isFinite(item.requiredQuantity)
    && item.requiredQuantity > 0 && item.requiredQuantity <= 100_000
    && typeof item.unit === "string" && units.has(item.unit as Unit)
    && (item.dietaryConstraints === undefined || (Array.isArray(item.dietaryConstraints)
      && item.dietaryConstraints.every((constraint) => typeof constraint === "string" && constraint.length <= 80)))
    && (item.searchTerms === undefined || (Array.isArray(item.searchTerms) && item.searchTerms.length <= 8
      && item.searchTerms.every((term) => typeof term === "string" && term.trim().length > 0 && term.length <= 100)))
    && (item.brandPreference === undefined || (typeof item.brandPreference === "string" && item.brandPreference.length <= 80));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (Buffer.byteLength(raw) > 64_000) throw new RequestError(413, "Request body is too large.");
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    if (error instanceof SyntaxError) throw new RequestError(400, "Request body must contain valid JSON.");
    throw error;
  }
}

function html(response: ServerResponse, status: number, message: string) {
  response.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  response.end(`<!doctype html><title>Kroger connection</title><main><h1>Kroger connection</h1><p>${message.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character] ?? character)}</p><p>Return to Pantry Rescue and try again.</p></main>`);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
  try {
    applyCors(request, response);
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }
    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { ok: true, service: "pantry-rescue-shopping", time: new Date().toISOString() });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/shopping/kroger/status") {
      const id = sessionId(request, response);
      const authorized = Boolean(oauth.getAccessToken(id));
      sendJson(response, 200, {
        retailer: "kroger",
        configured: oauth.configured,
        authorized,
        locationConfigured: Boolean(locationId),
        cartVerification: false,
        message: !oauth.configured
          ? "Add Kroger developer-app credentials and a registered callback URL to the local shopping service."
          : !locationId
            ? "Add a Kroger location ID to the local shopping service so product availability is location-specific."
            : authorized
              ? "Connected through Kroger OAuth. Cart writes still require review in Kroger because API cart read-back is not verified."
              : "Connect through Kroger's official login and consent page to continue.",
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/shopping/retailers/discovery") {
      sendJson(response, 200, canadianRetailerDiscoveryAdapters.map(({ id, name, capabilities, access }) => ({ id, name, capabilities, access })));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/recipes/discover") {
      const query = url.searchParams.get("q")?.trim() ?? "";
      if (!query || query.length > 80) throw new RequestError(400, "Provide a recipe search between 1 and 80 characters.");
      sendJson(response, 200, { provider: "TheMealDB", recipes: await searchSourcedRecipes(query) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/shopping/canadian/compare") {
      const body = await readJson(request) as { ingredients?: unknown; postalCode?: unknown; fulfillment?: unknown };
      if (!Array.isArray(body.ingredients) || body.ingredients.length === 0 || body.ingredients.length > 25
        || !body.ingredients.every(isMissingIngredient)) {
        throw new RequestError(400, "ingredients must be a non-empty list of up to 25 approved grocery gaps.");
      }
      if (typeof body.postalCode !== "string" || !/^[A-Z]\d[A-Z][ -]?\d[A-Z]\d$/i.test(body.postalCode.trim())) {
        throw new RequestError(400, "Enter a valid Canadian postal code.");
      }
      if (body.fulfillment !== "pickup" && body.fulfillment !== "delivery") {
        throw new RequestError(400, "fulfillment must be pickup or delivery.");
      }

      const postalCode = body.postalCode.replace(/\s+/g, "").toUpperCase();
      const discovery = await discoverEpiceriesOffers(body.ingredients);
      const options = await compareBaskets(
        createEpiceriesStoreAdapters(discovery.candidatesByStore),
        discovery.ingredients,
      );
      sendJson(response, 200, {
        source: "épiceries.ca",
        sourceUrl: "https://epiceries.ca",
        searchedAt: discovery.searchedAt,
        request: { postalCode, fulfillment: body.fulfillment },
        locationNote: "The provider reports chain-level price observations, not postal-code-specific store inventory, pickup, delivery, fees, or checkout totals.",
        warnings: discovery.warnings,
        options: options.map((option) => ({ ...option, dataSource: "épiceries.ca", availabilityVerified: false })),
      });
      return;
    }

    if (url.pathname.startsWith("/api/shopping/cloud-walmart/")) {
      const id = sessionId(request, response);
      const browserSessionId = walmartSessions.get(id);
      const action = url.pathname.slice("/api/shopping/cloud-walmart/".length);
      if (request.method === "GET" && action === "status") {
        let state = {};
        if (browserSessionId) {
          try { state = cloudDemoSessionStatus(browserSessionId); }
          catch { walmartSessions.delete(id); forgetWalmartPreview(browserSessionId); }
        }
        sendJson(response, 200, { configured: walmartBrowserEnabled && Boolean(walmartConfig.apiKey), sessionActive: "sessionId" in state, ...state,
          message: !walmartBrowserEnabled ? "Walmart browser shopping is disabled until this deployment is configured for an authorized integration." : walmartConfig.apiKey ? "Choose your store or delivery area in the live Walmart browser before searching. Local stock is not independently verified." : "Steel is not configured on the shopping service." });
        return;
      }
      if (!walmartBrowserEnabled) throw new RequestError(403, "Walmart browser shopping is not enabled on this deployment.");
      if (request.method === "POST" && action === "session") {
        if (browserSessionId) { await releaseCloudDemoSession(walmartConfig, browserSessionId); forgetWalmartPreview(browserSessionId); walmartSessions.delete(id); }
        if (walmartSessions.size + cloudSessions.size >= maxCloudSessions) throw new RequestError(429, "All browser sessions are busy.");
        const started = await startCloudDemoSession(walmartConfig);
        try { await openWalmartHome(walmartConfig, started.id); }
        catch (error) { await releaseCloudDemoSession(walmartConfig, started.id); throw error; }
        walmartSessions.set(id, started.id);
        sendJson(response, 201, { sessionId: started.id, viewerUrl: started.viewerUrl, expiresAt: new Date(started.expiresAt).toISOString() });
        return;
      }
      if (!browserSessionId) throw new RequestError(409, "Start a Walmart browser session first.");
      if (request.method === "GET" && action === "events") { sendJson(response, 200, { events: cloudDemoSessionEvents(browserSessionId) }); return; }
      if (request.method === "POST" && action === "preview") {
        const body = await readJson(request) as { ingredients?: unknown; postalCode?: unknown; locationConfirmed?: unknown };
        if (!Array.isArray(body.ingredients) || !body.ingredients.length || body.ingredients.length > 25 || !body.ingredients.every(isMissingIngredient)) throw new RequestError(400, "Send up to 25 approved grocery gaps.");
        if (typeof body.postalCode !== "string" || !/^[A-Z]\d[A-Z][ -]?\d[A-Z]\d$/i.test(body.postalCode.trim())) throw new RequestError(400, "Enter a valid Canadian postal code.");
        if (body.locationConfirmed !== true) throw new RequestError(400, "Confirm the store or delivery area in the live Walmart browser before searching.");
        sendJson(response, 200, await previewWalmartBasket(walmartConfig, browserSessionId, body.ingredients, body.postalCode.replace(/\s+/g, "").toUpperCase()));
        return;
      }
      if (request.method === "POST" && action === "build") {
        const body = await readJson(request) as { previewId?: unknown; approvedIngredientIds?: unknown; approvedProducts?: unknown };
        if (typeof body.previewId !== "string" || !Array.isArray(body.approvedIngredientIds) || !body.approvedIngredientIds.every((value) => typeof value === "string")) throw new RequestError(400, "Approve the exact product selections before changing the cart.");
        if (body.approvedProducts !== undefined && (!Array.isArray(body.approvedProducts) || !body.approvedProducts.every((item) => item && typeof item === "object" && typeof item.ingredientId === "string" && typeof item.retailerProductId === "string"))) throw new RequestError(400, "Approve an exact Walmart product for each ingredient.");
        sendJson(response, 200, await buildWalmartBasket(walmartConfig, browserSessionId, body.previewId, body.approvedIngredientIds, body.approvedProducts as { ingredientId: string; retailerProductId: string }[] | undefined));
        return;
      }
      if (request.method === "POST" && action === "pause") {
        const body = await readJson(request) as { takeover?: unknown };
        sendJson(response, 200, pauseCloudDemoSession(browserSessionId, body.takeover === true));
        return;
      }
      if (request.method === "POST" && action === "resume") {
        recordCloudDemoEvent(browserSessionId, progress("CART", "Verifying cart", "ACTIVE"));
        const inspection = await inspectWalmartCart(walmartConfig, browserSessionId);
        recordCloudDemoEvent(browserSessionId, progress("CART", "Verifying cart", "COMPLETE", `${inspection.cartItems.length} cart line${inspection.cartItems.length === 1 ? "" : "s"} found before resuming.`));
        sendJson(response, 200, { ...resumeCloudSessionAfterInspection(browserSessionId), ...inspection });
        return;
      }
      if (request.method === "POST" && action === "release") {
        await releaseCloudDemoSession(walmartConfig, browserSessionId);
        forgetWalmartPreview(browserSessionId);
        walmartSessions.delete(id);
        sendJson(response, 200, { released: true });
        return;
      }
      throw new RequestError(404, "Walmart browser route not found.");
    }

    if (request.method === "GET" && url.pathname === "/api/shopping/cloud-demo/status") {
      const id = sessionId(request, response);
      const browserSessionId = cloudSessions.get(id);
      let sessionState = {};
      let sessionMessage = cloudDemoConfigured(cloudDemoConfig)
        ? "Steel is configured. Start a cloud browser session to run the protected Demo Market proof."
        : "Add STEEL_API_KEY and DEMO_MARKET_URL to app/.env. DEMO_MARKET_URL must be the protected HTTPS Netlify preview for Demo Market.";
      if (browserSessionId) {
        try { sessionState = cloudDemoSessionStatus(browserSessionId); }
        catch (error) {
          cloudSessions.delete(id);
          sessionMessage = error instanceof Error ? error.message : "The cloud browser session is no longer available. Start a new session.";
        }
      }
      sendJson(response, 200, {
        configured: cloudDemoConfigured(cloudDemoConfig),
        sessionActive: Boolean(browserSessionId && "sessionId" in sessionState),
        ...sessionState,
        message: sessionMessage,
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/shopping/cloud-demo/session") {
      const id = sessionId(request, response);
      const existing = cloudSessions.get(id);
      if (!existing && cloudSessions.size + walmartSessions.size >= maxCloudSessions) {
        throw new RequestError(429, "Demo Market is busy. Try again after another browser session finishes.");
      }
      if (existing) await releaseCloudDemoSession(cloudDemoConfig, existing);
      const session = await startCloudDemoSession(cloudDemoConfig);
      cloudSessions.set(id, session.id);
      sendJson(response, 201, { sessionId: session.id, viewerUrl: session.viewerUrl, expiresAt: new Date(session.expiresAt).toISOString() });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/shopping/cloud-demo/events") {
      const browserSessionId = cloudSessions.get(sessionId(request, response));
      if (!browserSessionId) throw new RequestError(409, "Start a cloud browser session before reading agent progress.");
      sendJson(response, 200, { events: cloudDemoSessionEvents(browserSessionId) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/shopping/cloud-demo/preview") {
      const id = sessionId(request, response);
      const browserSessionId = cloudSessions.get(id);
      if (!browserSessionId) throw new RequestError(409, "Start a cloud browser session before searching Demo Market.");
      const body = await readJson(request) as { ingredients?: unknown; deliveryLocation?: unknown };
      if (!Array.isArray(body.ingredients) || body.ingredients.length === 0 || body.ingredients.length > 25 || !body.ingredients.every(isMissingIngredient)) {
        throw new RequestError(400, "ingredients must be a non-empty list of up to 25 approved grocery gaps.");
      }
      if (typeof body.deliveryLocation !== "string" || !body.deliveryLocation.trim() || body.deliveryLocation.length > 160) {
        throw new RequestError(400, "Enter a delivery location before the cloud-browser shopping proof.");
      }
      sendJson(response, 200, await previewCloudDemoBasket(cloudDemoConfig, browserSessionId, body.ingredients));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/shopping/cloud-demo/build") {
      const id = sessionId(request, response);
      const browserSessionId = cloudSessions.get(id);
      if (!browserSessionId) throw new RequestError(409, "Start a cloud browser session before building a Demo Market cart.");
      const body = await readJson(request) as { previewId?: unknown; approvedIngredientIds?: unknown; approvedProducts?: unknown };
      if (typeof body.previewId !== "string" || !Array.isArray(body.approvedIngredientIds) || !body.approvedIngredientIds.every((value) => typeof value === "string")) {
        throw new RequestError(400, "Send the cloud preview ID and every approved ingredient ID before building the cart.");
      }
      if (body.approvedProducts !== undefined && (!Array.isArray(body.approvedProducts) || !body.approvedProducts.every((item) => item && typeof item === "object" && typeof item.ingredientId === "string" && typeof item.retailerProductId === "string"))) throw new RequestError(400, "Approve an exact Demo Market product for each ingredient.");
      sendJson(response, 200, await buildCloudDemoBasket(cloudDemoConfig, browserSessionId, body.previewId, body.approvedIngredientIds, body.approvedProducts as { ingredientId: string; retailerProductId: string }[] | undefined));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/shopping/cloud-demo/pause") {
      const id = sessionId(request, response);
      const browserSessionId = cloudSessions.get(id);
      if (!browserSessionId) throw new RequestError(409, "Start a cloud browser session before taking control.");
      const body = await readJson(request) as { takeover?: unknown };
      sendJson(response, 200, pauseCloudDemoSession(browserSessionId, body.takeover === true));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/shopping/cloud-demo/resume") {
      const id = sessionId(request, response);
      const browserSessionId = cloudSessions.get(id);
      if (!browserSessionId) throw new RequestError(409, "Start a cloud browser session before resuming the agent.");
      sendJson(response, 200, await resumeCloudDemoSession(cloudDemoConfig, browserSessionId));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/shopping/cloud-demo/release") {
      const id = sessionId(request, response);
      const browserSessionId = cloudSessions.get(id);
      if (browserSessionId) await releaseCloudDemoSession(cloudDemoConfig, browserSessionId);
      cloudSessions.delete(id);
      sendJson(response, 200, { released: true });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/shopping/kroger/connect") {
      const id = sessionId(request, response);
      if (!oauth.configured) {
        sendJson(response, 503, { error: "Kroger developer-app credentials are not configured on the local shopping service." });
        return;
      }
      const referer = request.headers.referer;
      const authUrl = oauth.begin(id, referer);
      response.writeHead(302, { Location: authUrl, "Cache-Control": "no-store" });
      response.end();
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/shopping/kroger/callback") {
      const id = cookieValue(request);
      const state = url.searchParams.get("state") ?? "";
      const code = url.searchParams.get("code") ?? "";
      if (url.searchParams.has("error")) {
        html(response, 400, "Kroger authorization was not completed. No cart action was taken.");
        return;
      }
      if (!id || !sessions.has(id) || !state || !code) {
        html(response, 400, "The authorization callback is incomplete or its local session expired.");
        return;
      }
      const returnTo = await oauth.complete(id, state, code);
      response.writeHead(303, { Location: `${returnTo}/#planner&kroger-connected`, "Cache-Control": "no-store" });
      response.end();
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/shopping/kroger/disconnect") {
      const id = cookieValue(request);
      if (id) {
        oauth.disconnect(id);
        pendingKrogerPreviews.delete(id);
      }
      sendJson(response, 200, { disconnected: true });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/shopping/kroger/preview") {
      const id = cookieValue(request);
      const token = id ? oauth.getAccessToken(id) : undefined;
      if (!token || !id) {
        sendJson(response, 401, { error: "Connect Kroger through its official login before building a cart." });
        return;
      }
      if (!locationId) {
        sendJson(response, 503, { error: "A Kroger location ID is required to search and match products." });
        return;
      }
      const body = await readJson(request) as { ingredients?: unknown };
      if (!Array.isArray(body.ingredients) || body.ingredients.length === 0 || body.ingredients.length > 25
        || !body.ingredients.every(isMissingIngredient)) {
        sendJson(response, 400, { error: "ingredients must be a non-empty list of up to 25 approved grocery gaps." });
        return;
      }
      const preview = await previewKrogerShopping(body.ingredients, { accessToken: token, locationId });
      const previewId = randomUUID();
      pendingKrogerPreviews.set(id, { id: previewId, selections: preview.selections, expiresAt: Date.now() + 5 * 60_000 });
      sendJson(response, 200, { ...preview, previewId });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/shopping/kroger/shop") {
      const id = cookieValue(request);
      const token = id ? oauth.getAccessToken(id) : undefined;
      if (!token || !id) {
        sendJson(response, 401, { error: "Connect Kroger through its official login before building a cart." });
        return;
      }
      if (!locationId) {
        sendJson(response, 503, { error: "A Kroger location ID is required to search and match products." });
        return;
      }
      const body = await readJson(request) as { previewId?: unknown; approvedIngredientIds?: unknown };
      const pending = pendingKrogerPreviews.get(id);
      if (!pending || pending.expiresAt <= Date.now() || pending.id !== body.previewId) {
        pendingKrogerPreviews.delete(id);
        sendJson(response, 409, { error: "This product review has expired. Search again and approve the current products." });
        return;
      }
      if (!Array.isArray(body.approvedIngredientIds)
        || body.approvedIngredientIds.length !== pending.selections.length
        || !body.approvedIngredientIds.every((value) => typeof value === "string")
        || new Set(body.approvedIngredientIds).size !== pending.selections.length
        || !pending.selections.every((selection) => body.approvedIngredientIds!.includes(selection.ingredient.id))) {
        sendJson(response, 400, { error: "Approve every exact product selection from this review before building the Kroger cart." });
        return;
      }
      pendingKrogerPreviews.delete(id);
      const refreshed = await refreshKrogerSelections(pending.selections, { accessToken: token, locationId });
      if (!refreshed.unchanged) {
        sendJson(response, 409, { error: "A selected product, package quantity, price, or availability changed. Search again and approve the updated products." });
        return;
      }
      const run = await runKrogerShopping(pending.selections, { accessToken: token, locationId });
      sendJson(response, 200, run);
      return;
    }

    sendJson(response, 404, { error: "Shopping service route not found." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected shopping-service failure.";
    console.error(JSON.stringify({ event: "shopping_service_error", route: url.pathname, message }));
    if (error instanceof RequestError) {
      sendJson(response, error.statusCode, { error: message });
      return;
    }
    if (url.pathname === "/api/shopping/kroger/callback") {
      html(response, 400, message);
      return;
    }
    sendJson(response, 500, { error: message });
  }
});

server.listen(port, host, () => console.log(`Pantry Rescue shopping service listening on http://${host}:${port}`));
