# Canadian retailer discovery investigation

Date: 2026-10-21

## Decision

Pantry Rescue will **not** enable automated discovery or cart actions for Walmart Canada, Voilà, or Metro without written retailer permission or an approved integration. The existing Demo Market is still the only enabled browser-agent execution path.

## Walmart Canada

- Actual website accessed: Yes — the [Walmart Canada terms page](https://www.walmart.ca/en/c/kp/terms) was reached.
- Product search: Not independently run by Pantry Rescue. Muse's four-product result is preliminary evidence only.
- Product pages: Not independently opened by Pantry Rescue.
- Fields independently verified: None from a retailer product result. No product name, price, package size, location-specific availability, or product URL is being stored or presented as verified.
- Access rule: The applicable [Walmart Canada terms page](https://www.walmart.ca/en/c/kp/terms) was reached, but this investigation did not establish a Canadian consumer-site clause that expressly authorizes or expressly prohibits browser assistance. The similar [Walmart.com Terms of Use](https://www.walmart.com/help/article/walmart-com-terms-of-use/3b75080af40340d6bbd596f116fae5a0/) are not being treated as Walmart Canada's terms. The blocker is therefore unresolved Canadian authorization: Pantry Rescue has neither written permission nor a documented consumer-shopping API/partner agreement. Browser automation remains off.
- Cart interaction: Not tested. It remains disabled.

## Voilà by Sobeys and Metro

- Actual website accessed by Pantry Rescue: Their published terms pages were accessed: [Voilà](https://voila.ca/content/terms-and-conditions--conditions-generales) and [Metro](https://www.metro.ca/en/terms-of-use). Product storefronts were not automated.
- Product search and product pages: Not independently tested. Muse's browsing observation is not an authorization or integration result.
- Fields independently verified: None.
- Access rule: Voilà limits service use to personal, non-commercial use unless Sobeys specifically permits otherwise in writing; Metro limits site use to personal, non-commercial use. Neither provision alone is treated as a conclusive ban on every user-directed browser-assistance pattern, but neither is an authorization for a third-party shopping agent. Written retailer permission or an approved integration is required before enabling automation.
- Cart interaction: Not tested and remains disabled.

## Implementation boundary

`RetailerDiscoveryAdapter` now models read-only product discovery separately from product selection, basket optimization, approval, and cart execution. Its requests require a postal code, fulfillment mode, and optional store ID so an approved adapter cannot silently rely on GTA/default data.

The current registry has Walmart Canada, Voilà, and Metro entries, all marked `REQUIRES_RETAILER_PERMISSION`; their discovery capabilities are false and calling them throws without opening a browser. No test product is embedded in production code.

## Next compliant step

Obtain written retailer permission or an approved integration that covers location-aware product discovery. Then implement a retailer-specific adapter, run a low-volume Steel validation for the four-item basket, and only separately evaluate cart permissions. Product discovery alone does not authorize cart automation.

No public, consumer-cart API or affiliate/product-feed authorization for these three Canadian retailers was verified in this investigation. Walmart Marketplace/advertising material is not a customer-cart integration; Voilà and Metro's public consumer terms do not document one. That is an authorization blocker, not evidence that technical browsing would fail.
