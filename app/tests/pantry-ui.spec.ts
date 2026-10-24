import { expect, test } from "@playwright/test";

test("sample pantry loads eight foods, stays compact, and resets edited data after refresh", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the sample pantry" }).click();
  await expect(page.locator(".zone article")).toHaveCount(8);
  await expect(page.locator(".inventoryHead")).toContainText("8 ingredients available · 3 expiring soon");
  await expect(page.locator(".zone").filter({ hasText: "Fridge" }).locator("article")).toHaveCount(3);
  await expect(page.locator(".zone").filter({ hasText: "Freezer" }).locator("article")).toHaveCount(1);
  await expect(page.locator(".zone").filter({ hasText: "Pantry" }).locator("article")).toHaveCount(4);
  await expect(page.getByText("Use within 1 day")).toBeVisible();
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem("pantry-rescue-inventory") || "[]"));
  expect(original.map((item: { name: string }) => item.name)).toEqual([
    "Cremini mushrooms", "Baby spinach", "Heavy cream", "Frozen berries",
    "Penne pasta", "Chickpeas", "Crushed tomatoes", "Flour tortillas",
  ]);
  const expectedDates = await page.evaluate(() => [1, 2, 3].map((offset) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }));
  expect(original.slice(0, 3).map((item: { expiresOn: string }) => item.expiresOn)).toEqual(expectedDates);
  await page.reload();
  await expect(page.getByRole("button", { name: "Reset sample pantry" })).toBeVisible();
  await page.getByRole("button", { name: "Edit Heavy cream" }).click();
  await page.getByLabel("Amount").fill("100 mL");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator(".zone article").filter({ hasText: "Heavy cream" })).toContainText("100 mL");
  await page.getByRole("button", { name: "Reset sample pantry" }).click();
  await expect(page.locator(".zone article")).toHaveCount(8);
  await expect(page.locator(".zone article").filter({ hasText: "Heavy cream" })).toContainText("250 mL");
  const reset = await page.evaluate(() => JSON.parse(localStorage.getItem("pantry-rescue-inventory") || "[]"));
  expect(reset).toEqual(original);
  await page.getByRole("button", { name: "Reset sample pantry" }).click();
  await expect(page.locator(".zone article")).toHaveCount(8);
  const heights = await page.locator(".zone").evaluateAll((zones) => zones.map((zone) => Math.round(zone.getBoundingClientRect().height)));
  expect(heights[1]).toBeLessThan(heights[0]);
  expect(heights[0]).toBeLessThan(heights[2]);
});

test("personal ingredients are retained until replacement is confirmed and can be restored", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Ingredient").fill("Yogurt");
  await page.getByLabel("Amount").fill("500 g");
  await page.getByRole("button", { name: "Add to my kitchen" }).click();
  await expect(page.locator(".inventoryHead")).toContainText("1 ingredient available · 0 expiring soon");
  const dateFromToday = (days: number) => page.evaluate((offset) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }, days);
  await page.getByRole("button", { name: "Edit Yogurt" }).click();
  await page.getByLabel("Use-by date").fill(await dateFromToday(2));
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator(".inventoryHead")).toContainText("1 ingredient available · 1 expiring soon");
  await page.getByRole("button", { name: "Edit Yogurt" }).click();
  await page.getByLabel("Use-by date").fill(await dateFromToday(10));
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator(".inventoryHead")).toContainText("1 ingredient available · 0 expiring soon");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Try the sample pantry" }).click();
  await expect(page.locator(".zone article")).toHaveCount(1);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Try the sample pantry" }).click();
  await expect(page.locator(".zone article")).toHaveCount(8);
  await page.reload();
  await page.getByRole("button", { name: "Return to my kitchen" }).click();
  await expect(page.locator(".zone article")).toHaveCount(1);
  await expect(page.locator(".zone article")).toContainText("Yogurt");
  await page.getByRole("button", { name: "Remove Yogurt" }).click();
  await expect(page.locator(".inventoryHead")).toContainText("0 ingredients available · 0 expiring soon");
});

test("use-by dates set urgency and kitchen cards stack on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Try the sample pantry" }).click();
  const boxes = await page.locator(".zone").evaluateAll((zones) => zones.map((zone) => zone.getBoundingClientRect().left));
  expect(Math.max(...boxes) - Math.min(...boxes)).toBeLessThan(2);
  await expect(page.getByRole("button", { name: /find rescue meals/i })).toBeVisible();
  await page.getByRole("button", { name: "Remove Baby spinach" }).click();
  await expect(page.locator(".inventoryHead")).toContainText("7 ingredients available · 2 expiring soon");
  await page.getByRole("button", { name: "Reset sample pantry" }).click();
  await expect(page.locator(".inventoryHead")).toContainText("8 ingredients available · 3 expiring soon");
});
