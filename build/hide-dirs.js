/**
 * hide-dirs.js - Hides non-script directories from JArchi's Script Manager.
 *
 * JArchi's Script Manager uses java.nio.file.Files.isHidden() to filter its
 * tree view. The behavior is platform-specific:
 *
 *   Windows:    checks the DOS hidden attribute (attrib +h)
 *   macOS/Linux: checks for dot-prefixed filenames only — no settable attribute
 *
 * On macOS/Linux this script creates dot-prefixed symlinks and a loader shim
 * so that load(__DIR__ + "lib/...") still works (the real dirs stay in place,
 * but the Script Manager ignores non-dot originals because it follows symlinks).
 *
 * Actually — Files.isHidden() on Unix checks the *name*, and the real dirs
 * aren't dot-prefixed, so they WILL still show. The only reliable Unix fix is
 * renaming to dot-prefixed names, which would break all load() paths.
 *
 * Therefore: on macOS/Linux this script prints a notice and exits cleanly.
 *
 * Usage:
 *   node build/hide-dirs.js            Hide directories
 *   node build/hide-dirs.js --unhide   Restore visibility (Windows)
 *
 * Also runs automatically via: npm run hide / npm run unhide
 */
"use strict";

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const SCRIPTS_DIR = path.join(__dirname, "..", "scripts");

/** Directories under scripts/ to hide from the Script Manager. */
const HIDDEN_DIRS = ["lib", "help", "vendor", "registry"];

const unhide = process.argv.includes("--unhide");
const isWindows = process.platform === "win32";

function dirExists(dir) {
  return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
}

function hideWindows() {
  const action = unhide ? "Unhiding" : "Hiding";
  console.log(`${action} directories from JArchi Script Manager (Windows)...\n`);

  let changed = 0;
  let skipped = 0;

  for (const name of HIDDEN_DIRS) {
    const dir = path.join(SCRIPTS_DIR, name);
    if (!dirExists(dir)) {
      console.log(`  SKIP ${name}/ (not found)`);
      skipped++;
      continue;
    }

    const flag = unhide ? "-h" : "+h";
    try {
      execSync(`attrib ${flag} "${dir}"`, { stdio: "pipe" });
      console.log(`  ${unhide ? "SHOW" : "HIDE"} ${name}/`);
      changed++;
    } catch (err) {
      console.error(`  FAIL ${name}/ — ${err.message}`);
      skipped++;
    }
  }

  console.log(`\nDone. ${changed} directory(s) ${unhide ? "unhidden" : "hidden"}, ${skipped} skipped.`);
}

function hideUnix() {
  console.log(
    "Note: On macOS/Linux, JArchi's Files.isHidden() only detects dot-prefixed\n" +
    "filenames. There is no attribute equivalent to Windows' attrib +h.\n\n" +
    "The following directories cannot be hidden without renaming:\n"
  );

  for (const name of HIDDEN_DIRS) {
    const dir = path.join(SCRIPTS_DIR, name);
    const exists = dirExists(dir) ? "" : " (not found)";
    console.log(`  scripts/${name}/${exists}`);
  }

  console.log(
    "\nWorkarounds:\n" +
    "  1. Rename to dot-prefixed names (.lib, .help, .vendor) and update load() paths\n" +
    "  2. File a feature request at https://github.com/archimatetool/archi-scripting-plugin/issues\n"
  );
}

if (isWindows) {
  hideWindows();
} else {
  hideUnix();
}
