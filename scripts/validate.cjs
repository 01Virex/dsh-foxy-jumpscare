// 发布前校验脚本:语法 / JSON / 发布文件清单 / dsh 元数据契约。
// 用法:node scripts/validate.cjs
// CI 的 Release 工作流在打 tag 后先跑它,全绿才打包发布;本地发布前也可手动跑。
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
let failures = 0;
const ok = (msg) => console.log("✓ " + msg);
const fail = (msg) => {
  console.error("✗ " + msg);
  failures++;
};

// 1. JS 语法(按 package.json 的 "type": "module" 解析)
for (const f of ["lib/index.js", "lib/client.js"]) {
  const r = spawnSync(process.execPath, ["--check", path.join(root, f)], { encoding: "utf8" });
  if (r.status === 0) ok("syntax " + f);
  else fail("syntax " + f + ":\n" + r.stderr.trim());
}

// 2. JSON 有效
for (const f of ["package.json", "config.example.json"]) {
  try {
    JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));
    ok("json " + f);
  } catch (e) {
    fail("json " + f + ": " + e.message);
  }
}

// 3. 发布文件清单齐全
const releaseManifest = [
  "lib/index.js",
  "lib/client.js",
  "assets/foxy-jumpscare.webp",
  "assets/foxy-scream.ogg",
  "config.example.json",
  "cordis.patch.yml",
  "package.json",
  "README.md",
  "NOTICE.md",
  "LICENSE",
];
for (const f of releaseManifest) {
  if (fs.existsSync(path.join(root, f))) ok("present " + f);
  else fail("missing release file: " + f);
}

// 4. dsh 元数据契约(与 dsh-client-modules / dsh-app-boot 的发现逻辑一致)
let pkg;
try {
  pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
} catch (e) {
  fail("cannot parse package.json: " + e.message);
  pkg = {};
}
const c = pkg.dsh && pkg.dsh.client;
if (!c) fail("package.json 缺少 dsh.client 声明");
else {
  if (c.platform !== "web") fail("dsh.client.platform 必须为 \"web\"");
  if (!Array.isArray(c.inject) || c.inject.some((x) => typeof x !== "string")) fail("dsh.client.inject 必须是字符串数组");
  if (c.immediately !== true) fail("dsh.client.immediately 必须为 true");
}
const client = pkg.exports && pkg.exports["./client"];
if (typeof client !== "string") fail("exports[\"./client\"] 必须是字符串");
else if (!fs.existsSync(path.join(root, client))) fail("client bundle 缺失: " + client);
const main = pkg.exports && pkg.exports["."];
if (typeof main !== "string") fail("exports[\".\"] 必须是字符串");
else if (!fs.existsSync(path.join(root, main))) fail("node half 入口缺失: " + main);
const patch = pkg.dsh && pkg.dsh.bundle && pkg.dsh.bundle.patch;
if (typeof patch !== "string") fail("缺少 dsh.bundle.patch");
else if (!fs.existsSync(path.join(root, patch))) fail("bundle patch 缺失: " + patch);

if (failures === 0) {
  console.log("\nALL CHECKS PASSED");
  process.exit(0);
}
console.error("\n" + failures + " check(s) failed");
process.exit(1);
