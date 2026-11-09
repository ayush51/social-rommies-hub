import { expect, test } from "@playwright/test";
import { audit, signInAs } from "./helpers";

test("profile: theme toggle, notification settings and change-code validation", async ({ page, context }) => {
  await signInAs(context, "ayush");
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Appearance" })).toBeVisible();

  // theme: Dark adds the .dark class and survives a reload; System removes it again (headless prefers light)
  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(10, 10, 10)");
  await page.getByRole("radio", { name: "Light" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("radio", { name: "System" }).click();

  // notification settings: every category listed, quiet hours reveal the time pickers
  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  await expect(page.getByText("Direct messages")).toBeVisible();
  await page.getByText("Quiet hours (no pings)").click();
  await expect(page.getByText("Until")).toBeVisible();
  await page.getByText("Quiet hours (no pings)").click();

  // change code: client-side validation blocks weak / mismatched codes before any request
  await page.getByLabel("New code", { exact: true }).fill("111111");
  await page.getByLabel("New code again").fill("111111");
  await page.getByLabel("Current code").fill("123456");
  await page.getByRole("button", { name: "Change my code" }).click();
  await expect(page.getByText("less guessable")).toBeVisible();
  await page.getByLabel("New code", { exact: true }).fill("482915");
  await page.getByLabel("New code again").fill("482916");
  await page.getByRole("button", { name: "Change my code" }).click();
  await expect(page.getByText("don't match")).toBeVisible();

  const a = await audit(page);
  expect(a.overflowX).toBeLessThanOrEqual(1);
  expect(a.small.filter((s) => s.h < 32 || s.w < 32)).toEqual([]);
});
