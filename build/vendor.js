/**
 * vendor.js - Copies npm modules into scripts/vendor/ for use in JArchi.
 *
 * JArchi runs on GraalJS (not Node.js), so npm modules must be vendored
 * as standalone files that can be loaded via load().
 *
 * Usage:  npm run vendor
 * Also runs automatically on postinstall.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const VENDOR_DIR = path.join(__dirname, "..", "scripts", "vendor");

/**
 * Registry of npm packages and the files to copy into vendor.
 * Each entry maps a vendor subdirectory to an array of copy operations.
 */
const VENDOR_MODULES = {
  dagre: {
    files: [
      {
        src: "node_modules/dagre/dist/dagre.min.js",
        dest: "dagre/dagre.min.js",
      },
    ],
  },
  elkjs: {
    files: [
      {
        src: "node_modules/elkjs/lib/elk-worker.min.js",
        dest: "elkjs/elk-worker.min.js",
      },
    ],
  },
  marked: {
    files: [
      {
        src: "node_modules/marked/marked.min.js",
        dest: "marked/marked.min.js",
      },
    ],
  },
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFile(src, dest) {
  const srcPath = path.join(__dirname, "..", src);
  const destPath = path.join(VENDOR_DIR, dest);

  if (!fs.existsSync(srcPath)) {
    console.error(`  SKIP ${src} (not found - run npm install first)`);
    return false;
  }

  ensureDir(path.dirname(destPath));
  fs.copyFileSync(srcPath, destPath);

  const size = (fs.statSync(destPath).size / 1024).toFixed(1);
  console.log(`  ${dest} (${size} KB)`);
  return true;
}

console.log("Vendoring npm modules into scripts/vendor/...\n");

let totalCopied = 0;
let totalSkipped = 0;

for (const [name, config] of Object.entries(VENDOR_MODULES)) {
  console.log(`${name}:`);
  for (const file of config.files) {
    if (copyFile(file.src, file.dest)) {
      totalCopied++;
    } else {
      totalSkipped++;
    }
  }
}

console.log(`\nDone. ${totalCopied} file(s) copied, ${totalSkipped} skipped.`);

if (totalSkipped > 0) {
  process.exit(1);
}
