import { createInterface } from "node:readline/promises";
import { mkdir, writeFile } from "node:fs/promises";
import { openWalmartHome, previewWalmartBasket, buildWalmartBasket } from "../server/walmartBrowserAgent.ts";
import { releaseCloudDemoSession, startCloudDemoSession } from "../server/steelDemoAgent.ts";

const config = { apiKey: process.env.STEEL_API_KEY ?? "", marketUrl: "https://www.walmart.ca/" };
if (!config.apiKey) throw new Error("STEEL_API_KEY is missing. No paid session was started.");
const ingredient = { id: "parmesan-live-proof", ingredient: "parmesan", requiredQuantity: 150, unit: "g" as const };
const postalCode = process.env.WALMART_TEST_POSTAL_CODE ?? "L6H 1A1";
const session = await startCloudDemoSession(config);
console.log(JSON.stringify({ event: "session_started", sessionId: session.id, viewerUrl: session.viewerUrl }));
try {
  await openWalmartHome(config, session.id);
  console.log(JSON.stringify({ event: "walmart_home_opened" }));
  const preview = await previewWalmartBasket(config, session.id, [ingredient], postalCode);
  if (preview.screenshot) {
    await mkdir("test-results", { recursive: true });
    await writeFile("test-results/walmart-live-preview.png", Buffer.from(preview.screenshot.split(",")[1], "base64"));
    console.log(JSON.stringify({ event: "screenshot", path: "test-results/walmart-live-preview.png" }));
  }
  console.log(JSON.stringify({ event: "preview", selections: preview.selections.map(({ product, quantity, reason }) => ({ productId: product.retailerProductId, name: product.name, size: `${product.packageQuantity} ${product.packageUnit}`, price: product.price, quantity, sourceUrl: product.sourceUrl, reason })), results: preview.results.map(({ status, message }) => ({ status, message })) }));
  if (!preview.selections.length) process.exitCode = 2;
  else {
    const input = createInterface({ input: process.stdin, output: process.stdout });
    const timeout = AbortSignal.timeout(7 * 60_000);
    try {
      const answer = await input.question("Type the exact approved product ID to attempt the cart addition, or press Enter to stop: ", { signal: timeout });
      if (answer.trim() === preview.selections[0].product.retailerProductId) {
        const result = await buildWalmartBasket(config, session.id, preview.previewId, [ingredient.id]);
        console.log(JSON.stringify({ event: "cart_result", results: result.results.map(({ status, message, selection }) => ({ status, message, name: selection?.product.name, quantity: selection?.quantity })), cartItems: result.cartItems, screenshotCaptured: Boolean(result.screenshot) }));
        if (!result.results.every(({ status }) => status === "ADDED")) process.exitCode = 3;
      } else console.log(JSON.stringify({ event: "cart_not_attempted", reason: "Exact product was not approved." }));
    } finally { input.close(); }
  }
} catch (error) {
  console.error(JSON.stringify({ event: "proof_failed", message: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
} finally {
  await releaseCloudDemoSession(config, session.id);
  console.log(JSON.stringify({ event: "session_released", sessionId: session.id }));
}
