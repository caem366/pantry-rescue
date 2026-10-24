# Pantry Rescue scope

## Problem

Young adults living alone or with roommates often own usable groceries but do not know what to cook before food goes bad. They buy more or order takeout, wasting money and ingredients.

## Target user

A cost-conscious Canadian grocery shopper who wants low-effort meal ideas from their actual kitchen, with gentle use-soon prioritisation rather than food-waste guilt.

## Implemented hackathon scope

- Manual pantry entry, editing, zones, and optional use-soon days.
- One-click editable sample pantry and reset-demo action.
- Deterministic rescue recipes, owned-versus-missing reconciliation, and meal toggles.
- Explicit approval of missing ingredients and exact demo products.
- Read-only Canadian price comparison through live épiceries.ca observations when the local service is reachable.
- A separately labelled controlled Demo Market, with Steel + Playwright browser-agent search, approved cart actions, cart verification, activity receipts, and takeover controls when configured.

## Distinctive idea

Pantry Rescue starts with food already paid for, not an empty shopping cart. It makes the decision chain inspectable: use-soon inventory → meal plan → exact gaps → approved products → reviewable cart.

## Out of scope

- Generative recipe creation, allergies, medical nutrition advice, accounts, shared households, or payment.
- Verified local Oakville stock, live retailer cart mutation for Walmart Canada, Metro, Voila, DoorDash, Uber Eats, or Instacart.
- Checkout, delivery/pickup selection at a retailer, substitutions that change a recipe, and placing an order.

## Known limitations

Canadian comparison prices are observed data, not local stock or checkout quotes. Steel automation is proven only against the controlled Demo Market. A static Netlify frontend needs a separately hosted Node API for live provider and Steel endpoints; without it the app deliberately reports those capabilities unavailable.
