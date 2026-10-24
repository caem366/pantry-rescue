# Public deployment: Pantry Rescue

## Architecture

Use a long-running Node service for `app/server/index.ts` and a static Netlify frontend. The service keeps short-lived in-memory browser-session and product-review state for Steel; it is not suitable for a serverless function without redesigning that state.

```
Netlify (React/Vite)
  VITE_API_BASE_URL ── HTTPS ──> Render Node service (/api/*, /health)
                                      ├─ épiceries.ca read-only observations
                                      └─ Steel controlled Demo Market sessions
```

## Render setup (prepared, not deployed)

`render.yaml` is a Blueprint for the Node service. Create the service from the repository and set these server-only values in Render:

- `CORS_ORIGINS=https://YOUR_NETLIFY_SITE.netlify.app`
- `STEEL_API_KEY` and `DEMO_MARKET_URL` only if enabling the controlled cloud-browser proof.
- Kroger values only if enabling the separately authorised Kroger path.
- Leave `MAX_CLOUD_SESSIONS=3` unless a deliberate capacity decision is made.

After Render reports the service URL, verify:

```powershell
Invoke-WebRequest https://YOUR_SERVICE.onrender.com/health
```

It must return JSON with `ok: true` before connecting the frontend.

## Netlify setup

Set one public build-time variable in Netlify:

```
VITE_API_BASE_URL=https://YOUR_SERVICE.onrender.com
```

Redeploy the frontend. This URL is public by design; do not add secrets prefixed `VITE_`. The browser includes cookies only for API sessions, and the backend only permits origins named in `CORS_ORIGINS`.

## Public smoke test

In a private/fresh browser: open the Netlify URL, start the sample pantry, approve gaps, enter a Canadian postal code, and run price comparison. Confirm the response shows épiceries.ca source/timestamp. If Steel is enabled, start one Demo Market session, approve products, verify cart lines, and cancel the session. Never use the result to claim local stock or a real retailer cart.

## Limits and current boundary

The service rate-limits concurrent Demo Market sessions in-memory. It has no cross-instance shared session store, so run one instance for the hackathon demo. The frontend works without the API, but live comparison and Steel controls show their unavailable states until the health-checked service is connected.
