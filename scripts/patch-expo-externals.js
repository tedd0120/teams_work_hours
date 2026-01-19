const fs = require("fs");
const path = require("path");

const target = path.join(
  __dirname,
  "..",
  "node_modules",
  "@expo",
  "cli",
  "build",
  "src",
  "start",
  "server",
  "metro",
  "externals.js"
);

if (!fs.existsSync(target)) {
  console.log("expo cli externals not found, skip patch.");
  process.exit(0);
}

const source = fs.readFileSync(target, "utf8");
const pattern = /const NODE_STDLIB_MODULES = \[([\s\S]*?)\]\.sort\(\);/;
const match = source.match(pattern);

if (match) {
  const patched = source.replace(
    pattern,
    `const NODE_STDLIB_MODULES = [${match[1]}].map((x)=>x.replace(/^node:/, \"\")).sort();`
  );
  fs.writeFileSync(target, patched, "utf8");
  console.log("expo cli externals patched.");
  process.exit(0);
}

if (source.includes("NODE_STDLIB_MODULES") && source.includes(".map((x)=>x.replace(/^node:/")) {
  console.log("expo cli externals already patched.");
  process.exit(0);
}

console.log("expo cli externals pattern not found, skip patch.");
