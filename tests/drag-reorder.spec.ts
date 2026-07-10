import { expect, test } from "@playwright/test";

test("rapid crossings reorder once and fully settle", async ({ page }, testInfo) => {
  const consoleIssues: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => consoleIssues.push(`pageerror: ${error.message}`));

  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const cards = page.locator(".watch-grid > [data-watch-id]");
  const handles = page.locator(".watch-grid .reorder-handle");
  await expect(cards).toHaveCount(6);
  await expect(handles).toHaveCount(6);

  const orderBefore = await cards.locator("h3").allTextContents();
  const firstHandle = await handles.nth(0).boundingBox();
  const secondCard = await cards.nth(1).boundingBox();
  const thirdCard = await cards.nth(2).boundingBox();
  expect(firstHandle).not.toBeNull();
  expect(secondCard).not.toBeNull();
  expect(thirdCard).not.toBeNull();

  const start = center(firstHandle!);
  const second = dragPoint(secondCard!);
  const third = dragPoint(thirdCard!);

  const touchClient = testInfo.project.name === "mobile" ? await page.context().newCDPSession(page) : null;

  if (touchClient) {
    await touchClient.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...start, id: 1 }] });
    await page.waitForTimeout(280);
    for (const point of [second, third, second]) {
      await touchClient.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...point, id: 1 }] });
      await page.waitForTimeout(34);
    }
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(second.x, second.y, { steps: 12 });
    await page.mouse.move(third.x, third.y, { steps: 12 });
    await page.mouse.move(second.x, second.y, { steps: 12 });
  }

  await expect(page.locator(".drag-overlay .is-drag-overlay-card")).toHaveCount(1);
  await expect(page.locator(".watch-grid .is-drag-placeholder")).toHaveCount(1);
  expect((await cards.locator("h3").allTextContents())[1]).toBe(orderBefore[0]);

  if (touchClient) {
    await touchClient.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    await page.mouse.up();
  }

  expect(await page.locator(".drag-overlay .is-drag-overlay-card").count()).toBe(1);
  expect(await page.locator(".watch-grid .is-drag-placeholder").count()).toBe(1);
  await expect(page.locator(".drag-overlay .is-drag-overlay-card")).toHaveCount(0);
  await expect(page.locator(".watch-grid .is-drag-placeholder")).toHaveCount(0);
  await expect(cards.nth(1).locator("h3")).toHaveText(orderBefore[0]);

  const inlineDragStyles = await cards.evaluateAll((elements) =>
    elements
      .map((element) => ({ transform: (element as HTMLElement).style.transform, transition: (element as HTMLElement).style.transition }))
      .filter((style) => style.transform || style.transition)
  );
  expect(inlineDragStyles).toEqual([]);
  expect(consoleIssues).toEqual([]);
});

function center(rect: { x: number; y: number; width: number; height: number }) {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function dragPoint(rect: { x: number; y: number; width: number; height: number }) {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + Math.min(rect.height * 0.35, 220)
  };
}
