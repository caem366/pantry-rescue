---
doc: prd
status: approved
---

# Pantry Rescue — Product Requirements

An inventory-first meal planner for young adults who want to use food they already own before buying more. Source: `scope.md > The Unique Kernel`, `Who It's For`.

## The Core Journey

1. The user arrives at a pantry-setup screen that explains: “Make meals from what you have. Shop only for what you’re missing.”
2. They manually add groceries or load a realistic sample pantry into the same editable inventory.
3. With a usable inventory, they select **Plan with what I have**, then set a short meal count, limited dietary preference, optional exclusions, and the default priority to rescue use-soon food.
4. Pantry Rescue either returns an honest planning recovery state or a rescue plan with meal reasoning, plan impact, and a consolidated inventory reconciliation.
5. The user can inspect, adjust, replace, or approve the plan and its missing quantities. Only after approval can they start shopping.
6. If no retailer is set, they choose a supported retailer; unsupported retailers are clearly declined with a shopping-list fallback.
7. A transparent shopping agent works through the approved missing ingredients, visibly searching, choosing a suitable product and quantity, and adding it to a cart. Each item resolves as Added, Needs attention, or Skipped.
8. The user sees a cart reconciliation and follows **Review retailer cart**. Pantry Rescue stops before checkout, payment, or order placement.

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

When needed, show **Where do you usually shop?** and distinguish the one supported retailer from unsupported retailer entries. Restate the exact shopping task and explain that Pantry Rescue will choose reasonable products/quantities, add them to a cart, and leave review and checkout to the user. **Start shopping →** begins the task.

### Agent Shopping and Finished Cart

The hero path uses a real browser agent to navigate one tested supported retailer or grocery marketplace. The browser interaction is visible in the demo: it opens the site, searches the approved gaps, reads product results, selects appropriate products/quantities, and adds them to the retailer cart. Pantry Rescue also retains a persistent progress panel with completion count, per-ingredient status, and meaningful activity such as search, products found, chosen size/quantity, and item added. It briefly explains choices, e.g. selected 900 mL stock because it is the smallest suitable size for ~750 mL needed.

A clearly labelled simulated/demo storefront is the reliable fallback when the live retailer changes, blocks the agent, requires unavailable authentication, or otherwise cannot complete the task. It receives the same approved gaps and follows the same product-decision rules; it is functional rather than prerecorded.

The completion view says **Your cart is ready for review**, shows counts added and needing attention, and reconciles each approved gap with the selected retailer product or unresolved status. **Review retailer cart →** goes to the retailer cart. Source: `scope.md > The Core Loop`.

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

- As a user, I can direct Pantry Rescue to a supported retailer and watch it shop only my approved gaps.
  - [ ] The task starts with the approved consolidated missing-ingredient list, not a generic list.
  - [ ] For one tested supported retailer, a visible browser agent navigates the retailer website, searches approved gaps, chooses suitable products/quantities, and adds them to the cart.
  - [ ] Agent progress visibly records searching, choosing, quantity, and add-to-cart actions.
  - [ ] Product selection follows this hierarchy: ingredient match, required quantity, straightforward/general product, and no substantially excessive size where practical.
  - [ ] The current retailer interaction remains visible during the demo.
- As a user, I can understand and control uncertain matches.
  - [ ] If an exact match is not confident, show a small set of plausible alternatives for user approval or a Skip action.
  - [ ] The agent never independently makes a meaningful substitution that could alter a recipe or violate a dietary preference.
  - [ ] Every approved gap ends visibly as Added, Needs attention, or Skipped.
  - [ ] The completion screen reconciles every original gap with the retailer product/status and ends at review, never checkout.

## States and Boundaries

- **First use** — The empty Pantry Setup introduces the product premise and offers manual entry or the sample pantry.
- **Usable inventory** — The plan CTA appears after a small usable inventory has been established.
- **Need more inventory** — If too few useful ingredients exist, show “We need a little more of your kitchen,” the current item/urgent count, and **Add more groceries** and **Try the sample pantry**. Do not make arbitrary recipes that require mostly new purchases.
- **Constraints conflict** — If the inventory is usable but no suitable meals meet the selected choices, show “We couldn’t find a good rescue plan with these choices,” name the relevant choices where possible, and offer **Change preferences** or a user-approved lower meal count when valid.
- **Low rescue value** — If a valid plan uses too little inventory and needs too many purchases, disclose the ratio and offer **Adjust my plan**, **Add more pantry items**, or **Use this plan anyway**. Do not frame it as a strong rescue result.
- **Partial urgent-food rescue** — Keep use-soon ingredients that were not included visible, e.g. “2 of 3 use-soon ingredients rescued,” with a lightweight **Find a use for it →** option. This need not trigger a full second planning flow in the POC.
- **Unsupported retailer** — State that Pantry Rescue cannot shop that retailer yet; offer the supported retailer or a shopping-list view. Never imply automation will occur.
- **Uncertain/no product match** — Flag the item as Needs attention, offer plausible approval-required alternatives when available, and continue with other gaps.
- **Live retailer interruption** — If the browser agent encounters login, anti-automation friction, unavailable products, lost navigation state, or another safe-continuation failure, mark the affected item Needs attention, continue other items where possible, and return control to the user. Do not claim success.
- **Demo retailer fallback** — If the live path is unavailable for development or judging, clearly label the demo storefront and run the same approved task and decision rules there.
- **Shopping completion** — Show the real cart reconciliation after all items resolve as Added, Needs attention, or Skipped. Checkout, payment, delivery/pickup, retailer account information, and final purchase remain wholly user-controlled.

## Product Decisions

- Inventory setup comes before recipes, retailer choice, or detailed nutrition because “start with what you already have” is the product premise.
- Manual entry and a preloaded sample pantry both use one interface: manual entry proves the experience works; the sample enables a quick reliable demo.
- Three planning constraints stay intentionally narrow—meal count, dietary preference, exclusions—with rescue-first selected by default, keeping the core problem in focus.
- Meal reasoning is inspectable with High/Medium/Low rescue value and explanation, rather than an unexplained AI score.
- Food rescued and estimated grocery spend avoided are separate benefits and must be labelled distinctly.
- Shopping begins only after explicit plan approval; changes recalculate gaps before any agent action.
- One tested retailer/marketplace browser path is the hero experience. A controlled simulated storefront is the reliability fallback, must remain functional and generated from actual plan gaps, and must use the same shopping-agent decision logic.
- Shopping ends at retailer-cart review so the agent is bounded and the user retains purchase control.

## What We're Building

An editable manual/sample pantry, lightweight planning constraints, honest rescue-plan outcome states, explainable meal cards and plan reconciliation, plan approval and recalculation, one tested live browser-retailer path, visible functional shopping-agent progress, match exception handling, a functional simulated retailer fallback, and a review-ready cart reconciliation. Source: `scope.md > The POC Boundary`.

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
- Universal retailer compatibility: only one tested live browser path is supported; unsupported retailers must be candidly declined.
- Automatic substitutions for meaningful recipe or dietary decisions: user approval is required.
- Automatic checkout or purchase: Pantry Rescue ends at review by design.
- Shame-oriented waste messaging: urgency is constructive, calm, and legible.

## Open Questions

- Which single retailer/marketplace browser path is reliable enough to use in the recorded demo, and which browser-agent capability will execute it? This must be verified during `4-spec`/build; the controlled simulated retailer remains the approved fallback.
- Whether the POC uses food photography, illustrations, or high-quality placeholders for meal cards can be decided in `4-spec`; it does not change product behavior.
