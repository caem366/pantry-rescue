---
doc: scope
status: approved
---

# Pantry Rescue

> **Submission status (October 25, 2026):** This approved scope records the original plan, not a claim that every retailer path below was delivered. The implemented, verified browser-cart demonstration is the controlled Demo Market. Walmart Canada browser shopping is experimental; live product matching and cart addition have not been fully verified. Kroger, Uber Eats, and DoorDash are not functioning submission integrations. See the root-level `scope.md`, `prd.md`, and `spec.md` for the current product boundary.

Meal planning that starts with your kitchen, not an empty shopping cart.

## The Unique Kernel

Pantry Rescue turns a real, time-sensitive kitchen inventory into a practical meal plan, then has a transparent shopping agent buy only the gaps. It makes the full decision chain visible: what the user owns, what needs using soon, what meals fit, what is missing, and how those exact missing items become a review-ready cart.

## Who It's For

Young adults living alone or with roommates who buy groceries with good intentions, then face a fridge and pantry full of partial ingredients. They want to save money and waste less, but meal planning feels like another chore; today they often order food or buy more groceries despite already owning usable food.

## The Core Loop

The user establishes their current inventory, chooses planning constraints, and receives a plan that uses what they own—especially items nearing expiry. They see what was rescued and exactly what must still be bought, then ask an agent to shop those gaps at their chosen supported retailer and review the completed cart.

## Inspiration & Identity

A polished, calm consumer product that makes the user feel financially clever: “Wait, I already have most of what I need—and Pantry Rescue figured out what to do with it for me.” Sustainability is a welcome side effect, not a lecture. A light Rescue Score, ingredients rescued, and estimated grocery spend avoided provide satisfying feedback without guilt or game mechanics.

## Why This Matters to the Learner

The learner wants to practice product planning, AI-agent workflows, and building a working web app. The project is intentionally more than an AI recipe generator: it demonstrates a useful agent taking transparent, bounded action.

## What "Working" Looks Like

In a short demo, a user manually adds one or two groceries, loads a realistic sample pantry, and sets simple meal constraints. Pantry Rescue produces a plan that makes the payoff obvious—e.g. 23 ingredients needed, 17 already owned, several expiring foods rescued, and only 6 to buy. Selecting “Shop missing ingredients” visibly creates a shopping task: the agent searches, evaluates, selects suitable product quantities, and adds the six generated gaps to a cart. It stops at “Review cart”; the user never checks out or pays.

## The POC Boundary

- Manual pantry entry with item name, quantity, and optional use-by/urgency.
- A realistic preloaded sample pantry for a quick, repeatable demo.
- Meal-plan generation that prioritizes expiring food and respects a limited set of stated constraints.
- Clear plan explanations: ingredients used/rescued, missing ingredients, and a Rescue Score or equivalent practical summary.
- Retailer selection with the existing Kroger API path preserved and Uber Eats as the preferred additional path only when Uber grants Consumer Delivery access; clearly identify any unavailable live integration.
- A visible, functional shopping-agent flow that generates searches, product choices, quantities, cart contents, and progress from the plan’s actual missing ingredients.
- A controlled simulated storefront is an acceptable reliable fallback, but must never be represented as an Uber or Kroger real cart.

## Later

- Live automation for additional grocery retailers.
- Photo-based pantry recognition.
- Broader household modes such as fitness meal prep or families.
- More advanced dietary, macro, budget, and nutrition planning.
- Purchase, payment, delivery, and account integrations.

## Explicitly Cut

- Universal grocery-site support: unreliable automation would weaken the proof of concept.
- Automatic checkout or payment: unsafe and unnecessary; the experience ends at user review.
- Photo recognition: establishing inventory reliably matters more than how it is entered.
- Full nutrition and macro product: these remain planning constraints, not a second product.
- A generic recipe-chatbot experience: it does not prove the inventory-to-cart kernel.
