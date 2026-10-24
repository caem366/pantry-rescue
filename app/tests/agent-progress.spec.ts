import { expect, test } from "@playwright/test";
import { humanizeAgentEvent, mergeAgentEvents, progress } from "../src/lib/agentProgress";

test("shopper-facing progress maps real agent actions without inventing steps", () => {
  expect(humanizeAgentEvent(progress("DISCOVERY", "Searching Demo Market for parmesan", "ACTIVE")).label).toBe("Searching for parmesan");
  expect(humanizeAgentEvent(progress("DISCOVERY", "Searching for garlic", "ACTIVE")).label).toBe("Searching for garlic");
  expect(humanizeAgentEvent(progress("MATCHING", "parmesan matched", "COMPLETE")).label).toBe("Found possible matches");
  expect(humanizeAgentEvent(progress("OPTIMIZATION", "Cloud browser product review ready", "COMPLETE")).label).toBe("Waiting for approval");
  expect(humanizeAgentEvent(progress("CART", "Adding parmesan to cart", "ACTIVE")).label).toBe("Adding parmesan to cart");
  expect(humanizeAgentEvent(progress("CART", "Cloud browser cart build complete", "COMPLETE")).label).toBe("Shopping complete");
});

test("progress events merge by identity so polled updates do not duplicate", () => {
  const first = progress("DISCOVERY", "Searching for parmesan", "ACTIVE");
  expect(mergeAgentEvents([first], [first, progress("MATCHING", "Found possible matches", "COMPLETE")])).toHaveLength(2);
});
