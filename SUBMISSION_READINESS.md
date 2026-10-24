# Pantry Rescue submission readiness

Last audited: 2026-10-23

## Completed in this sprint

- Sharpened the first screen around the kitchen-first value proposition and prominent no-account **Try the demo** action.
- Added a reset-demo label after sample inventory is loaded.
- Added client-side validation for a use-soon day count.
- Improved the Canadian comparison failure message when a static deployment returns HTML rather than the Node API.
- Refined the consumer UI with a warm editorial colour system, ingredient-style visual treatments, richer recipe cards, stronger live/demo shopping hierarchy, and responsive mobile rules.
- Updated browser tests for the new demo CTA.
- Added root `scope.md`, `prd.md`, `spec.md`, README, video script, and Devpost copy.

## Deployment status

**BLOCKER — public live-service access:** `netlify.toml` deploys a static Vite site only. It has no Node/serverless API configuration. Public Netlify judges can use pantry planning and controlled local UI, but `/api` live comparison and Steel controls need a separately hosted Node service plus a public proxy before they can work remotely.

**Prepared deployment path:** `render.yaml`, `DEPLOYMENT.md`, configurable `VITE_API_BASE_URL`, CORS, a health endpoint, and a three-session Demo Market cap are now ready. Deployment itself is pending account authorization and a live health check.

**IMPORTANT — recording path:** Run the app locally for the video unless the backend is hosted. Verify provider/Steel availability immediately before recording.

**OPTIONAL — screenshots:** Capture the five screenshots listed in `app/README.md` and add them to the public repository/Devpost.

## Demo access

1. `cd app; npm install; npm run dev`
2. Open the Vite URL.
3. Click **Try the demo** → **Plan with what I have** → approve missing items.
4. For live observed prices, enter a valid Canadian postal code and choose **Find my cheapest basket**.
5. For the reliable product-flow demonstration, choose the clearly labelled Demo Market simulation. Steel cloud controls require server-only configuration.

## Documentation status

Root scope, PRD, and technical specification are present and describe current limitations. Devpost copy and the recording script are ready for review; URLs remain placeholders.

## Test results

Run these before submission and record their exact output here:

| Check | Result |
| --- | --- |
| `npm run build` | Passed — production Vite build completed 2026-10-23 |
| `npm run lint` | Passed with one pre-existing `react(set-state-in-effect)` warning in `PlannerPanel.tsx` |
| `npm run test:browser -- --reporter=line` | Passed — 35 Playwright tests completed 2026-10-23 |
| `npm run test:walmart:live` | Not runnable in this environment — outbound HTTPS was denied (`EACCES`), so no new live observation is claimed |
| Steel proof | Requires configured credentials and reachable Demo Market |
| Public deployed smoke test | Blocked until Node API is hosted/proxied |

## Video checklist

- [ ] Landing screen appears in first 10 seconds.
- [ ] Sample pantry and use-soon labels are visible.
- [ ] Meal/gap reasoning and explicit approval are shown.
- [ ] Any live price screen shows source/time and read-only boundary.
- [ ] Demo Market is labelled as controlled/simulated.
- [ ] No claim of local stock, retailer cart mutation, checkout, or order placement.

## Devpost checklist

- [ ] Replace demo, repository, and video URL placeholders.
- [ ] Add screenshots.
- [ ] Re-run checks below and replace Pending with actual results.
- [ ] Resolve the hosted backend blocker or describe the local demo clearly.
- [ ] Review all claims against the actual recording.
