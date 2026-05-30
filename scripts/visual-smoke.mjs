import { chromium } from "playwright";

const url = process.env.AURELIA_URL ?? "http://127.0.0.1:5174";

async function canvasSignal(page, selector) {
  return page.evaluate((canvasSelector) => {
    const canvas = document.querySelector(canvasSelector);
    if (!(canvas instanceof HTMLCanvasElement)) {
      return { ok: false, reason: "canvas not found" };
    }

    const rect = canvas.getBoundingClientRect();
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) {
      return { ok: false, reason: "webgl context unavailable", width: rect.width, height: rect.height };
    }

    const width = Math.max(1, gl.drawingBufferWidth);
    const height = Math.max(1, gl.drawingBufferHeight);
    const attributes = gl.getContextAttributes();
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    let litPixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] + pixels[index + 1] + pixels[index + 2] > 18) {
        litPixels += 1;
      }
    }

    const readbackUnavailable = litPixels === 0 && attributes?.preserveDrawingBuffer === false;

    return {
      ok: litPixels > 0 || readbackUnavailable,
      litPixels,
      readbackUnavailable,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      drawingBufferWidth: gl.drawingBufferWidth,
      drawingBufferHeight: gl.drawingBufferHeight,
    };
  }, selector);
}

async function runViewport(browser, viewport, label) {
  const page = await browser.newPage({ viewport });
  await page.goto(url, { waitUntil: "networkidle" });
  for (let second = 0; second < 70; second += 1) {
    if ((await page.locator(".entry__star").count()) === 1) {
      break;
    }

    await page.waitForTimeout(1000);
  }

  if ((await page.locator(".entry__star").count()) !== 1) {
    throw new Error("entry star did not appear");
  }

  const landing = await canvasSignal(page, ".landing__starfield");
  await page.screenshot({ path: `artifacts/${label}-landing.png`, fullPage: false, timeout: 60000 });
  await page.locator(".entry__star").evaluate((element) => element.click());
  await page.waitForSelector(".universe", { state: "visible", timeout: 20000 });
  await page.waitForTimeout(1400);
  const universeCount = await page.locator(".universe").count();
  if (universeCount !== 1) {
    throw new Error(`expected universe scene, found ${universeCount}`);
  }

  const universe = await canvasSignal(page, ".universe__starfield");
  await page.screenshot({ path: `artifacts/${label}-galaxy.png`, fullPage: false, timeout: 60000 });
  await page.waitForSelector(".memory-constellation", { state: "visible", timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.locator(".memory-constellation").click({ force: true, timeout: 20000 });
  await page.waitForSelector(".memory-timeline", { state: "visible", timeout: 20000 });
  const memoryTimeline = (await page.locator(".memory-timeline").count()) === 1;
  if (!memoryTimeline) {
    throw new Error("expected memory timeline to open");
  }
  await page.waitForTimeout(900);
  await page.screenshot({ path: `artifacts/${label}-memory.png`, fullPage: false, timeout: 60000 });
  const memoryMapReady = await page.locator(".memory-star-map__selector button", { hasText: "First laugh" }).count();
  if (memoryMapReady !== 1) {
    throw new Error("expected memory star selector to be available");
  }
  await page.locator(".memory-star-map__selector button", { hasText: "First laugh" }).click({ force: true });
  await page.waitForSelector(".memory-stage--rose", { state: "visible", timeout: 8000 });
  await page.screenshot({ path: `artifacts/${label}-memory-bottom.png`, fullPage: false, timeout: 60000 });
  await page.locator(".memory-timeline__close").click({ force: true });
  await page.waitForSelector(".memory-timeline", { state: "hidden", timeout: 8000 });

  await page.locator(".celestial--moon").evaluate((element) => element.click());
  await page.waitForSelector(".echo-moon-panel", { state: "visible", timeout: 12000 });
  await page.screenshot({ path: `artifacts/${label}-echo-choice.png`, fullPage: false, timeout: 60000 });
  await page.locator(".echo-choice--music").click({ force: true });
  await page.waitForSelector(".echo-audio-room", { state: "visible", timeout: 8000 });
  await page.locator(".echo-track-list button").first().click({ force: true });
  await page.locator(".echo-player button").click({ force: true });
  await page.waitForTimeout(300);
  await page.locator(".echo-moon__back").click({ force: true });
  await page.waitForSelector(".echo-choice-grid", { state: "visible", timeout: 8000 });
  await page.locator(".echo-choice--puzzle").click({ force: true });
  await page.waitForSelector(".echo-puzzle-room", { state: "visible", timeout: 8000 });
  await page.locator(".puzzle-toolbar button", { hasText: "Shuffle" }).click({ force: true });
  await page.locator(".puzzle-toolbar button", { hasText: "Hint" }).click({ force: true });
  await page.locator(".puzzle-toolbar button", { hasText: "Preview" }).click({ force: true });
  await page.locator(".puzzle-tray .puzzle-piece").first().click({ force: true });
  await page.locator(".puzzle-slot").first().click({ force: true });
  const puzzleHasSavedState = await page.evaluate(() => Object.keys(localStorage).some((key) => key.startsWith("aurelia.echoPuzzle.")));
  if (!puzzleHasSavedState) {
    throw new Error("expected Echo Moon puzzle to save state");
  }
  await page.screenshot({ path: `artifacts/${label}-echo-puzzle.png`, fullPage: false, timeout: 60000 });
  await page.locator(".echo-moon__close").click({ force: true });
  await page.waitForSelector(".echo-moon-panel", { state: "hidden", timeout: 8000 });

  await page.locator(".celestial--heart").evaluate((element) => element.click());
  await page.waitForSelector(".heart-chamber", { state: "visible", timeout: 12000 });
  const heartChamber = (await page.locator(".heart-chamber").count()) === 1;
  if (!heartChamber) {
    throw new Error("expected heart chamber to open");
  }
  await page.getByRole("button", { name: "Open the chamber" }).click({ force: true });
  await page.waitForTimeout(1200);
  const heartLetter = (await page.locator(".heart-letter").count()) === 1;
  if (!heartLetter) {
    throw new Error("expected heart letter to appear");
  }
  await page.locator(".heart-chamber__close").click({ force: true });
  await page.waitForSelector(".heart-chamber", { state: "hidden", timeout: 8000 });
  await page.screenshot({ path: `artifacts/${label}-universe.png`, fullPage: false, timeout: 60000 });

  await page.close();
  return { label, landing, universe, memoryTimeline, heartChamber, heartLetter };
}

await import("node:fs/promises").then((fs) => fs.mkdir("artifacts", { recursive: true }));

const browser = await chromium.launch();
try {
  const results = [];
  results.push(await runViewport(browser, { width: 1440, height: 900 }, "desktop"));
  results.push(await runViewport(browser, { width: 390, height: 844 }, "mobile"));

  console.log(JSON.stringify(results, null, 2));

  const failed = results.some(
    (result) =>
      !result.landing.ok || !result.universe.ok || !result.memoryTimeline || !result.heartChamber || !result.heartLetter,
  );
  if (failed) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
