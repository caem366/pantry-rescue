# Kroger Shopping Spike

## Supported path and limits

The project uses Kroger's official API for product search and cart-add requests. It does **not** use Playwright to navigate or click through Kroger's retail website. The developer API reference supplied during implementation is <https://developer.kroger.com/reference/>. Kroger's public API workspace also documents OAuth and cart operations:

- [Kroger public APIs](https://www.postman.com/kroger/the-kroger-co-s-public-workspace/collection/ki6utqb/kroger-public-apis)
- [Cart API](https://www.postman.com/kroger/the-kroger-co-s-public-workspace/folder/t2rsls3/cart)
- [Add to cart](https://www.postman.com/kroger/the-kroger-co-s-public-workspace/request/mwiie4o/add-to-cart)

This repository has not completed a live request with the user's registered developer app and authorized Kroger account. It also has no established cart read-back contract. A successful API response therefore remains unverified until the user inspects the real Kroger cart and confirms the item. There is no checkout, payment, or order submission.

## Implemented flow

1. The user approves missing ingredients in Pantry Rescue.
2. The UI posts those gaps to `POST /api/shopping/kroger/preview`. The Node service searches the location-specific Kroger catalog and returns product selections without writing to the cart.
3. Pantry Rescue displays the selected products and package quantities for a second, exact-product approval.
4. The UI posts the server-issued `previewId` and all approved ingredient IDs to `POST /api/shopping/kroger/shop`. The preview is bound to the browser session, expires after five minutes, and can only be used once.
5. Before any cart write, the service repeats the catalog lookup and checks product identity, quantity, price, and availability against the reviewed selection. Changed or incomplete approvals fail without writing.
6. Each item reports its own outcome. An accepted API write is not presented as verified cart state; the user must open and inspect the real cart.

The adapter does not retry ambiguous cart-write failures, to avoid accidentally adding duplicate items. Product selection fails closed when package quantities or dietary constraints cannot be verified.

## Configuration

Register a Kroger application and configure the local shopping service using the names in `app/.env.example`:

```text
KROGER_CLIENT_ID=
KROGER_CLIENT_SECRET=
KROGER_REDIRECT_URI=http://127.0.0.1:3000/api/shopping/kroger/callback
KROGER_LOCATION_ID=
```

Register the redirect URI exactly. Keep credentials in the ignored local `app/.env` file; never send them in chat or commit them. The user signs in through Kroger's OAuth flow; Pantry Rescue does not collect the Kroger website password. The current UI disables Kroger connection until credentials and a store location are configured.

## Simulation boundary

Demo Market and Uber Eats (Simulated) use local fixture products and an in-memory cart. They do not modify a real account. Live Uber Eats access remains unavailable until the required access and API contract are provided. No simulation is evidence of a live cart integration.

## Verification

From `app/`:

```powershell
npm run build
npm run lint
npm run test:browser -- --reporter=line
```

The automated tests use mocked Kroger responses and simulations; they verify the approval and failure-handling logic, not a real Kroger cart mutation. A live check requires user-provided local configuration and authorization, followed by manual inspection of the real cart.

## Safety boundary

Do not automate the Kroger retail website without an explicit, verifiable permission basis. Do not bypass CAPTCHA, bot protection, access controls, or retailer restrictions. If the supported API path is unavailable, use a user-assisted handoff rather than attempting to evade site protections. The agent stops before checkout and never places an order.
