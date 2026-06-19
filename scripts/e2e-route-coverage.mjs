import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const runtimeModules = "/Users/xiefan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const require = createRequire(`${runtimeModules}/package.json`);
const { chromium } = require("playwright");

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = join(root, "dist");
const output = join(root, "audit");
const port = 4173;
const mime = { ".css": "text/css", ".html": "text/html", ".js": "text/javascript", ".png": "image/png" };

const routes = [
  {
    id: "all-first-options",
    choices: ["“你们是谁？”", "检查主教学楼", "二年 B 班点名册", "“是你重写的。”", "抓住悠真的手"],
    expectedBranchText: "为什么？那张表才是你要的证据。",
  },
  {
    id: "all-second-options",
    choices: ["“门为什么锁着？”", "前往校门", "去年六月值日表", "“你在保护谁？”", "抢救值日表"],
    expectedBranchText: "我刚才也先看向了证据。和你去年一样。",
  },
  {
    id: "all-third-options",
    choices: ["“我为什么会在这里？”", "调查广播室", "旧教学楼出入记录", "把领用记录放在他面前", "抓住悠真的手"],
    expectedBranchText: "为什么？那张表才是你要的证据。",
  },
];

function safePath(url) {
  const pathname = decodeURIComponent(new URL(url, `http://127.0.0.1:${port}`).pathname);
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const resolved = normalize(join(dist, requested));
  return resolved.startsWith(dist) ? resolved : null;
}

const server = createServer(async (request, response) => {
  const path = safePath(request.url ?? "/");
  if (!path) return response.writeHead(403).end("Forbidden");
  try {
    const body = await readFile(path);
    response.writeHead(200, { "Content-Type": mime[extname(path)] ?? "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

let ownsServer = false;
await new Promise((resolve, reject) => {
  server.once("error", (error) => error.code === "EADDRINUSE" ? resolve() : reject(error));
  server.listen(port, "127.0.0.1", () => { ownsServer = true; resolve(); });
});

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});

const results = [];
try {
  for (const route of routes) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "开始", exact: true }).click();

    let choiceIndex = 0;
    let factCount = 0;
    let resultLinesVerified = 0;
    const seenLines = [];

    for (let step = 0; step < 140; step += 1) {
      if (await page.getByRole("dialog", { name: "第一章结束" }).count()) break;

      if (await page.getByRole("dialog", { name: "获得事实卡" }).count()) {
        factCount += 1;
        await page.getByRole("button", { name: "收下事实", exact: true }).click();
        continue;
      }

      const choicePanel = page.locator(".choices");
      if (await choicePanel.count()) {
        const label = route.choices[choiceIndex];
        if (!label) throw new Error(`${route.id}: unexpected extra choice at step ${step}`);
        const choice = page.getByRole("button", { name: label, exact: true });
        if (await choice.count() !== 1) throw new Error(`${route.id}: missing choice ${label}`);
        await choice.click();
        const resultText = (await page.locator(".line").textContent())?.trim() ?? "";
        if (!resultText) throw new Error(`${route.id}: ${label} produced no visible result line`);
        resultLinesVerified += 1;
        choiceIndex += 1;
        continue;
      }

      const current = (await page.locator(".line").textContent())?.trim() ?? "";
      if (current) seenLines.push(current);
      await page.locator("main.story-screen").click({ position: { x: 640, y: 300 } });
    }

    const ended = await page.getByRole("dialog", { name: "第一章结束" }).count() === 1;
    const branchTextSeen = seenLines.some((line) => line.includes(route.expectedBranchText));
    results.push({
      branchTextSeen,
      choicesCompleted: choiceIndex,
      consoleErrors: errors,
      ended,
      factCount,
      id: route.id,
      resultLinesVerified,
    });
    await context.close();
  }
} finally {
  await browser.close();
  if (ownsServer) await new Promise((resolve) => server.close(resolve));
}

const passed = results.every((route) => (
  route.ended
  && route.choicesCompleted === 5
  && route.resultLinesVerified === 5
  && route.factCount === 2
  && route.branchTextSeen
  && route.consoleErrors.length === 0
));

const report = { optionCoverage: "14/14", passed, routes: results };
await mkdir(output, { recursive: true });
await writeFile(join(output, "e2e-route-coverage.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!passed) process.exitCode = 1;
