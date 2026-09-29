---
doc: spec
status: approved
---

# Pantry Rescue — Technical Spec

## How This Works, In Plain Language

Pantry Rescue is a small app that runs in one browser. React is the tool that redraws the interface as the user adds ingredients, changes preferences, approves a plan, and watches the shopping task progress. A small, curated recipe catalog ships inside the app. A deterministic rescue scorer compares each recipe to the current pantry and constraints, so results, missing quantities, and explanations are genuinely calculated without needing an AI-model key or external service.

The browser keeps the current pantry and latest plan in `localStorage`—a persistent browser note for this one app—so a refresh does not erase the demo. The shopping task is retailer-agnostic: it hands the same approved missing ingredients to one of two adapters. The hero adapter operates a visible browser session on one tested supported retailer/marketplace, searching results, selecting suitable products/quantities, and adding them to a cart. The fallback adapter uses a local product catalog and task runner, emits the same visible activity steps, and adds products to an in-app demo cart. It is a functional simulation, not a prerecorded animation.

No backend, account system, database, API key, or payment handling is needed. This shape preserves the inventory-to-cart kernel while being reliable enough to record locally.

## The Core Journey Through the System

Implements `prd.md > The Core Journey`.

1. The user opens the local React app. `App` reads the saved pantry and app view from browser storage, or begins on the empty pantry screen.
2. `PantrySetup` validates a manual item or loads `samplePantry`. `storage` persists the updated array and `InventoryList` redraws it.
3. `PlanningConstraints` collects meal count, dietary preference, exclusions, and rescue priority in local component state. On **Build my rescue plan**, `planMeals` filters the recipe catalog then scores eligible combinations against pantry items.
4. `planMeals` returns either a plan or an explicit `need-inventory`, `constraint-conflict`, or `low-rescue` result. `PlanResults` presents the appropriate screen, meal explanations, impact totals, and deduplicated shopping gaps.
5. Editing a meal or missing quantity reruns the same planner; no shopping task can start until the user approves the current resulting gaps.
6. `RetailerSelection` offers one tested live retailer/marketplace as supported and labels all others unavailable. The user can choose **Live browser shopping** as the hero path or the clearly labelled Demo Retailer fallback if live access is unavailable.
7. `ShoppingAgent` turns each approved gap into a queued task. The selected `RetailerAdapter` executes it: the hero Live Browser adapter visibly drives the tested retailer website; the fallback Demo Retailer adapter searches the local catalog. Both apply the same matching/size rule, emit a reason, and return Added, Needs attention, or Skipped.
8. `CartReview` reconciles every original gap with an Added, Needs attention, or Skipped outcome and ends at **Review retailer cart**. The live path stops at the retailer cart; the fallback ends at the clearly labelled demo cart. No checkout exists.

## Stack

- **React + TypeScript** — learner-approved for a multi-screen interactive UI with type-checked app data. React documentation: [installation](https://react.dev/learn/installation).
- **Vite React TypeScript template** — learner-approved fast local development/build setup. Use the current `react-ts` template at build time, not pinned speculative versions. Vite documentation: [Getting Started](https://vite.dev/guide/). Current Vite documentation requires Node.js 20.19+ or 22.12+; verify local Node before scaffolding.
- **CSS modules or one app-level CSS file** — no component-library dependency; the custom consumer-grocery visual direction matters more than speed from a generic UI kit.
- **Browser `localStorage`** — local persistence for pantry and latest plan; no user identity, hosted database, or sync.
- **No external AI or recipe API** — a curated data catalog keeps plan generation deterministic and credential-free. The live retailer adapter is an agent/browser capability to validate early, never a presumed DoorDash API integration.

## Where It Runs and How Someone Tries It

Run locally on a current Node.js installation meeting Vite’s documented requirement. From the project root:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`) in a modern browser. For the recorded demo: add one manual ingredient, load/edit the sample pantry, choose 3 meals and a constraint, build the plan, approve the gaps, run the visible live browser retailer task if validated, and end at retailer-cart review. If it is unavailable, demonstrate the clearly labelled Demo Retailer path using the same gaps.

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

Implements `prd.md > Screens and Layout > Retailer Selection`. Declares one tested marketplace/retailer supported, shows exact gaps, and makes any unsupported retailer unavailable. It selects a `LiveBrowserRetailerAdapter` for the hero path or `DemoRetailerAdapter` for the clearly labelled fallback.

### ShoppingAgent and ActivityLog

Implements `prd.md > Transparent Retailer-Aware Shopping`. Converts a plan gap into queued, observable `searching → evaluating → selected → added` actions. It invokes the selected adapter and normalizes its events to the same progress log. A fixed delay/“Continue” control is used only by the Demo Retailer adapter for recording reliability.

### Retailer Adapters and CartReview

Implements `prd.md > Agent Shopping and Finished Cart`. `LiveBrowserRetailerAdapter` hands approved gaps to the available browser-agent capability and maps observed browser actions/outcomes back to task events. `DemoRetailerAdapter` searches matching local products using the same decision rules. `CartReview` reconciles task results, handles alternatives and needs-attention states, and exposes no checkout/payment UI.

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
  id: 'live-browser' | 'demo-retailer';
  execute(gap: ShoppingGap): Promise<TaskItem>;
};
```

`planMeals` uses a small set of deliberately authored recipes and ingredient aliases. It rejects fewer than the configured usable inventory threshold, filters constraints before scoring, favors use-soon matches then owned ingredient count then fewer gaps, deduplicates gaps across selected meals, and marks low rescue rather than disguising it as success. `shoppingAgent` accepts only approved `ShoppingGap[]`; it cannot create arbitrary cart items. Both retailer adapters consume those same gaps and return the same terminal statuses.

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
- **Browser-agent capability (to verify early)** — required for the hero path to control a user-visible browser session on one retailer site. The exact provider/capability, permitted actions, login behavior, and cost are unresolved and must be tested with one benign shopping task before it becomes the recorded hero flow. It must never receive payment details or proceed beyond cart review.
- **Tested retailer website** — no official consumer-cart API is assumed. DoorDash Marketplace API access is limited/approval-based, so it is not the integration path. [DoorDash API access](https://developer.doordash.com/en-US/docs/marketplace/faq/getting_started/)

## Important Failure Modes

- **Pantry is too small or constraints exclude valid meals** → `planner.ts` returns the PRD-defined recovery state rather than arbitrary recipes; UI offers add inventory, sample pantry, preference changes, or lower meal count where valid.
- **Live browser retailer cannot safely continue** (login/anti-automation friction, lost navigation, product unavailable, or browser-agent error) → mark that gap Needs attention, continue independently actionable gaps where possible, return control to the user, and never claim success.
- **Demo retailer cannot confidently match a gap** → task item becomes Needs attention, shows any authored alternatives, and the rest of the task continues. It is never silently marked added.
- **Browser storage is unavailable/corrupt** → start a temporary empty pantry with a plain notice; sample pantry still works in the current tab.
- **Live retailer changes, asks for login, or cannot be automated** → switch to the clearly labelled demo retailer, which executes the same approved gaps and shared decision logic.

## What Was Simplified and Why

- **A deterministic local recipe catalog** instead of a live AI recipe API — it calculates the real inventory-to-plan logic without keys, billing, latency, or unpredictable output. A later model can propose catalog additions after the proof is stable.
- **One tested live browser-retailer adapter plus a functional demo fallback** instead of universal retailer support — live browser navigation is the hero experience, but one website can change or block automation. Both adapters receive the same calculated gaps and share decision logic; the fallback preserves the full demo when the live path cannot run.
- **Browser storage** instead of accounts/database — a single-user local demo persists enough data without authentication or infrastructure.
- **In-app view state** instead of multi-page routing — one linear demo flow needs fewer moving parts and still exposes distinct product surfaces.

## Decisions and Open Issues

- **Learner choice: React + Vite + TypeScript, local sample data, and browser storage** — accepted for a fast, interactive multi-step web app; tradeoff is local-only data and no sharing/sync.
- **Learner choice: local recording only** — video and public GitHub will demonstrate the project; a deployed link is not planned now.
- **Learner choice: live browser retailer navigation is the hero shopping path** — implement one tested retailer/marketplace through a browser-agent adapter; it is not an assumed official DoorDash API integration. The functional demo retailer adapter is mandatory fallback for reliability.
- **Learner choice: deterministic recipe scoring** — accepted to make plan explanations and demo results reliable; it does not claim generative recipe intelligence.
- **Learning moment: shopping-agent workflow** — the build will inspect `src/lib/shoppingAgent.ts` and `src/lib/retailerAdapters.ts` after it is working. Evidence: the learner can trace one actual gap through queued/searching/evaluating/added (or Needs attention) events and see which adapter completed it.
- **Open issue, blocking before live-agent implementation:** choose and validate the browser-agent capability and one retailer with a harmless test task. If unavailable or unreliable, record the already-approved demo retailer adapter and make no live-cart claim.
- **Open issue, non-blocking: meal imagery** — use CSS/placeholder visuals by default; add image assets only if they can be sourced/licensed without slowing the build.
