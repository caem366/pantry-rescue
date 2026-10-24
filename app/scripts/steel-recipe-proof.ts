import { buildRescuePlan } from "../src/lib/rescuePlan.ts";
import { buildCloudDemoBasket, previewCloudDemoBasket, releaseCloudDemoSession, startCloudDemoSession } from "../server/steelDemoAgent.ts";

const config = { apiKey: process.env.STEEL_API_KEY ?? "", marketUrl: process.env.DEMO_MARKET_URL ?? "" };
const pantry = [
  { id: "spinach", name: "Baby spinach", quantity: "1 bag", useSoon: true },
  { id: "mushrooms", name: "Cremini mushrooms", quantity: "1 bag", useSoon: true },
  { id: "pasta", name: "Penne pasta", quantity: "1 box", useSoon: false },
  { id: "chickpeas", name: "Chickpeas", quantity: "2 cans", useSoon: false },
  { id: "tomatoes", name: "Crushed tomatoes", quantity: "1 can", useSoon: false },
  { id: "tortillas", name: "Flour tortillas", quantity: "1 pack", useSoon: false },
  { id: "yogurt", name: "Greek yogurt", quantity: "500 g", useSoon: true },
  { id: "berries", name: "Frozen berries", quantity: "1 bag", useSoon: false },
];

const gaps = buildRescuePlan(pantry).gaps;
const session = await startCloudDemoSession(config);
try {
  const preview = await previewCloudDemoBasket(config, session.id, gaps);
  if (preview.selections.length !== gaps.length) throw new Error(`Recipe-derived basket did not produce an exact Demo Market selection for every gap: ${JSON.stringify(preview.results)}`);
  const run = await buildCloudDemoBasket(config, session.id, preview.previewId, preview.selections.map((selection) => selection.ingredient.id));
  if (run.results.some((result) => result.status !== "ADDED")) throw new Error("The remote Demo Market cart could not be independently verified for every recipe-derived item.");
  console.log(JSON.stringify({
    proof: "recipe-derived-steel-demo-market",
    viewerUrl: run.viewerUrl,
    recipes: buildRescuePlan(pantry).recipes.map((recipe) => recipe.id),
    gaps: gaps.map((gap) => ({ ingredient: gap.ingredient, quantity: gap.requiredQuantity, unit: gap.unit })),
    cart: run.cartItems,
    screenshotCaptured: Boolean(run.screenshot),
    statuses: run.results.map((result) => ({ ingredient: result.ingredient.ingredient, status: result.status })),
  }));
} finally {
  await releaseCloudDemoSession(config, session.id);
}
