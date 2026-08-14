// 初始化脚本:若 config.json 不存在,从 config.example.json 复制一份。
// 用法:node gen-config.cjs
// config.json 是本地个性化覆盖(被 .gitignore 忽略),改它不会污染 git。
const fs = require("fs");

if (!fs.existsSync("config.example.json")) {
  console.error("缺少 config.example.json,无法初始化");
  process.exit(1);
}

if (fs.existsSync("config.json")) {
  console.log("config.json 已存在,跳过(不覆盖你的设置)。如需重置:先删除 config.json 再运行本脚本。");
} else {
  fs.copyFileSync("config.example.json", "config.json");
  console.log("已从 config.example.json 初始化 config.json。");
}
