const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const appUrl = process.env.SUBTEXT_CAPTURE_URL || "http://127.0.0.1:3105";
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outputDir = path.resolve(__dirname, "..", "store-assets", "screenshots");

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
    args: ["--disable-gpu"],
  });
  const context = await browser.newContext({
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    colorScheme: "light",
  });
  const page = await context.newPage();

  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(outputDir, "01-paste-and-customize.png") });

  await page.getByRole("button", { name: /The slow fade/ }).click();
  await page.getByRole("button", { name: "Read this conversation" }).click();
  await page.getByRole("heading", { name: "Your read" }).waitFor();
  await page.locator("#answer-coach").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(outputDir, "05-answer-coach-options.png") });
  await page.getByRole("heading", { name: "Your read" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(outputDir, "03-analysis-summary.png") });

  await page.getByText("See conversation evidence and full analysis", { exact: true }).click();
  await page.getByRole("heading", { name: "The conversation" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(outputDir, "04-colour-coded-speakers.png") });

  await browser.close();

  for (const name of fs.readdirSync(outputDir).filter((file) => file.endsWith(".png")).sort()) {
    const file = path.join(outputDir, name);
    const stat = fs.statSync(file);
    console.log(`${name}\t${stat.size}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
