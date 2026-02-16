"use strict";

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.join(__dirname, "..");
const SCRIPTS_DIR = path.join(PROJECT_ROOT, "scripts");
const REGISTRY_DIR = path.join(SCRIPTS_DIR, "registry");

function relToProject(filePath) {
  return path.relative(PROJECT_ROOT, filePath).replace(/\\/g, "/");
}

function normalizeRelative(filePath, baseDir) {
  return path.relative(baseDir, filePath).replace(/\\/g, "/");
}

function run() {
  const errors = [];

  if (!fs.existsSync(REGISTRY_DIR)) {
    console.error("Missing registry directory: " + relToProject(REGISTRY_DIR));
    process.exit(1);
  }

  const registryFiles = fs
    .readdirSync(REGISTRY_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort();

  const scriptFiles = fs
    .readdirSync(SCRIPTS_DIR)
    .filter((name) => name.endsWith(".ajs") && name !== "Menu.ajs")
    .sort();

  const seenIds = new Map();
  const scriptsReferencedByRegistry = new Set();

  for (const registryFile of registryFiles) {
    const registryPath = path.join(REGISTRY_DIR, registryFile);
    let entry;

    try {
      entry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
    } catch (err) {
      errors.push(registryFile + ": invalid JSON (" + (err && err.message ? err.message : String(err)) + ")");
      continue;
    }

    if (!entry || typeof entry !== "object") {
      errors.push(registryFile + ": must contain a JSON object");
      continue;
    }

    if (!entry.id || typeof entry.id !== "string" || entry.id.trim().length === 0) {
      errors.push(registryFile + ": missing or empty 'id'");
    } else if (seenIds.has(entry.id)) {
      errors.push(
        registryFile + ": duplicate id '" + entry.id + "' (already used by " + seenIds.get(entry.id) + ")"
      );
    } else {
      seenIds.set(entry.id, registryFile);
    }

    if (!entry.title || typeof entry.title !== "string" || entry.title.trim().length === 0) {
      errors.push(registryFile + ": missing or empty 'title'");
    }

    if (!Array.isArray(entry.category) || entry.category.length === 0) {
      errors.push(registryFile + ": missing or empty 'category' array");
    }

    if (!entry.script || typeof entry.script.path !== "string" || entry.script.path.trim().length === 0) {
      errors.push(registryFile + ": missing or empty 'script.path'");
    } else {
      const scriptPath = path.resolve(SCRIPTS_DIR, entry.script.path);
      if (!fs.existsSync(scriptPath)) {
        errors.push(registryFile + ": script file not found at '" + entry.script.path + "'");
      } else {
        const scriptRel = normalizeRelative(scriptPath, SCRIPTS_DIR);
        if (!scriptRel.endsWith(".ajs")) {
          errors.push(registryFile + ": script path must target a .ajs file (" + entry.script.path + ")");
        }
        scriptsReferencedByRegistry.add(scriptRel);
      }
    }

    if (entry.help && typeof entry.help.markdown_path === "string" && entry.help.markdown_path.trim() !== "") {
      const helpPath = path.resolve(REGISTRY_DIR, entry.help.markdown_path);
      const normalizedHelp = path.relative(SCRIPTS_DIR, helpPath);
      if (normalizedHelp.startsWith("..")) {
        errors.push(registryFile + ": help markdown_path escapes registry directory");
      } else if (!fs.existsSync(helpPath)) {
        errors.push(registryFile + ": help markdown file not found at '" + entry.help.markdown_path + "'");
      }
    }
  }

  for (const scriptFile of scriptFiles) {
    if (!scriptsReferencedByRegistry.has(scriptFile)) {
      errors.push("No registry entry found for script '" + scriptFile + "'");
    }
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error("[registry] " + error);
    }
    console.error("\nRegistry check failed: " + errors.length + " issue(s).");
    process.exit(1);
  }

  console.log("Registry check passed (" + registryFiles.length + " entries, " + scriptFiles.length + " scripts).");
}

run();
