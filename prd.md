# Pantry Rescue PRD

## Product overview

Pantry Rescue is a consumer meal-planning product that turns pantry inventory into a small, explainable rescue plan and a minimal grocery task.

## Personas

- **Intentional solo shopper:** has a varied fridge and pantry but lacks time to plan.
- **Roommate household shopper:** wants to avoid duplicate purchases and use shared groceries first.

## Core journey

1. Open Pantry Rescue and choose **Try the demo** or enter groceries.
2. Review kitchen inventory and use-soon items.
3. Select meals in the rescue plan.
4. Review owned and missing ingredients; approve the gaps.
5. Request a live Canadian observed-price comparison or use the clearly labelled demo basket.
6. Review exact products; approve cart work only after that.
7. Review the Demo Market cart. Purchase remains outside Pantry Rescue.

## Functional requirements and status

| Requirement | Status |
| --- | --- |
| No-account editable pantry and sample inventory | Implemented |
| Use-soon visual treatment and recipe prioritisation | Implemented |
| Explainable meal/gap reconciliation | Implemented |
| Two approval boundaries | Implemented |
| Observed Canadian product-price comparison | Implemented when local API/provider is available |
| Live local inventory or real Canadian retailer cart | Not implemented |
| Controlled Demo Market verified cart | Implemented when Steel is configured |
| Checkout or payment | Intentionally excluded |

## Nonfunctional requirements

The interface must stay legible on mobile, present urgency without alarm, expose meaningful agent states, and never represent an unverified cart action as added. Local secrets must stay on the Node service.

## Acceptance criteria

A judge can use the sample pantry without login, see use-soon groceries, create a plan, approve gaps, understand the live-versus-demo distinction, and complete the simulated cart review. Provider or backend failure must be shown plainly rather than replaced with invented prices.
