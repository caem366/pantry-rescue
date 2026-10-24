# Pantry Rescue demo video script (105 seconds)

## Before recording

- Run `npm run dev` from `app/`; clear browser storage or use a fresh profile.
- For a public recording, first follow `DEPLOYMENT.md` and verify the hosted service `/health`; set Netlify `VITE_API_BASE_URL` to that service.
- Confirm the local shopping service is reachable. If using live prices, confirm one real comparison before recording.
- Configure Steel and `DEMO_MARKET_URL` only if showing the real cloud-browser Demo Market proof.
- Keep a backup recording path ready: Demo Market simulation and its cart review; do not portray it as a real retailer.

## Script and screen actions

| Time | Narration | Screen action |
| --- | --- | --- |
| 0:00–0:08 | “This is Pantry Rescue: meal planning that starts with your kitchen, not an empty cart.” | Show landing screen, headline, and **Try the demo**. |
| 0:08–0:18 | “It is for people who buy groceries with good intentions, then wonder what to make before food goes bad.” | Click **Try the demo**; pause on spinach, mushrooms, and yogurt marked **Use soon**. |
| 0:18–0:31 | “The pantry is editable, but the demo gets us to a practical plan instantly.” | Click **Plan with what I have**. Show three meal cards and owned/missing summary. |
| 0:31–0:43 | “Each recommendation explains why it belongs: it rescues urgent food, uses what is already owned, and keeps the shopping list small.” | Toggle a meal if useful; show the reconciliation list. |
| 0:43–0:52 | “I approve only the missing ingredients. Pantry Rescue never shops from an unapproved list.” | Click **Approve**. |
| 0:52–1:07 | “For Canadian comparison, it checks observed retailer prices from a read-only live source. These are not local stock or checkout prices.” | Enter a postal code and click **Find my cheapest basket**. Show source/time and product links. If unavailable, say the live provider is unavailable and switch to Demo Market. |
| 1:07–1:25 | “The agent workflow is also visible in a controlled Demo Market: it matches products, waits for exact-product approval, then verifies its cart before saying an item was added.” | Select demo basket, approve exact products, run the cart. Show progress receipts and review. |
| 1:25–1:37 | “No real retailer cart, payment, or checkout is automated here. The customer stays in control.” | Show simulated-cart label and review state. |
| 1:37–1:45 | “Pantry Rescue makes the smart choice feel simple: use what you own, rescue what matters, and buy only the gaps.” | Return to summary / logo. |

## Backup and claims to avoid

- If `epiceries.ca` is unavailable, show its error state and the explicitly labelled demo basket; do not fabricate a live price.
- If Steel is unavailable, show the same controlled Demo Market flow locally or a prior screen recording labelled Demo Market. Do not say a cloud session ran live.
- Do not claim local stock, real Walmart/Metro/Voila carts, retailer checkout totals, saved money, or completed orders.
