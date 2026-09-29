---
doc: checklist
status: approved
---

# Build Checklist

Build mode: learn

## Slices

- [ ] **1. Establish an editable kitchen inventory**
  Becomes usable: A local Pantry Rescue app where someone can add, edit, and remove pantry items, mark food as use soon, load a realistic sample pantry into the same interface, and continue when they have enough inventory.
  Why now: This proves the kitchen-first premise and establishes a runnable, visually on-brand home for every later behavior; scaffolding is included only to deliver this real interaction.
  PRD ref: `prd.md > Screens and Layout > Pantry Setup`, `prd.md > Features and Behavior > Inventory Establishment`
  Spec ref: `spec.md > PantrySetup and InventoryList`, `spec.md > Data Model`, `spec.md > Look and Feel`, `spec.md > File Structure`
  Build: Scaffold the React/Vite/TypeScript app; create shared types, sample pantry, safe browser storage, warm visual foundation, and editable manual/sample pantry flow.
  Verify (mechanical): Run `npm run build`; run the dev server; confirm a manually added item renders, edits/removes, persists after reload, and the sample pantry loads into the same list.
  Learner check: Open the local app, add one food item, load the sample pantry, and confirm it feels like a calm kitchen setup rather than a recipe search.
  Commit: `Build editable pantry setup`

- [ ] **2. Turn an inventory into an explainable rescue plan**
  Becomes usable: The user can set the approved lightweight constraints and receive a calculated three-meal rescue plan with owned/missing reconciliation, reasons, impact totals, and honest no-plan states.
  Why now: It implements the unique kernel early—using what is already owned to decide what to make—before any shopping experience.
  PRD ref: `prd.md > Constraint-Based Rescue Planning`, `prd.md > Explainable Rescue Plan`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > PlanningConstraints`, `spec.md > PlanResults and MealCard`, `spec.md > PlanningRecovery`, `spec.md > Planner and Shopping-Agent Services`
  Build: Add curated recipes, deterministic scoring, constraint controls, meal/impact/reconciliation views, editable gaps, and need-inventory/constraint-conflict/low-rescue recovery views.
  Verify (mechanical): Run `npm run build`; use the sample pantry to produce a plan with use-soon items and deduplicated gaps; run at least one recovery-state input and confirm no arbitrary plan is shown.
  Learner check: Build a 3-meal plan from the sample pantry and inspect why one meal was selected and which ingredients are truly missing.
  Commit: `Generate explainable rescue plans`

- [ ] **3. Approve gaps and watch the demo retailer agent build a cart**
  Becomes usable: After approving the current plan, the user can run a transparent task that processes the actual missing ingredients through searching, evaluating, selecting, and adding products to a clearly labelled demo retailer cart.
  Why now: It completes the dependable inventory-to-cart proof and teaches the shopping-agent state machine before adding a live-site dependency.
  PRD ref: `prd.md > Transparent Retailer-Aware Shopping`, `prd.md > Agent Shopping and Finished Cart`
  Spec ref: `spec.md > ShoppingAgent and ActivityLog`, `spec.md > Retailer Adapters and CartReview`, `spec.md > Important Failure Modes`
  Build: Add plan approval, the shared shopping task state machine, local demo retailer catalog/adapter, progress log, choice reasoning, needs-attention handling, cart reconciliation, and review-only endpoint.
  Verify (mechanical): Run `npm run build`; complete a sample plan; confirm every approved gap ends Added, Needs attention, or Skipped and the cart contains only added approved gaps.
  Learner check: Run the shopping task and trace one ingredient from the missing list through the live progress log to its cart outcome.
  Commit: `Add transparent demo shopping agent`

- [ ] **4. Validate and add one live browser-retailer adapter, if safely available**
  Becomes usable: If a permitted browser-agent capability and one retailer can complete a harmless cart-building task reliably, the user can select it as the live hero path; otherwise the app clearly keeps the demo retailer as its supported path.
  Why now: Live browser navigation is the chosen hero but is a critical external risk; validating it after the complete fallback exists prevents a blocked retailer from derailing the proof of concept.
  PRD ref: `prd.md > Agent Shopping and Finished Cart`, `prd.md > States and Boundaries > Live retailer interruption`
  Spec ref: `spec.md > Retailer Adapters and CartReview`, `spec.md > External Services and Dependencies`, `spec.md > Decisions and Open Issues`
  Build: Probe the available browser-agent capability with an explicit non-checkout task; if it is permitted and reliable, implement its adapter and normalized progress events. If not, record the evidence, retain the demo adapter, and make no live-cart claim.
  Verify (mechanical): Run `npm run build`; execute the harmless live probe if capability is available and verify returned events map to honest terminal states; otherwise verify the app labels the demo route and no live-cart action is offered.
  Learner check: Try the retailer selector and confirm the app is candid about whether live browser shopping is available or the demo retailer is being used.
  Commit: `Validate live retailer adapter`

- [ ] **5. Polish the full proof and demo readiness**
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

- The Vite starter lives in `app/` rather than the workspace root — the root contains course and planning files, and Vite safely scaffolded in the dedicated subfolder without changing the selected stack or user-facing product.
- The inventory UI should borrow familiar grocery-delivery interaction cues (clear product cards, approachable shopping hierarchy) without copying a specific brand — learner feedback after slice 1.
