---
doc: prd
status: approved
---

# Pantry Rescue — Product Requirements

> **Submission status (October 25, 2026):** This approved PRD preserves earlier requirements and proposed Kroger/Uber paths; those passages are historical plans, not delivered-feature claims. The verified end-to-end shopping demonstration uses the controlled Demo Market with Steel/Playwright and cart reconciliation. Walmart Canada remains experimental, without fully verified live product matching or cart addition. Kroger, Uber Eats, and DoorDash are not functioning submission integrations. The root-level `scope.md`, `prd.md`, and `spec.md` describe the current implementation and limits.

An inventory-first meal planner for young adults who want to use food they already own before buying more. Source: `scope.md > The Unique Kernel`, `Who It's For`.

## The Core Journey

1. The user arrives at a pantry-setup screen that explains: “Make meals from what you have. Shop only for what you’re missing.”
2. They manually add groceries or load a realistic sample pantry into the same editable inventory.
3. With a usable inventory, they select **Plan with what I have**, then set a short meal count, limited dietary preference, optional exclusions, and the default priority to rescue use-soon food.
4. Pantry Rescue either returns an honest planning recovery state or a rescue plan with meal reasoning, plan impact, and a consolidated inventory reconciliation.
5. The user can inspect, adjust, replace, or approve the plan and its missing quantities. Only after approval can they start shopping.
6. The user selects a supported retailer after approving the exact missing ingredients. Kroger's existing official user-authorized API flow is preserved. Uber Eats is the preferred additional retailer, but its live option is enabled only after Uber grants Consumer Delivery API access and provides the detailed contract. Any simulation is labelled as simulated.
7. The agent searches only a retailer catalog it is authorized to access, matches products and package quantities, then shows the exact basket for a second approval before requesting cart additions. A simulation never alters or claims to represent a real retailer cart.
8. Each approved ingredient resolves independently as Added only when cart contents are verified or the user explicitly confirms them, Needs attention when the result is uncertain or failed, or Skipped. Kroger writes remain unverified until user confirmation; Uber writes remain unavailable until the required API access and verification contract are established.
9. The user sees the per-item reconciliation and opens the retailer cart for review. Pantry Rescue stops before checkout, payment, or order placement.

## Screens and Layout

### Pantry Setup

The landing screen leads with the brand, value proposition, and a pantry setup area—not a chatbot or recipe search. Two prominent choices are **Add my groceries** and **Try a sample pantry**. Manual entry opens inline on the same surface for ingredient name, quantity/amount, and optional use-by or “Use soon” information. Added items immediately appear as editable pantry rows or cards, optionally grouped as Fridge, Freezer, and Pantry without requiring perfect categorization.

The sample pantry populates this exact editable interface. Once enough inventory exists, show a summary such as “12 ingredients added · 3 should be used soon” and **Plan with what I have →**. Do not ask for recipes, macros, or retailer selection here. Source: `scope.md > The POC Boundary`.

### Planning Constraints

This lightweight screen asks, “What should this plan work around?” It carries forward inventory context and offers: 3, 5, or 7 meals; No preference, Vegetarian, or Vegan; optional simple free-text exclusions; and a default-selected “Use food that needs rescuing first” priority. The primary action is **Build my rescue plan →**.

### Rescue Plan and Approval

The results screen is titled **Your rescue plan**. A top summary shows meal count, ingredients already owned, use-soon foods rescued, and missing ingredients. It may show an explicitly labelled estimated grocery spend already represented in the kitchen.

Each rich meal card shows meal name, food image/illustration, short description, High/Medium/Low rescue value, owned ingredient count, use-soon ingredients rescued, missing ingredients, approximate prep time if available, and **View meal →**. The meal detail makes its reasoning inspectable: why it was chosen, the ingredients/instructions, and its owned versus missing inputs.

An impact section separately shows owned ingredients, use-soon foods rescued, missing ingredients, and estimated value already in the kitchen. A reconciliation section lists **What you already have** and the plan-wide, deduplicated **What you’re missing**, including practical quantities. Before shopping, the user may remove or replace a meal, review owned ingredients, and adjust a missing quantity. Recalculation must update rescue results and gaps. The approval CTA says **Shop [n] missing ingredients →** and explains that only those gaps will be shopped. Source: `scope.md > What "Working" Looks Like`.

### Retailer Selection

When needed, show **Where do you usually shop?** and distinguish live-authorized integrations from catalogue-only, simulated, and unavailable options. Preserve the existing Kroger integration. Show Uber Eats as the preferred live target only when the project has Uber's written approval, test credentials, required scopes, and endpoint contract; until then, state that live Uber shopping is unavailable and offer an explicitly simulated Uber demo and the existing Kroger/Demo Market choices. Never imply that a simulation changes an Uber account.

### Basket Discovery, Approval, and Cart Building

After plan approval, **Find Cheapest Basket** searches only enabled catalog integrations and begins a separate basket-discovery stage. The user sees progress reflecting actual work: merchant discovery where supported, product lookup, matching, and basket comparison. Product names, package sizes, observed prices, quote timestamp, and missing items are grounded in returned data; simulated products are visibly marked as fixtures.

When comparison completes, Pantry Rescue presents the retailers actually checked, matched items, item subtotal, any known fees, quote freshness, missing items, and whether totals are comparable. It does not invent delivery totals or compare unlike fulfillment offers. The recommended complete single-retailer basket is shown with every exact product and quantity; the user must explicitly approve it using **Build My Cart** before cart modification begins.

Before an authorized live cart mutation, the adapter rechecks price and availability. Any change to product, quantity, price, or availability invalidates approval and requires the user to review the updated exact basket again. After approval, the cart stage shows actual connection, validation, add, and verification states. An item appears as added only after cart state is verified or the user explicitly confirms it. The completion state reports per-item outcomes and exposes only a documented handoff.

### Live Retailer and Demo Store

The existing supported live path uses Kroger's official API after the user connects a locally configured developer app through Kroger's own OAuth consent page. Preserve its behavior and limitations.

Uber Eats is preferred only if Uber grants this project access to Consumer Delivery, including written approval when required, detailed API reference, test credentials, registered scopes, and permitted product/cart operations. The public docs describe capabilities but do not provide enough endpoint, scope, schema, refresh, or cart-verification detail to implement live calls safely. Do not infer those details or use merchant, Uber Direct, or post-order fulfillment APIs as substitutes. Until access arrives, expose Uber live as unavailable and allow a separate, clearly labelled simulated Uber cart flow using fixtures. The user reviews the exact simulated basket and explicitly approves it; simulated results must never claim a real Uber cart changed.

Kroger requires a registered app, exact callback URI, and store location. A Kroger write response remains unverified pending the user's real-cart confirmation. Keep Kroger API credentials and customer tokens server-side. No retailer path exposes checkout, payment submission, or order placement.

## Look and Feel

Pantry Rescue feels fresh, warm, practical, and quietly clever: premium grocery editorial × modern consumer productivity, with the familiar clarity of a grocery-delivery app such as Instacart—not a technical AI dashboard. Use warm cream `#F7F4EB`, deep green `#16352D`, herb green `#1E765B`, mint `#D9F1E4`, and restrained coral `#E97959`, with natural muted neutrals.

Use a friendly, slightly editorial display face for large headlines and meal names, paired with a crisp readable sans-serif for all controls and operational information. Kitchen mode is warm, image-rich, and exploratory with appetizing food imagery, generous whitespace, softly rounded cards, tactile chips, and subtle borders. Agent mode is calmer and more structured so activity remains easy to follow; both share the same visual language.

Use-soon food uses a coral/peach badge, dot, or soft tint plus clear text (for example, “USE SOON · Spinach · 2 days”), never alarming red-only treatment, warning triangles, guilt, or countdown anxiety. Once used in a meal, it transitions to fresh green: “Use soon → Rescued ✓.” The agent is intelligent through transparent actions, not robot mascots or generic AI imagery. Avoid neon gradients, glowing purple/blue effects, glassmorphism, and all-white enterprise-dashboard styling.

## Features and Behavior

### Inventory Establishment

- As a user with food already at home, I can add groceries with name, quantity, and optional urgency so the plan can start from my real kitchen.
  - [ ] A valid item appears immediately in the editable pantry inventory.
  - [ ] Use-soon status is legible through text as well as its visual treatment.
  - [ ] A user can change or remove an item before planning.
- As a first-time visitor, I can load a realistic sample pantry into that same interface so I can reach the complete flow quickly.
  - [ ] The sample inventory remains editable and can be combined with manually added items.

### Constraint-Based Rescue Planning

- As a user, I can request 3, 5, or 7 meals with a limited dietary preference and simple exclusions so my rescue plan fits basic needs.
  - [ ] “Use food that needs rescuing first” is selected by default.
  - [ ] The plan favors urgent ingredients, then already-owned ingredients, then fewer grocery gaps.
  - [ ] Dietary preferences and exclusions are never silently ignored.

### Explainable Rescue Plan

- As a user, I can understand why each meal was proposed and what impact the whole plan has.
  - [ ] Meal cards expose rescue value and an inspectable “Why this meal?” explanation based on use-soon, owned, and missing ingredients.
  - [ ] The plan-level summary distinguishes food rescued from estimated grocery spend avoided.
  - [ ] The missing list is calculated across the approved plan, deduplicated, and uses practical quantities.
- As a user, I can correct the plan before an agent shops.
  - [ ] I can remove or replace a meal and adjust missing quantities.
  - [ ] Any change recalculates the rescue results and shopping gaps before the shopping CTA updates.

### Transparent Retailer-Aware Shopping

- As a user, I can watch Pantry Rescue compare complete baskets before I approve any cart action.
  - [ ] Selecting **Find my cheapest basket** shows actual discovery, product-matching, and optimization activity; it is not a timer presented after an already-finished calculation.
  - [ ] The progress view only exposes useful retail facts and actions, never hidden reasoning or prompts.
  - [ ] Basket results name only stores checked, show availability and estimated total, and explain the lowest estimated complete basket among them.
  - [ ] Comparison completion leaves cart construction untouched and offers **Build this cart** as the explicit approval boundary.
- As a user, I can choose Kroger or the clearly labelled simulated Demo Market and shop only my approved gaps.
  - [ ] The task starts with the approved consolidated missing-ingredient list, not a generic list.
  - [ ] The Kroger path uses its official user-authorized API to search actual location-specific products and request additions by UPC; it does not automate the retailer website.
  - [ ] Progress and results report product search, selected package quantity, cart-write response, and cart verification as distinct facts.
  - [ ] Product selection requires an available ingredient match and a compatible package unit/size; unverifiable dietary requirements fail closed for user review.
  - [ ] Kroger writes remain Needs attention until the user reviews the actual cart and confirms the item; Demo Market remains clearly labelled simulation.
- As a user, I can understand and control uncertain matches.
  - [ ] If an exact match is not confident, show a small set of plausible alternatives for user approval or a Skip action.
  - [ ] The agent never independently makes a meaningful substitution that could alter a recipe or violate a dietary preference.
  - [ ] Every approved gap ends visibly as Added, Needs attention, or Skipped.
  - [ ] The completion screen reconciles every original gap with the retailer product/status and ends at review, never checkout.
  - [ ] Kroger exposes a real cart link for user review but does not claim cart verification; Demo Market uses **Review cart** for its simulated cart.

## States and Boundaries

- **First use** — The empty Pantry Setup introduces the product premise and offers manual entry or the sample pantry.
- **Usable inventory** — The plan CTA appears after a small usable inventory has been established.
- **Need more inventory** — If too few useful ingredients exist, show “We need a little more of your kitchen,” the current item/urgent count, and **Add more groceries** and **Try the sample pantry**. Do not make arbitrary recipes that require mostly new purchases.
- **Constraints conflict** — If the inventory is usable but no suitable meals meet the selected choices, show “We couldn’t find a good rescue plan with these choices,” name the relevant choices where possible, and offer **Change preferences** or a user-approved lower meal count when valid.
- **Low rescue value** — If a valid plan uses too little inventory and needs too many purchases, disclose the ratio and offer **Adjust my plan**, **Add more pantry items**, or **Use this plan anyway**. Do not frame it as a strong rescue result.
- **Partial urgent-food rescue** — Keep use-soon ingredients that were not included visible, e.g. “2 of 3 use-soon ingredients rescued,” with a lightweight **Find a use for it →** option. This need not trigger a full second planning flow in the POC.
- **Unsupported retailer** — State that Pantry Rescue cannot shop that retailer yet; offer the supported retailer or a shopping-list view. Never imply automation will occur.
- **Uber live access unavailable** — Explain that Consumer Delivery is unavailable until Uber grants project access and supplies its detailed API contract and test credentials. Offer the clearly labelled simulated Uber demo or another available retailer; never make a live call.
- **Exact basket changed** — If product, quantity, price, or availability changes after approval, stop the affected cart action and request approval of the updated selection.
- **Uncertain/no product match** — Flag the item as Needs attention, offer plausible approval-required alternatives when available, and continue with other gaps.
- **Kroger API interruption** — If OAuth, product lookup, availability, matching, or a cart write fails, report the exact affected item as Needs attention and continue independent items where safe. Do not claim success.
- **Demo retailer fallback** — If the live path is unavailable for development or judging, clearly label the demo storefront and run the same approved task and decision rules there.
- **Shopping completion** — Show each item as Added only after verified cart state or explicit user confirmation; otherwise use Needs attention or Skipped. Checkout, payment, delivery/pickup, retailer account information, and final purchase remain wholly user-controlled.
- **Basket discovery completion** — Show comparison results and the winning-basket explanation, but do not create or modify any cart until the user takes the distinct **Build this cart** action.

## Product Decisions

- Inventory setup comes before recipes, retailer choice, or detailed nutrition because “start with what you already have” is the product premise.
- Manual entry and a preloaded sample pantry both use one interface: manual entry proves the experience works; the sample enables a quick reliable demo.
- Three planning constraints stay intentionally narrow—meal count, dietary preference, exclusions—with rescue-first selected by default, keeping the core problem in focus.
- Meal reasoning is inspectable with High/Medium/Low rescue value and explanation, rather than an unexplained AI score.
- Food rescued and estimated grocery spend avoided are separate benefits and must be labelled distinctly.
- Shopping begins only after explicit plan approval; changes recalculate gaps before any agent action.
- Basket discovery and cart building are two visible, separate agent stages. The user approves the selected basket before any cart action begins.
- Fast local demo data may complete quickly, but its operation events remain observable and map to the same real adapter operations that a future asynchronous retailer path will emit.
- Kroger's official, user-authorized API is the live retailer path. A controlled simulated storefront remains clearly labelled, functional, and generated from actual plan gaps.
- Shopping ends at retailer-cart review so the agent is bounded and the user retains purchase control.

## What We're Building

An editable manual/sample pantry, lightweight planning constraints, honest rescue-plan outcome states, explainable meal cards and plan reconciliation, explicit shopping-list approval, Kroger official-API product search and cart writes with user verification, visible functional shopping-agent progress, match exception handling, a clearly labelled simulated retailer fallback, and per-item cart reconciliation. Source: `scope.md > The POC Boundary`.

## Deferred From the POC

- Photo-based pantry recognition: reliable inventory establishment is the priority.
- Universal and multi-retailer automation: it risks a fragile demo.
- Detailed macro/calorie targets, medical diets, allergy safety, household profiles, budgets, cuisine ranking, prep schedules, and serving-size optimization: these expand planning beyond the core experiment.
- Checkout, payment, delivery/pickup, retailer accounts, and final purchase: they are outside the safe user-review endpoint.
- A full “Find a use for it” workflow: an unrescued-ingredient link is sufficient for this POC.

## Possible Later Enhancements

Add reliable integrations for more retailers, image-based item recognition, and more sophisticated planning constraints after the inventory-to-cart loop is proven. Expand to family and fitness meal-prep modes only after the initial young-adult/roommate problem is working well.

## Non-Goals

- A generic AI recipe chatbot: it fails to demonstrate the inventory-to-cart kernel.
- Universal retailer compatibility: only Kroger's supported API path is offered as a live retailer; unsupported retailers must be candidly declined.
- Automatic substitutions for meaningful recipe or dietary decisions: user approval is required.
- Automatic checkout or purchase: Pantry Rescue ends at review by design.
- Shame-oriented waste messaging: urgency is constructive, calm, and legible.

## Open Questions

- Which single retailer/marketplace browser path is reliable enough to use in the recorded demo, and which browser-agent capability will execute it? This must be verified during `4-spec`/build; the controlled simulated retailer remains the approved fallback.
- Whether the POC uses food photography, illustrations, or high-quality placeholders for meal cards can be decided in `4-spec`; it does not change product behavior.
