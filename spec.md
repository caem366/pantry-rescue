# Pantry Rescue technical specification

## Stack and architecture

`React 19 + TypeScript + Vite` provides the single-page UI. `Node.js + TypeScript` (`app/server`) provides `/api` endpoints, keeps credentials server-side, and connects to public price data and optional Steel sessions. Playwright runs browser tests and drives only the controlled Demo Market through a Steel session.

```
React pantry / planner UI
  → approved MissingIngredient[]
  → Node shopping service
  → read-only epiceries.ca comparison OR Steel-controlled Demo Market
```

## Responsibilities

- `App.tsx`: localStorage pantry, demo inventory, basic validation, routes.
- `PlannerPanel.tsx`: recipes, gaps, approvals, comparison and demo controls.
- `lib/rescuePlan.ts`: deterministic plan and gaps.
- `lib/shoppingAgent.ts`: matching, exact-product selection, cart verification states.
- `server/epiceriesProvider.ts`: observed Canadian listings, price timestamps, source links.
- `server/steelDemoAgent.ts`: controlled-store Steel + Playwright session, screenshots and reconciliation.

## Key models

- `PantryItem`: name, free-text amount, zone, optional use-soon days.
- `MissingIngredient`: normalised requested ingredient, quantity, and unit.
- `ProductSelection`: requested item, candidate product, package count, and explanation.
- `ShoppingResult`: `ADDED`, `NEEDS_ATTENTION`, or `SKIPPED`; `ADDED` requires adapter verification.
- `AgentProgressEvent`: observable discovery/matching/cart progress, status, timestamp.

## API behaviour

`POST /api/shopping/canadian/compare` receives approved gaps plus postal-code context and fulfillment preference. It returns observed price candidates, sources, warnings, and timestamps. The provider does not establish local availability or checkout totals.

Cloud Demo endpoints create/status/pause/resume/release a server-side Steel session and preview or run only approved Demo Market products. A browser disconnection, expired session, uncertain cart, or failed verification remains visible as a warning/needs-attention state.

## Security and privacy

The pantry remains browser-local. `.env` keys, Steel session identifiers, and any OAuth tokens are server-only and excluded from version control. No retailer password, payment data, or checkout action is collected. Exact product approval is required before a cart mutation.

## Testing and deployment

Run `npm run build`, `npm run lint`, and `npm run test:browser -- --reporter=line` from `app/`. `npm run test:walmart:live` is read-only and needs network access. `npm run test:steel:recipe` needs configured Steel credentials plus a reachable controlled store.

`netlify.toml` builds the Vite frontend and includes SPA routing. It does **not** deploy the Node API. The frontend reads optional public `VITE_API_BASE_URL`; blank preserves local `/api` proxy behavior. A long-running Node host is required because the service retains short-lived Steel session/review state. It exposes `GET /health`, binds to host-provided `PORT` and `0.0.0.0`, permits only configured `CORS_ORIGINS`, and caps concurrent Demo Market sessions with `MAX_CLOUD_SESSIONS`. `render.yaml` and `DEPLOYMENT.md` prepare this path; a public service has not yet been deployed or tested.
