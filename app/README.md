# Pantry Rescue

**Make the most of what is already in your kitchen.** Pantry Rescue helps a solo shopper or roommate household track groceries, prioritise food to use soon, build a practical rescue plan, and buy only the gaps.

It is a no-account hackathon demo. Start with **Try the demo**, then follow the visible plan, list approval, basket comparison, and shopping-agent flow.

## What works

- Editable pantry with a realistic sample kitchen and reset-demo action.
- Deterministic recipe rescue plan and consolidated missing-ingredient list.
- Explicit approval before product selection or a cart action.
- Read-only Canadian basket comparison using live `epiceries.ca` observations when the local shopping service is available. Results include source links and observation time; local stock, fees, and checkout totals are not confirmed.
- Clearly labelled Demo Market: Steel + Playwright can search a controlled store, add approved items, verify its rendered cart, capture a screenshot, and allow pause/takeover/resume. It never checks out.

## Boundaries

- Walmart Canada browser shopping is experimental: real searches have been observed, but live product matching and cart addition remain unverified. No real retailer cart addition is claimed for Walmart, Metro, Voilà, DoorDash, or Uber Eats.
- No verified local Canadian inventory, checkout price, payment, delivery, or order placement is implemented.
- A static Netlify deployment serves the frontend only. Its `/api` calls require a separately deployed Node shopping service; without one, live comparison and Steel controls show an honest unavailable state. The local demo still works.

## Screenshots to capture before submission

1. Landing screen with **Try the demo**.
2. Pantry inventory with coral **Use soon** labels.
3. Rescue plan and approved missing list.
4. Live Canadian comparison with its source/time shown, if the provider is available.
5. Demo Market agent progress and verified cart review.

## Run locally

From `app/`:

```powershell
npm install
npm run dev
```

`npm run dev` starts Vite and the local Node shopping service together. Open the URL Vite prints (normally `http://127.0.0.1:5173`). Use **Try the demo**, then **Plan with what I have**.

For a production-like local run:

```powershell
npm run build
npm run preview
```

## Optional services

`epiceries.ca` needs no app key for the read-only public data used here. Steel requires server-only `STEEL_API_KEY` and a reachable `DEMO_MARKET_URL` in `app/.env`; never use `VITE_` for these values or commit the file. See `.env.example`.

## Verify

```powershell
npm run build
npm run lint
npm run test:browser -- --reporter=line
npm run test:walmart:live
```

The last command is a read-only provider check and needs network access. It does not prove local stock or a retailer cart. `npm run test:steel:recipe` additionally needs valid Steel credentials and a reachable controlled Demo Market URL.

## Architecture

React + TypeScript owns the pantry, plan, approvals, and UI. The Node + TypeScript service owns live provider calls and any Steel session credentials. Recipe and selection logic is deterministic TypeScript; product/cart writes only occur after exact product approval. Details are in the root [spec.md](../spec.md).

For a public deployment, host the Node service separately and set the non-secret Netlify build variable `VITE_API_BASE_URL` to its HTTPS URL. Configure that service with the exact Netlify origin in `CORS_ORIGINS`, then verify `/health`. The prepared Render Blueprint and full steps are in [DEPLOYMENT.md](../DEPLOYMENT.md).

## License

Pantry Rescue's original code and documentation are available under the [MIT License](../LICENSE) (copyright 2026 Caelan Mason). Third-party photographs and provider content are not covered by this MIT grant. The bundled food photographs are credited in the app and remain subject to the [Unsplash License](https://unsplash.com/license); dependencies retain their own licenses.

## References

- [épiceries.ca developer documentation](https://www.epiceries.ca/developers)
- [Steel documentation](https://docs.steel.dev/)
