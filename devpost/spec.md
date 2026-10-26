---
doc: spec
status: approved
---

# Pantry Rescue — Technical Spec

> **Submission status (October 25, 2026):** This approved spec preserves the initial technical design, including proposed Kroger/Uber paths and a file tree that predates the current app. Treat those sections as planning history, not an as-built description. The verified browser-cart workflow is the controlled Demo Market using Steel/Playwright. Walmart Canada is experimental; live product matching and cart addition have not been fully verified. Kroger, Uber Eats, and DoorDash are not functioning submission integrations. The root-level `scope.md`, `prd.md`, and `spec.md` describe the current architecture and boundaries.

## How This Works, In Plain Language

Pantry Rescue is a small app that runs in one browser. React is the tool that redraws the interface as the user adds ingredients, changes preferences, approves a plan, and watches the shopping task progress. A small, curated recipe catalog ships inside the app. A deterministic rescue scorer compares each recipe to the current pantry and constraints, so results, missing quantities, and explanations are genuinely calculated without needing an AI-model key or external service.

The browser keeps the current pantry and latest plan in `localStorage`—a persistent browser note for this one app—so a refresh does not erase the demo. Grounded pantry/recipe data and deterministic calculations establish recipe compatibility, owned and use-soon ingredients, rescue value, plan combinations, and missing quantities. The shopping task receives only the user's approved missing ingredients. After catalog matching, the UI presents the exact products and quantities for a second approval before any cart write. The Kroger adapter uses Kroger's official product and cart APIs through a local Node.js/TypeScript service after user OAuth authorization; it does not automate the retailer website. Kroger's cart-write response has no verified read-back in this implementation, so a write is explicitly reported as unverified until the user inspects the real cart and confirms it. Demo Market and the Uber demonstration use local product fixtures and simulated carts, clearly labelled as simulations and not real retailer integrations.

No payment details, checkout, order placement, CAPTCHA handling, or anti-bot circumvention are part of the service. Real Kroger use requires the user's own registered developer app, local credentials, callback configuration, and store location.

## The Core Journey Through the System

Implements `prd.md > The Core Journey`.

1. The user opens the local React app. `App` reads the saved pantry and app view from browser storage, or begins on the empty pantry screen.
2. `PantrySetup` validates a manual item or loads `samplePantry`. `storage` persists the updated array and `InventoryList` redraws it.
3. `PlanningConstraints` collects meal count, dietary preference, exclusions, and rescue priority in local component state. On **Build my rescue plan**, `planMeals` filters the recipe catalog then scores eligible combinations against pantry items.
4. `planMeals` returns either a plan or an explicit `need-inventory`, `constraint-conflict`, or `low-rescue` result. `PlanResults` presents the appropriate screen, meal explanations, impact totals, and deduplicated shopping gaps.
5. Editing a meal or missing quantity reruns the same planner; no shopping task can start until the user approves the current resulting gaps.
6. The user approves the exact shopping gaps, then chooses among the authorized Kroger API, an explicitly simulated Demo Market or Uber demonstration, and unavailable live Uber.
7. `ShoppingAgent` turns each approved gap into a queued task. An enabled adapter searches its catalog, matches name, package quantity, availability, and supported constraints, then returns a proposed product basket without mutating a cart.
8. The user reviews every proposed product, requested quantity, and any substitution, then explicitly approves that exact basket. Only that approved selection can reach a cart-write method. If price, availability, or substitution changes materially before a live write, stop and request approval again.
9. `CartReview` reconciles every approved gap with an individual result. Kroger cart writes remain `NEEDS_ATTENTION` until the user inspects the real cart and confirms an item; a simulation verifies only its own simulated cart. All paths stop before checkout.

## Stack

- **React + TypeScript** — learner-approved for a multi-screen interactive UI with type-checked app data. React documentation: [installation](https://react.dev/learn/installation).
- **Vite React TypeScript template** — learner-approved fast local development/build setup. Use the current `react-ts` template at build time, not pinned speculative versions. Vite documentation: [Getting Started](https://vite.dev/guide/). Current Vite documentation requires Node.js 20.19+ or 22.12+; verify local Node before scaffolding.
- **CSS modules or one app-level CSS file** — no component-library dependency; the custom consumer-grocery visual direction matters more than speed from a generic UI kit.
- **Browser `localStorage`** — local persistence for pantry and latest plan; no user identity, hosted database, or sync.
- **Node.js + TypeScript shopping service** — keeps Kroger credentials and OAuth tokens off the frontend and only accepts approved shopping gaps.
- **Kroger official API** — user-authorized product search and cart writes; local setup requires a registered app and location ID. Cart writes are not described as verified without cart read-back.
- **Uber Eats Consumer Delivery API** — no live adapter is enabled without Uber-granted project access, detailed endpoint and scope documentation, test credentials, and a verified cart contract. Public documentation is insufficient to infer an endpoint or OAuth scope. A separately labelled local simulation is available for the demo and cannot affect an Uber account.
- **Playwright** — tests the app's controlled simulated Demo Market path; it is not used to automate Kroger.
- **No external AI or recipe API** — a curated data catalog keeps plan generation deterministic and credential-free. The live retailer adapter is an agent/browser capability to validate early, never a presumed DoorDash API integration.

## Where It Runs and How Someone Tries It

Run locally on a current Node.js installation meeting Vite’s documented requirement. From `app/`:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://127.0.0.1:5173`) in a modern browser. The Kroger path also requires a registered Kroger developer app and values in `app/.env` based on `app/.env.example`, including the exact registered callback URL and a store location ID. Start the app and shopping service in separate terminals from `app/` with `npm run dev` and `npm run shopping:service`. For a simulated demo, load the sample pantry, approve the missing gaps, review and approve the exact products and quantities, then inspect the clearly labelled simulated cart. For a live Kroger attempt, connect through Kroger's consent page and manually inspect its real cart; checkout is never performed. Live Uber remains unavailable until access prerequisites are met.

Use `npm run build` before recording to validate a production build. The required submission remains a short video plus public GitHub repository; deployment is intentionally deferred and local recording is the learner’s choice.

## Look and Feel

Implements `prd.md > Look and Feel`. Use CSS custom properties for cream `#F7F4EB`, deep green `#16352D`, herb green `#1E765B`, mint `#D9F1E4`, coral `#E97959`, and muted natural neutrals. Use an editorial headline stack with a highly readable sans-serif system fallback for operational controls; do not add a remote font dependency for the POC.

Kitchen views use warm background, soft rounded cards, generous whitespace, ingredient chips, and optionally local/remote placeholder food images only if they do not distract from functionality. Agent mode uses the same palette but a denser, high-contrast progress panel. Use-soon is always a coral treatment plus text, while Rescued/Added uses mint/herb green plus text. Avoid generic AI visual cues, glass effects, neon gradients, robots, and anxiety-inducing warning states.

## Components

### App and Navigation

Owns current view and shared pantry, plan, retailer, shopping task, and cart data. Implements `prd.md > The Core Journey`; routes can be simple in-app view state rather than a routing library because the POC has one linear flow.

### PantrySetup and InventoryList

Implements `prd.md > Inventory Establishment` and `Screens and Layout > Pantry Setup`. Provides the value proposition, manual entry, sample load, editable rows, use-soon label, and **Plan with what I have** threshold.

### PlanningConstraints

Implements `prd.md > Constraint-Based Rescue Planning` and `Screens and Layout > Planning Constraints`. Collects the narrow, approved constraints and invokes `planMeals`.

### PlanResults and MealCard

Implements `prd.md > Explainable Rescue Plan` and `Screens and Layout > Rescue Plan and Approval`. Displays plan impact, meal rescue values and reasons, detail toggle, reconciliation, quantity adjustment, and explicit approval.

### PlanningRecovery

Implements `prd.md > States and Boundaries`. Presents Need more inventory, Constraints conflict, and Low rescue value, with only the specified recovery actions.

### RetailerSelection

Implements `prd.md > Screens and Layout > Retailer Selection`. Shows the approved gaps and distinguishes Kroger's official API integration, the clearly labelled simulated Demo Market/Uber demos, and unavailable live Uber. Kroger requires local OAuth configuration and user authorization. Live Uber is not selectable without project-specific access and a complete approved API contract.

### ShoppingAgent and ActivityLog

Implements `prd.md > Transparent Retailer-Aware Shopping` and `Basket Discovery, Approval, and Cart Building`. A reusable progress-event model records only observable operations: product matching, basket optimization, and cart work. Product discovery returns proposed selections and performs no cart action. The exact selected products, requested quantities, and substitutions are shown for explicit user approval before a cart adapter can write. Material live price/availability changes invalidate approval. Cart events are reported separately from verification. The Demo Retailer must not use a fake timer after completing a synchronous calculation; retained events correspond to the same adapter calls asynchronous retailers will emit later.

### Retailer Adapters and CartReview

Implements `prd.md > Live Retailer and Demo Store`. The Kroger adapter uses official location-specific product search and UPC cart-write APIs after OAuth authorization; its cart verification capability is false, so results remain unverified until user confirmation. Demo Market and Uber demonstration adapters use local, explicitly simulated catalogs and carts; neither modifies a real retailer cart. `CartReview` reports item-level outcomes, provides the Kroger cart link for manual review, and exposes no checkout/payment UI.

### Shopping Service, Selection, and Browser Execution

Implements `prd.md > Transparent Retailer-Aware Shopping`. A Node.js/TypeScript service receives approved gaps and keeps Kroger credentials and tokens off the frontend. For each gap it searches real Kroger candidates, matches name, availability, and compatible package quantity, then presents selections for user approval. The service accepts an exact approved basket for a cart write and does not treat the earlier ingredient-list approval as product approval. The API write response is reported separately from cart verification; without verified read-back the result stays `NEEDS_ATTENTION` until the user confirms the product in Kroger. Failures are explicit and cart writes are not retried after ambiguous responses. No Uber API request is made without Uber-provided endpoint, scope, schema, and test credentials.

Playwright drives the app's predictable browser tests and controlled simulated Demo Market/Uber flows; it is not used to automate Kroger or Uber. Simulated outcomes can be verified against their simulated carts, but are never represented as real retailer activity. The service does not implement checkout or order placement.

### Planner and Shopping-Agent Services

Pure TypeScript functions isolated from the UI. `planner.ts` filters/scores meal candidates and derives gaps; `shoppingAgent.ts` owns the task state machine and shared product-decision rules; `retailerAdapters.ts` isolates live-browser versus demo execution. This separation lets the learner inspect how the agent workflow works without reading the whole interface.

## Data Model

All data lives in React memory while the tab is open. Pantry and the latest plan snapshot persist to `localStorage` after every update; sample recipes/products are immutable TypeScript files and reload with the app.

```ts
type PantryItem = {
  id: string; name: string; quantity: number; unit: string;
  zone?: 'fridge' | 'freezer' | 'pantry'; useSoon?: boolean; daysLeft?: number;
};
type Constraints = {
  mealCount: 3 | 5 | 7; diet: 'none' | 'vegetarian' | 'vegan';
  exclusions: string[]; prioritizeRescue: boolean;
};
type Recipe = {
  id: string; name: string; description: string; minutes: number;
  diets: ('vegetarian' | 'vegan')[]; ingredients: RecipeIngredient[];
};
type MealPlan = {
  recipes: PlannedMeal[]; ownedCount: number; rescuedItemIds: string[];
  estimatedOwnedValue: number; gaps: ShoppingGap[]; rescueLevel: 'high' | 'medium' | 'low';
};
type ShoppingGap = { id: string; name: string; quantity: number; unit: string };
type StoreProduct = { id: string; name: string; searchTerms: string[]; size: string; price: number; };
type TaskItem = {
  gapId: string; status: 'queued' | 'searching' | 'evaluating' | 'added' | 'needs-attention' | 'skipped';
  productId?: string; reason?: string; events: string[];
};
type RetailerAdapter = {
  id: 'demo-retailer' | 'kroger-api' | 'uber-simulated';
  search(gap: ApprovedShoppingGap): Promise<ProductCandidate[]>;
  addAndVerify(
    approvedItem: ApprovedProductSelection,
  ): Promise<ShoppingOutcome>;
};
type ApprovedShoppingGap = { ingredient: string; quantity: number; unit: 'mL' | 'g' | 'each' };
type ProductCandidate = { name: string; size: number; unit: string; price: number; productUrl: string };
type ApprovedProductSelection = {
  gap: ApprovedShoppingGap; productId: string; quantity: number; approvalId: string;
};
type ShoppingOutcome = {
  ingredient: string; status: 'ADDED' | 'NEEDS_ATTENTION' | 'SKIPPED';
  selectedProduct?: ProductCandidate; reason?: string; cartVerified: boolean;
};
```

`planMeals` uses a small set of deliberately authored recipes and ingredient aliases. It rejects fewer than the configured usable inventory threshold, filters constraints before scoring, favors use-soon matches then owned ingredient count then fewer gaps, deduplicates gaps across selected meals, and marks low rescue rather than disguising it as success. `shoppingAgent` first accepts only approved `ShoppingGap[]`, then separately requires approved exact product selections before cart mutation. Both retailer adapters return the same terminal statuses.

## File Structure

```
project/
├── src/
│   ├── components/
│   │   ├── PantrySetup.tsx          # manual/sample pantry UI
│   │   ├── InventoryList.tsx        # editable ingredient rows
│   │   ├── PlanningConstraints.tsx  # limited plan inputs
│   │   ├── PlanResults.tsx          # impact, gaps, approval
│   │   ├── MealCard.tsx             # explainable proposed meal
│   │   ├── PlanningRecovery.tsx     # honest no-plan states
│   │   ├── RetailerSelection.tsx    # live-browser or demo choice
│   │   ├── ShoppingAgent.tsx        # visible task runner/log
│   │   └── CartReview.tsx           # reconciled retailer/demo cart
│   ├── data/
│   │   ├── samplePantry.ts          # realistic editable demo kitchen
│   │   ├── recipes.ts               # curated recipe catalog
│   │   └── demoRetailerProducts.ts  # fallback product catalog
│   ├── lib/
│   │   ├── planner.ts                # filtering, scoring, gap derivation
│   │   ├── shoppingAgent.ts          # shared task state and decision rules
│   │   ├── retailerAdapters.ts       # live-browser and demo execution boundary
│   │   ├── storage.ts                # safe localStorage read/write
│   │   └── types.ts                  # shared TypeScript types
│   ├── App.tsx                       # app flow and shared state
│   ├── main.tsx                      # React entry point
│   └── styles.css                    # palette, layout, responsive UI
├── devpost/                          # canonical learning docs and visual companions
├── package.json                      # scripts and dependencies
├── tsconfig.json                     # TypeScript configuration
├── vite.config.ts                    # Vite configuration
└── README.md                         # setup, demo flow, boundaries
```

## External Services and Dependencies

- **Node.js/npm** — local package installation and development server. No key, account, rate limit, or cost. Verify Node version before build. [Vite setup](https://vite.dev/guide/)
- **React and Vite** — local npm dependencies installed by the Vite `react-ts` scaffold. [React installation](https://react.dev/learn/installation), [Vite guide](https://vite.dev/guide/)
- **Kroger official API** — live catalog search and cart writes after the user authorizes a registered developer app. Client credentials, redirect URI, and location ID stay in the local shopping-service environment. A cart write is not cart verification.
- **Node.js shopping service** — runs locally with `npm run shopping:service`, accepts only approved ingredient gaps, and keeps OAuth tokens server-side.
- **Playwright** — browser tests for Pantry Rescue and its simulated Demo Market flow; it does not automate Kroger. [Playwright documentation](https://playwright.dev/)

## Important Failure Modes

- **Pantry is too small or constraints exclude valid meals** → `planner.ts` returns the PRD-defined recovery state rather than arbitrary recipes; UI offers add inventory, sample pantry, preference changes, or lower meal count where valid.
- **Kroger authorization, product lookup, or cart write fails** → mark that gap Needs attention, continue independent items where safe, return control to the user, and never claim success.
- **A product price, availability, or substitution changes after exact-basket approval** → stop that item's write and ask the user to review and approve the changed selection again.
- **Uber Consumer Delivery access or endpoint contract is unavailable** → keep live Uber disabled, explain the exact access prerequisites, and offer only the clearly labelled Uber simulation or another available retailer. Never guess endpoints, scopes, or schemas.
- **Kroger cart action cannot be verified by API read-back** → do not emit ADDED; emit NEEDS_ATTENTION and ask the user to inspect the real cart and confirm the item in the UI.
- **Demo retailer cannot confidently match a gap** → task item becomes Needs attention, shows any authored alternatives, and the rest of the task continues. It is never silently marked added.
- **Browser storage is unavailable/corrupt** → start a temporary empty pantry with a plain notice; sample pantry still works in the current tab.
- **Kroger setup or API integration is unavailable** → explain the missing configuration/authorization and offer the clearly labelled simulated Demo Market.

## What Was Simplified and Why

- **A deterministic local recipe catalog** instead of a live AI recipe API — it calculates the real inventory-to-plan logic without keys, billing, latency, or unpredictable output. A later model can propose catalog additions after the proof is stable.
- **Kroger's official API plus clearly labelled simulations** instead of browser automation or universal retailer support — OAuth and API errors are explicit, cart writes are not falsely described as verified, and simulations are not represented as real retailers.
- **Browser storage** instead of accounts/database — a single-user local demo persists enough data without authentication or infrastructure.
- **In-app view state** instead of multi-page routing — one linear demo flow needs fewer moving parts and still exposes distinct product surfaces.

## Decisions and Open Issues

- **Learner choice: React + Vite + TypeScript, local sample data, and browser storage** — accepted for a fast, interactive multi-step web app; tradeoff is local-only data and no sharing/sync.
- **Learner choice: local recording only** — video and public GitHub will demonstrate the project; a deployed link is not planned now.
- **Implementation choice: official Kroger API** — React remains the frontend; a Node.js/TypeScript shopping service owns OAuth, product search, and cart writes. Kroger is user-authorized and location-specific. Since cart read-back is not verified, explicit human review is required before reporting user-confirmed additions. The simulated Demo Market is a separately labelled fallback.
- **Access decision: Uber Eats Consumer Delivery is fail-closed** — public docs identify early access and case-by-case detailed specifications/test credentials, but do not supply enough endpoint-level contract for safe implementation. Do not infer Uber API endpoints, scopes, or schemas. Live Uber requires written project approval where requested, detailed API docs, test credentials, permitted scopes, and a verifiable cart contract. Until then, provide only a clearly labelled local simulation.
- **Shopping safety: exact basket approval** — approval of missing ingredients alone does not authorize product/cart choices. Display exact products and quantities and require explicit approval before any cart mutation.
- **Learner choice: deterministic recipe scoring** — accepted to make plan explanations and demo results reliable; it does not claim generative recipe intelligence.
- **Learning moment: shopping-agent workflow** — inspect `src/lib/shoppingAgent.ts` and `server/krogerAdapter.ts`. Evidence: trace an approved gap through product search, selection, cart-write result, and either user confirmation or Needs attention.
- **Open issue, external validation required:** the live Kroger cart path needs a user-registered developer app and authorized account/location. Mocked tests and local service smoke tests do not demonstrate an actual retailer cart mutation; do not claim that it works until a user completes the authorized real-cart test. No checkout or order call exists.
- **Open issue, Uber access required:** public references are [Consumer Delivery introduction](https://developer.uber.com/docs/consumer-delivery/introduction) and [Consumer Identity introduction](https://developer.uber.com/docs/consumer-identity/introduction). The public overview does not provide the Consumer Delivery endpoint and scope contract or test credentials. Request Uber's project-specific access and technical docs before adding live requests.
- **Open issue, non-blocking: meal imagery** — use CSS/placeholder visuals by default; add image assets only if they can be sourced/licensed without slowing the build.
## Cross-Retailer Basket Optimization

Pantry Rescue compares only retailers it actually checked and says **Lowest estimated cost among stores checked**, never "cheapest groceries on the internet." `RetailerAdapter` is generic: each adapter declares whether it supports product search, observed prices, and cart building. Kroger is permission-gated; clearly labelled Demo Market and Uber simulated adapters provide test comparison data. Simulated offers must be visibly distinguished from live-retailer data.

## Steel Cloud-Browser Demo Validation

The first permitted cloud-browser vertical slice targets only the existing controlled Demo Market. The Node shopping service creates an interactive Steel session, attaches Playwright over CDP, navigates to a protected HTTPS Netlify preview, searches the rendered product UI, captures product facts and screenshots, asks for exact-product approval, rechecks products, clicks the actual add-to-cart controls, and verifies rendered cart quantities before reporting `ADDED`. The browser viewer URL supports user takeover; session IDs and product previews stay server-side and expire. The service releases the Steel session when asked and never attempts checkout.

`STEEL_API_KEY` and `DEMO_MARKET_URL` are server-only local environment values. Uber Eats and DoorDash browser adapters remain disabled without written authorization; no retailer restriction, CAPTCHA, authentication boundary, or access control is bypassed.

`basketOptimizer.ts` receives normalized product candidates, applies a deliberately small safe unit layer (`mL`/`L`, `g`/`kg`, and `each`), chooses the smallest suitable available package per ingredient and retailer, then ranks complete single-store baskets before incomplete options. It records subtotal, retrieval time, availability, warnings, selections, and estimated total. It does not infer taxes, memberships, promotions, delivery fees, or unavailable prices.

The primary recommendation is the lowest-cost complete single-store basket among actually queried catalog sources. Multi-store theoretical item-price comparison is secondary. Cart building starts only after the exact products and quantities receive explicit approval; an adapter without verified cart capability remains comparison-only.
## Cart Handoff After Exact-Basket Approval

After the user approves the `MissingIngredient[]`, Kroger searches its actual location-specific catalog and returns compatible UPC/quantity proposals. Pantry Rescue displays and obtains explicit approval for those exact selections before the service accepts a cart-write request. The API write response and verification state remain distinct. Since Kroger cart read-back has not been validated, Pantry Rescue reports a successful write as **Needs attention** until the user opens Kroger's cart and confirms the item. Simulated adapters can verify their own simulated carts but never modify or claim to modify a real retailer cart.

The completed UI reports a result per approved ingredient and exposes a Kroger cart link only for review. No adapter offers checkout, payment, or order placement.
