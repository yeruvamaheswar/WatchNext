import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";

const out = "/cursor/stores/bc-566b9a37-60fe-4f2b-bc40-25ff54192d7f/media";
const origin = "http://127.0.0.1:3000";

async function main() {
  await mkdir(out, { recursive: true });
  const browser = await chromium.launch({
    executablePath: "/usr/bin/google-chrome-stable",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const logs = [];
  page.on("console", (msg) => logs.push(`${msg.type()}: ${msg.text()}`));
  page.on("pageerror", (err) => logs.push(`pageerror: ${err.message}`));

  try {
    await page.addInitScript(() => {
      localStorage.removeItem("watchnext-guest-v1");
    });

    await page.goto(`${origin}/home`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/onboarding/, { timeout: 10000 });
    logs.push(`home without onboarding redirected: ${page.url()}`);

    await page.goto(`${origin}/onboarding`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="swipe-card"]', { timeout: 15000 });
    await page.waitForTimeout(400);
    logs.push(`onboarding start: ${await page.locator("h1").innerText()}`);
    await page.screenshot({ path: `${out}/onboarding-movies.png` });

    await swipeUntilTitle(page, "TV");
    logs.push(`after movies: ${await page.locator("h1").innerText()}`);
    await page.screenshot({ path: `${out}/onboarding-tv.png` });

    await swipeUntilTitle(page, "Vibes");
    logs.push(`after shows: ${await page.locator("h1").innerText()}`);
    await page.screenshot({ path: `${out}/onboarding-vibes.png` });

    await swipeUntilHome(page);
    await page.waitForURL(/\/home/, { timeout: 10000 });
    await page.waitForSelector("text=What should I watch?");
    logs.push(`after finish url: ${page.url()}`);
    await page.screenshot({ path: `${out}/home.png` });
    await page.screenshot({ path: `${out}/mobile-home.png` });

    await page.locator('[data-testid="open-menu"]').click();
    await page.waitForSelector('[data-testid="hamburger-drawer"]');
    logs.push(`hamburger open: ${await page.getByText("Account settings").count()}`);
    await page.screenshot({ path: `${out}/hamburger.png` });

    await page.getByRole("link", { name: "Preferences" }).click();
    await page.waitForURL(/\/preferences/);
    await page.screenshot({ path: `${out}/preferences.png` });

    await page.goto(`${origin}/home`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "What should I watch?" }).click();
    await page.waitForSelector('[data-testid="recommend-error"]', { timeout: 8000 });
    logs.push(`home error: ${await page.locator("[data-testid=recommend-error]").innerText()}`);
    await page.screenshot({ path: `${out}/home-error.png` });

    await page.goto(`${origin}/room`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=Start session");
    await page.screenshot({ path: `${out}/room-idle.png` });
    await page.screenshot({ path: `${out}/mobile-room.png` });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${origin}/user`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#display-name");
    await page.screenshot({ path: `${out}/user.png` });
    await page.goto(`${origin}/account`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=Settings");
    await page.screenshot({ path: `${out}/account.png` });
  } finally {
    console.log(logs.join("\n"));
    await browser.close().catch(() => {});
  }
}

async function swipeCard(page) {
  const card = page.locator('[data-testid="swipe-card"]');
  const box = await card.boundingBox();
  if (!box) return false;
  const y = box.y + box.height / 2;
  const startX = box.x + box.width / 2;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX + 180, y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(180);
  return true;
}

async function swipeUntilTitle(page, text) {
  for (let i = 0; i < 40; i++) {
    const title = await page.locator("h1").innerText();
    if (title.includes(text)) return;
    if (!(await swipeCard(page))) await page.waitForTimeout(200);
  }
  throw new Error(`Did not reach "${text}" after swiping.`);
}

async function swipeUntilHome(page) {
  for (let i = 0; i < 40; i++) {
    if (/\/home/.test(page.url())) return;
    if (!(await swipeCard(page))) await page.waitForTimeout(200);
  }
  throw new Error("Did not reach /home after swiping.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
