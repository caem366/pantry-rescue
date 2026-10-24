---
doc: checklist
status: approved
---

# Build Checklist

Build mode: learn

## Slices

- [x] **1. Establish an editable kitchen inventory**
  Becomes usable: A local Pantry Rescue app where someone can add, edit, and remove pantry items, mark food as use soon, load a realistic sample pantry into the same interface, and continue when they have enough inventory.
  Why now: This proves the kitchen-first premise and establishes a runnable, visually on-brand home for every later behavior; scaffolding is included only to deliver this real interaction.
  PRD ref: `prd.md > Screens and Layout > Pantry Setup`, `prd.md > Features and Behavior > Inventory Establishment`
  Spec ref: `spec.md > PantrySetup and InventoryList`, `spec.md > Data Model`, `spec.md > Look and Feel`, `spec.md > File Structure`
  Build: Scaffold the React/Vite/TypeScript app; create shared types, sample pantry, safe browser storage, warm visual foundation, and editable manual/sample pantry flow.
  Verify (mechanical): Run `npm run build`; run the dev server; confirm a manually added item renders, edits/removes, persists after reload, and the sample pantry loads into the same list.
  Learner check: Open the local app, add one food item, load the sample pantry, and confirm it feels like a calm kitchen setup rather than a recipe search.
  Commit: `Build editable pantry setup`

- [x] **2. Turn an inventory into an explainable rescue plan**
  Becomes usable: The user can set the approved lightweight constraints and receive a calculated three-meal rescue plan with owned/missing reconciliation, reasons, impact totals, and honest no-plan states.
  Why now: It implements the unique kernel early—using what is already owned to decide what to make—before any shopping experience.
  PRD ref: `prd.md > Constraint-Based Rescue Planning`, `prd.md > Explainable Rescue Plan`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > PlanningConstraints`, `spec.md > PlanResults and MealCard`, `spec.md > PlanningRecovery`, `spec.md > Planner and Shopping-Agent Services`
  Build: Add curated recipes, deterministic scoring, constraint controls, meal/impact/reconciliation views, editable gaps, and need-inventory/constraint-conflict/low-rescue recovery views.
  Verify (mechanical): Run `npm run build`; use the sample pantry to produce a plan with use-soon items and deduplicated gaps; run at least one recovery-state input and confirm no arbitrary plan is shown.
  Learner check: Build a 3-meal plan from the sample pantry and inspect why one meal was selected and which ingredients are truly missing.
  Commit: `Generate explainable rescue plans`

- [x] **3. Approve gaps and watch the demo retailer agent build a cart**
  Becomes usable: After approving the current plan, the user can run a transparent task that processes the actual missing ingredients through searching, evaluating, selecting, and adding products to a clearly labelled demo retailer cart.
  Why now: It completes the dependable inventory-to-cart proof and teaches the shopping-agent state machine before adding a live-site dependency.
  PRD ref: `prd.md > Transparent Retailer-Aware Shopping`, `prd.md > Basket Discovery, Approval, and Cart Building`
  Spec ref: `spec.md > ShoppingAgent and ActivityLog`, `spec.md > Retailer Adapters and CartReview`, `spec.md > Important Failure Modes`
  Build: Add plan approval, the shared shopping task state machine, local demo retailer catalog/adapter, progress log, choice reasoning, needs-attention handling, cart reconciliation, and review-only endpoint.
  Verify (mechanical): Run `npm run build`; complete a sample plan; confirm every approved gap ends Added, Needs attention, or Skipped and the cart contains only added approved gaps.
  Learner check: Run the shopping task and trace one ingredient from the missing list through the live progress log to its cart outcome.
  Commit: `Add transparent demo shopping agent`

- [ ] **4. Approve exact products before any cart write**
  Becomes usable: After missing ingredients are approved, the user sees the exact matched product, package size, requested quantity, and any substitution, then explicitly approves that basket before Kroger or a simulated adapter can add anything.
  Why now: Ingredient approval is not consent to an exact product choice. This shared safety gate must sit between catalog search and every cart mutation, including the existing Kroger path.
  PRD ref: `prd.md > Transparent Retailer-Aware Shopping`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > ShoppingAgent and ActivityLog`, `spec.md > Retailer Adapters and CartReview`, `spec.md > Shopping Service, Selection, and Browser Execution`, `spec.md > Important Failure Modes`
  Build: Trace the current Kroger and simulation paths; separate approved gaps from proposed and approved product selections; show the exact proposed basket; gate every cart write on explicit approval of the exact selections; invalidate approval when product, price, quantity, or availability changes; keep per-item results honest and retries safe.
  Verify (mechanical): Run focused shopping-agent, Kroger-adapter, service, and browser tests plus `npm run build`; assert no adapter write occurs before exact-basket approval, changed selections require renewed approval, and unverified Kroger writes never become verified `ADDED`. Use mocked API responses only.
  Learner check: Approve missing ingredients, inspect the proposed exact products and quantities, and confirm the cart action is unavailable until the basket itself is approved.
  Commit: `Require exact basket approval`

- [ ] **5. Gate live Uber access and demonstrate the clearly simulated flow**
  Becomes usable: Pantry Rescue clearly reports live Uber as unavailable without Uber-granted access and a complete API contract, while offering a distinctly labelled simulated Uber catalog/cart path with per-item outcomes.
  Why now: Uber's public documentation confirms case-by-case access and does not publish the endpoint, scope, and cart-verification contract needed for safe live requests. A fail-closed status and simulation deliver the supported behavior without inventing integration details or claiming a real cart changed.
  PRD ref: `prd.md > Screens and Layout > Retailer Selection`, `prd.md > Live Retailer and Demo Store`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > External Services and Dependencies`, `spec.md > Shopping Service, Selection, and Browser Execution`, `spec.md > Important Failure Modes`, `spec.md > Decisions and Open Issues`
  Build: Add an explicit unavailable live-Uber capability state with required access prerequisites; add retailer-specific simulated Uber fixtures and a simulated-cart adapter only if it can be clearly separated from live integrations; require exact-basket approval; document the official access blocker and preserve Kroger and Demo Market.
  Verify (mechanical): Run focused adapter/service/browser tests, `npm run build`, and `npm run lint`; prove simulated products and cart writes are labelled simulation, per-item results match simulated cart contents, unauthorized/unconfigured live Uber cannot call any external endpoint, and checkout/order routes do not exist.
  Learner check: Run the sample shopping task, confirm the UI says live Uber is unavailable, then use the explicitly simulated Uber option and distinguish its fixture products and simulated cart from a real retailer account.
  Commit: `Add fail-closed Uber shopping demo`

- [ ] **6. Polish the full proof and demo readiness**
  Becomes usable: The complete kitchen-to-cart journey is responsive, coherent, and ready to record, including use-soon-to-rescued feedback, clear agent states, and documented local startup.
  Why now: The core behaviors are already working, so visual refinement and the integrated demo can improve presentation without hiding functional uncertainty.
  PRD ref: `prd.md > Look and Feel`, `prd.md > The Core Journey`, `prd.md > What We're Building`
  Spec ref: `spec.md > Look and Feel`, `spec.md > Where It Runs and How Someone Tries It`, `spec.md > Important Failure Modes`
  Build: Refine responsive visual hierarchy and transitions; add README setup/demo instructions; run the full journey and repair any integration issues that preserve the agreed scope.
  Verify (mechanical): Run `npm run build`; start the app and complete the sample pantry → 3-meal plan → approval → available shopping path → cart-review journey without browser-console errors.
  Learner check: Run the full demo path and note any screen that feels confusing, unpolished, or unlike the intended calm, financially clever experience.
  Commit: `Polish Pantry Rescue demo flow`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — after slice 1, before planning and shopping features are built
- [ ] Integrated core journey explored — after slice 3, before any live-retailer validation
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: [what actually happened; real document/test/code references; unfinished work if interrupted]
Route and stops: [actual paths and symbols; guided stops completed, or reference-only route]
Edit outcome: [tried/kept/reverted/declined/not applicable; verification if changed]
Reflection: [offered/answered/declined/already covered — personal answer belongs only in the ignored profile]
Activity mode: [live app and editor, explicit static fallback, focused alternative, prior practice, or recap]

## Revisions

- The retailer plan now inserts exact-product/quantity approval before any cart write and adds a fail-closed Uber access gate with a clearly simulated flow. Public Uber docs do not expose enough Consumer Delivery endpoint and scope detail to support live implementation; the existing Kroger path and Demo Market remain in scope.
- The Vite starter lives in `app/` rather than the workspace root — the root contains course and planning files, and Vite safely scaffolded in the dedicated subfolder without changing the selected stack or user-facing product.
- The inventory UI should borrow familiar grocery-delivery interaction cues (clear product cards, approachable shopping hierarchy) without copying a specific brand — learner feedback after slice 1.
- The live shopping hero is explicitly a visible browser session against one tested grocery website, with a functional demo retailer fallback — learner clarified the intended POC experience.
- Playwright is the selected browser-control adapter for future permitted live-retailer validation — learner choice; current demo retailer remains the reliable proof path.
- The live-retailer build now targets Kroger's documented OAuth/cart API instead of website automation because the learner explicitly requested a real retailer cart and the repository has a Kroger API spike. API writes remain unverified until a supported cart-read contract or explicit user confirmation exists; Demo Market stays clearly simulated.
