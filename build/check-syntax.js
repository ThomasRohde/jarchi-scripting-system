"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const PROJECT_ROOT = path.join(__dirname, "..");
const ROOTS = [
  path.join(PROJECT_ROOT, "build"),
  path.join(PROJECT_ROOT, "scripts"),
];

const SKIP_DIRS = new Set(["node_modules", ".git"]);
const SKIP_FILE_PATTERNS = [/\.min\.js$/, /\.umd\.js$/];

function collectFiles(dir, out) {
  if (!fs.existsSync(dir)) {
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        collectFiles(fullPath, out);
      }
      continue;
    }

    if (entry.isFile() && (entry.name.endsWith(".js") || entry.name.endsWith(".ajs"))) {
      const skip = SKIP_FILE_PATTERNS.some(p => p.test(entry.name));
      if (!skip) out.push(fullPath);
    }
  }
}

function toDisplayPath(filePath) {
  return path.relative(PROJECT_ROOT, filePath).replace(/\\/g, "/");
}

function run() {
  const files = [];
  for (const root of ROOTS) {
    collectFiles(root, files);
  }

  let failures = 0;
  for (const filePath of files) {
    const source = fs.readFileSync(filePath, "utf8");
    const displayPath = toDisplayPath(filePath);
    try {
      new vm.Script(source, { filename: displayPath });
    } catch (err) {
      failures++;
      console.error("[syntax] " + displayPath);
      console.error("  " + (err && err.message ? err.message : String(err)));
    }
  }

  if (failures > 0) {
    console.error("\nSyntax check failed: " + failures + " file(s) contain parse errors.");
    process.exit(1);
  }

  console.log("Syntax check passed for " + files.length + " file(s).");
}

run();
