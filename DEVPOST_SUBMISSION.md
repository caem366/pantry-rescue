# Pantry Rescue — Devpost submission copy

## Project name

Pantry Rescue

## Tagline

Meal planning that starts with your kitchen, not an empty shopping cart.

## App description

Pantry Rescue helps people turn groceries they already own into practical meals, prioritise food that should be used soon, and shop only for the true gaps. It makes each recommendation inspectable: what is owned, what is rescued, what is missing, and why a product was selected.

## Problem

People living alone or with roommates often have enough food to cook but not enough mental bandwidth to turn it into a plan. The result is forgotten produce, duplicate grocery purchases, and takeout.

## Solution and key features

- An editable pantry with a no-login sample kitchen.
- Gentle **Use soon** prioritisation and explainable rescue meals.
- Consolidated missing ingredients with explicit approval before shopping.
- Canadian observed-price comparison through the live, read-only épiceries.ca provider when available.
- A separately labelled controlled Demo Market where a Steel + Playwright agent searches, selects approved products, verifies the rendered cart, and stops at review.

## Technical implementation

The frontend is React, TypeScript, and Vite. A Node/TypeScript service keeps external-service credentials server-side. The rescue plan and package-size matching are deterministic TypeScript logic. The price provider supplies observed listings and timestamps; it does not supply local inventory or checkout prices. Steel + Playwright is used only against the controlled Demo Market, with approval, progress events, reconciliation, screenshot capture, and takeover controls.

## Innovation and differentiation

Most meal planners begin with recipes and produce a large shopping list. Pantry Rescue begins with what the shopper has already paid for. Its useful agent behavior is not hidden: it shows the handoff from urgent inventory to recipe to exact gap to verified demo-cart result.

## Challenges

The hard part was keeping an exciting browser-agent story honest. Live price observation, local inventory, cart writes, cart verification, and checkout are different capabilities. The product keeps them visibly separate instead of presenting simulated cart actions as a retailer integration.

## What we learned

Reliable consumer AI needs clear approval boundaries, deterministic fallbacks, and truthful states for uncertainty. A useful agent can show product-level evidence without exposing internal reasoning.

## Future roadmap

Add authorised retailer adapters with verified local availability and cart read-back, richer dietary constraints, receipt/pantry import, shared households, and a hosted backend for public live-provider access.

## Links

- Demo URL: `ADD_PUBLIC_DEMO_URL`
- Public repository: `ADD_GITHUB_URL`
- Demo video: `ADD_VIDEO_URL`

## Skills used

Build With AI: Basics planning and build artifacts are retained in `devpost/` (`scope.md`, `prd.md`, `spec.md`, and checklist files). This submission does not claim skills beyond those verifiable project artifacts.

## Important accuracy note

Pantry Rescue does not verify local Canadian stock, modify a real Canadian retailer cart, or place orders. The live provider is read-only; Demo Market is a controlled demonstration.
