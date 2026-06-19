import { createServer } from "node:http";
import { readFile, mkdir, rm, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { createRequire } from "node:module";

const runtimeModules = "/Users/xiefan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const require = createRequire(`${runtimeModules}/package.json`);
const { chromium } = require("playwright");

const root = new URL("../", import.meta.url).pathname;
const dist = join(root, "dist");
const output = join(root, "qa");
const port = 4173;

const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
};

function safePath(url) {
  const pathname = decodeURIComponent(new URL(url, `http://127.0.0.1:${port}`).pathname);
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const resolved = normalize(join(dist, requested));
  return resolved.startsWith(dist) ? resolved : null;
}

const server = createServer(async (request, response) => {
  const path = safePath(request.url ?? "/");
  if (!path) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const body = await readFile(path);
    response.writeHead(200, { "Content-Type": mime[extname(path)] ?? "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

await mkdir(output, { recursive: true });
await rm(join(output, "qa-error.txt"), { force: true });
let ownsServer = false;
await new Promise((resolve, reject) => {
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE") resolve();
    else reject(error);
  });
  server.listen(port, "127.0.0.1", () => {
    ownsServer = true;
    resolve();
  });
});

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});

const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  colorScheme: "dark",
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console: ${message.text()}`);
});
page.on("pageerror", (error) => errors.push(`page: ${error.message}`));

async function shot(name) {
  await page.screenshot({ path: join(output, name), animations: "disabled" });
}

async function clickUnique(locator, label) {
  const count = await locator.count();
  if (count !== 1) throw new Error(`${label}: expected one element, found ${count}`);
  await locator.click();
}

async function currentLine() {
  return (await page.locator(".line").textContent())?.trim() ?? "";
}

async function advanceUntil(test, limit = 30) {
  for (let step = 0; step < limit; step += 1) {
    if (await test()) return;
    await page.locator("main.story-screen").click({ position: { x: 640, y: 300 } });
  }
  throw new Error("Story did not reach the expected state");
}

try {
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
  await shot("01-title.png");

  await clickUnique(page.getByRole("button", { name: "开始", exact: true }), "start button");
  await page.locator(".line").waitFor({ state: "visible" });
  await shot("02-first-line.png");

  const skipButton = page.locator("button.utility-button", { hasText: "快进" });
  await clickUnique(skipButton, "skip button");
  const skipActive = await skipButton.evaluate((node) => node.classList.contains("is-active"));
  await clickUnique(skipButton, "skip button reset");
  const autoButton = page.locator("button.utility-button", { hasText: "自动" });
  await clickUnique(autoButton, "auto button");
  const autoActive = await autoButton.evaluate((node) => node.classList.contains("is-active"));
  await clickUnique(autoButton, "auto button reset");

  await advanceUntil(async () => (await page.locator(".choices").count()) === 1);
  await shot("03-expression-choice.png");
  await clickUnique(page.getByRole("button", { name: "“你们是谁？”", exact: true }), "expression choice");

  await advanceUntil(async () => (await page.locator(".choices").count()) === 1);
  await shot("04-route-choice.png");
  await clickUnique(page.getByRole("button", { name: "调查广播室", exact: true }), "route choice");

  await advanceUntil(async () => (await currentLine()).includes("这是第二次六月十六日"));
  await shot("05-loop-two.png");

  await page.locator("main.story-screen").click({ position: { x: 640, y: 300 } });
  await page.getByRole("dialog", { name: "获得事实卡" }).waitFor({ state: "visible" });
  await shot("06-loop-fact.png");
  await clickUnique(page.getByRole("button", { name: "收下事实", exact: true }), "accept loop fact");

  await advanceUntil(async () => (await page.locator(".choices").count()) === 1);
  await shot("07-record-choice.png");
  await clickUnique(page.getByRole("button", { name: "去年六月值日表", exact: true }), "record choice");

  await advanceUntil(async () => (await page.locator(".choices").count()) === 1);
  await shot("08-confrontation-choice.png");
  await clickUnique(page.getByRole("button", { name: "“你在保护谁？”", exact: true }), "confrontation choice");

  await advanceUntil(async () => (await page.locator(".choices").count()) === 1);
  await shot("09-rescue-choice.png");
  await clickUnique(page.getByRole("button", { name: "抓住悠真的手", exact: true }), "rescue choice");

  await advanceUntil(async () => (await currentLine()).includes("第一次，有人说起活着的夏见遥"));
  await page.locator("main.story-screen").click({ position: { x: 640, y: 300 } });
  await page.getByRole("dialog", { name: "获得事实卡" }).waitFor({ state: "visible" });
  await shot("10-roster-fact.png");
  await clickUnique(page.getByRole("button", { name: "收下事实", exact: true }), "accept roster fact");

  await advanceUntil(async () => (await currentLine()).includes("请不要先决定我是什么样的人"));
  await shot("11-chapter-final.png");

  await clickUnique(page.getByRole("button", { name: "保存", exact: true }), "save button");
  await page.getByRole("status").waitFor({ state: "visible" });
  const saveStatus = (await page.getByRole("status").textContent())?.trim();
  await shot("12-save-toast.png");
  await page.getByRole("status").waitFor({ state: "hidden" });

  await clickUnique(page.getByRole("button", { name: "事实 2", exact: true }), "facts button");
  await page.getByRole("dialog", { name: "已确认事实" }).waitFor({ state: "visible" });
  const factItems = await page.locator(".facts-list article").count();
  await shot("13-facts.png");
  await clickUnique(page.getByRole("button", { name: "关闭", exact: true }), "close facts button");

  await clickUnique(page.getByRole("button", { name: "记录", exact: true }), "history button");
  await page.getByRole("dialog", { name: "对话记录" }).waitFor({ state: "visible" });
  const historyItems = await page.locator(".log-list article").count();
  await shot("14-history.png");
  await clickUnique(page.getByRole("button", { name: "关闭", exact: true }), "close history button");

  await page.locator("main.story-screen").click({ position: { x: 640, y: 300 } });
  await page.getByRole("dialog", { name: "第一章结束" }).waitFor({ state: "visible" });
  await shot("15-chapter-end.png");

  const reference = (await readFile(join(root, "public/assets/reference-rain-curtain.png"))).toString("base64");
  const implementation = (await readFile(join(output, "05-loop-two.png"))).toString("base64");
  const compare = await context.newPage();
  await compare.setViewportSize({ width: 2560, height: 720 });
  await compare.setContent(`
    <style>*{box-sizing:border-box}html,body{margin:0;background:#000;overflow:hidden}.row{display:flex;width:2560px;height:720px}.row img{display:block;width:1280px;height:720px;object-fit:cover}</style>
    <div class="row"><img src="data:image/png;base64,${reference}"><img src="data:image/png;base64,${implementation}"></div>
  `);
  await compare.screenshot({ path: join(output, "16-comparison-full.png") });

  await compare.setViewportSize({ width: 2560, height: 250 });
  await compare.setContent(`
    <style>*{box-sizing:border-box}html,body{margin:0;background:#000;overflow:hidden}.crop{position:relative;width:1280px;height:250px;overflow:hidden}.row{display:flex}.crop img{position:absolute;left:0;bottom:0;width:1280px;height:720px;object-fit:cover}</style>
    <div class="row"><div class="crop"><img src="data:image/png;base64,${reference}"></div><div class="crop"><img src="data:image/png;base64,${implementation}"></div></div>
  `);
  await compare.screenshot({ path: join(output, "17-comparison-dialogue.png") });
  await compare.close();

  const result = {
    autoActive,
    consoleErrors: errors,
    factItems,
    historyItems,
    saveStatus,
    skipActive,
    viewport: "1280x720",
  };
  await writeFile(join(output, "interaction-results.json"), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const detail = error instanceof Error ? `${error.stack ?? error.message}\n` : `${String(error)}\n`;
  await writeFile(join(output, "qa-error.txt"), detail);
  console.error(detail);
  process.exitCode = 1;
} finally {
  await browser.close();
  if (ownsServer) await new Promise((resolve) => server.close(resolve));
}
