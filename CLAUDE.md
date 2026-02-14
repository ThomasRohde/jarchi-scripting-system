# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JArchi scripts for Archi (ArchiMate modeling tool). Scripts run in **GraalVM GraalJS (ECMAScript 2024), NOT Node.js**. The runtime provides Java interop via `Java.type()` and special globals (`$`, `model`, `shell`, `selection`, `__DIR__`).

**Requirements**: Archi 5.7+, JArchi plugin 1.11+

## Commands

```bash
npm install          # Install deps + auto-vendor (postinstall)
npm run vendor       # Copy npm modules into scripts/vendor/
```

There are no tests or linting configured.

## Architecture

```
scripts/           # JArchi scripts (.ajs files) and libraries
  lib/             # Shared library modules loaded via load()
  help/            # Extended help docs for complex scripts (.md)
  vendor/          # Vendored npm modules (built from node_modules/)
    elkjs/         # ELK graph layout engine
      elk-sync.js      # Synchronous wrapper (our code)
      elk-worker.min.js # ELK engine (copied from npm by build/vendor.js)
build/
  vendor.js        # Build script: copies npm files → scripts/vendor/
context/           # Reference docs for agents (ArchiMate spec, JArchi API, GraalJS compat)
```

### Vendor System

npm packages can't be used directly in JArchi (no Node.js runtime). The vendor system bridges this:

1. Dependencies declared in `package.json` as normal
2. `build/vendor.js` copies specific files from `node_modules/` into `scripts/vendor/`
3. Wrappers in `scripts/vendor/` shim the environment (setTimeout, module/exports, global) for GraalJS compatibility
4. To add a new vendored module: add entry to `VENDOR_MODULES` in `build/vendor.js`

## Code Conventions

### Module Pattern

All library modules use this structure:

```javascript
(function() {
    "use strict";
    // Guard against double-loading
    if (typeof globalThis !== "undefined" && typeof globalThis.myModule !== "undefined") return;

    // ... module code ...

    // Dual export: global (for load()) + CommonJS (for require())
    if (typeof globalThis !== "undefined") globalThis.myModule = myModule;
    if (typeof module !== "undefined" && module.exports) module.exports = myModule;
})();
```

### Loading Dependencies

```javascript
load(__DIR__ + "lib/swtImports.js");    // load() executes in global scope
const { SWT, Label } = swtImports;      // destructure from global
```

**Do NOT use `require()` for local files** — use `load()`. The `require()` function exists but resolves differently (looks in `node_modules/`).

### Script Naming

Top-level `.ajs` scripts use **Title Case with spaces** for filenames (e.g., `ELK Layout.ajs`, `Find Unused Elements.ajs`). Do NOT use PascalCase or kebab-case.

### Script Template

Top-level `.ajs` scripts: clear console, load `log.js`, IIFE, try-catch, `"use strict"`. See `context/Script Development Guide for Agents.md` for the full template.

### Console Logging

Use the `log` module (`lib/log.js`) for color-coded console output in all scripts:

```javascript
load(__DIR__ + "lib/log.js");

log.header("Script Name");      // Blue   — script name at start
log.info("Processing...");      // Default — normal progress
log.detail("  5 items found");  // Gray   — secondary details, sub-steps
log.success("Done.");           // Green  — completion / result summary
log.warn("Skipped 2 items");   // Orange — non-fatal warnings
log.error("Failed: " + err);   // Red    — errors (uses console.error)
```

Convention:
- Start every script with `log.header("Script Name")` after loading deps
- Use `log.detail()` for indented sub-steps (prefix with two spaces)
- End with `log.success(...)` on the happy path
- Catch blocks should use `log.error(...)` instead of raw `console.error()`

### Java Interop

```javascript
const MyJavaClass = Java.type("com.example.MyClass");
const ExtendedClass = Java.extend(MyJavaClass);
```

SWT/JFace types are pre-imported via `swtImports.js` — don't re-import them.

## Key Context Files

Read these before writing JArchi scripts:
- `context/Script Development Guide for Agents.md` — comprehensive coding guide (start here)
- `context/jarchi-1.11-api-reference.md` — latest API features
- `context/graalJS-compatibility.md` — GraalJS runtime details and limitations
- `context/java-interop.md` — Java interoperability patterns

## Critical Constraints

- **No Web Workers, no async I/O, no setTimeout** (unless shimmed) in GraalJS
- **No core Node.js modules** (fs, path, http, etc.) — use `Java.type()` equivalents
- **`this` inside `Java.extend()` overrides refers to the Java proxy**, not JS — store `dialog` reference from constructor instead
- Model operations should use jArchi's `$()` collection API, not raw EMF when possible
- `model` global may be unset if no model is selected — use `requireModel()` from `lib/requireModel.js`
- **Use `resolveSelection`** (`lib/resolveSelection.js`) for all selection handling. Load with `load(__DIR__ + "lib/resolveSelection.js")`:
  - `resolveSelection.activeView()` — get the current view (menu context → selection → active editor). Never use `$(selection).filter("archimate-diagram-model")`.
  - `resolveSelection.selectedConcepts("element")` — get model concepts from tree or view canvas selection. Never use `$(selection).filter("element")` (misses diagram-objects).
  - Only use `$(selection).filter()` directly for diagram-specific types like `"diagram-model-object"` where you need the visual object itself.
