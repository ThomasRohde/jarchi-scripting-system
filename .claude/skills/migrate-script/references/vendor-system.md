# Vendor System Integration Guide

How to integrate npm dependencies for use in JArchi scripts via the vendor system.

## Overview

JArchi runs on GraalJS, not Node.js. npm packages cannot be `require()`d directly. The vendor system copies specific files from `node_modules/` into `scripts/vendor/` where they can be loaded with `load()`.

## When Vendor Integration Is Needed

Vendor integration is needed when a source script uses npm packages. Signs include:
- `require("package-name")` in the code
- `package.json` with dependencies
- `node_modules/` directory in the source repo
- Import statements referencing npm packages

## Step-by-Step Integration

### 1. Add the Package to package.json

```bash
npm install <package-name> --save
```

### 2. Add Entry to build/vendor.js

Edit `build/vendor.js` and add to the `VENDOR_MODULES` object:

```javascript
const VENDOR_MODULES = {
  // existing entries...
  "new-package": {
    files: [
      {
        src: "node_modules/new-package/dist/new-package.min.js",
        dest: "new-package/new-package.min.js",
      },
    ],
  },
};
```

Choose the right source file:
- Prefer `.min.js` for smaller size
- Prefer UMD or IIFE builds over ESM (no `import`/`export` in GraalJS)
- Prefer standalone bundles that don't require other modules
- Check `package.json` `main`, `browser`, or `unpkg` fields for the right file

### 3. Create a GraalJS Wrapper (if needed)

Many npm packages assume a browser or Node.js environment. Create a wrapper in `scripts/vendor/<package>/` that shims the missing globals:

```javascript
/**
 * GraalJS wrapper for <package-name>
 * Shims the environment for compatibility.
 */
(function () {
    "use strict";

    // Shim globals the package expects
    var _setTimeout = typeof setTimeout !== "undefined" ? setTimeout : function (fn) { fn(); };
    var _global = typeof globalThis !== "undefined" ? globalThis : this;

    // Provide module/exports for CommonJS detection
    var _module = { exports: {} };
    var _exports = _module.exports;

    // Load the actual package
    load(__DIR__ + "package-name.min.js");

    // Export under a known global name
    if (typeof globalThis !== "undefined") {
        globalThis.packageName = _module.exports || _global.PackageName;
    }
})();
```

### 4. Run the Vendor Build

```bash
npm run vendor
```

This copies files from `node_modules/` into `scripts/vendor/`.

### 5. Use in Scripts

```javascript
load(__DIR__ + "vendor/new-package/wrapper.js");
// packageName is now available as a global
```

## Existing Vendored Packages

Check `scripts/vendor/` for already-vendored packages before adding new ones:

| Package | Vendor Path | Wrapper | Purpose |
|---|---|---|---|
| elkjs | `vendor/elkjs/` | `elk-sync.js` | ELK graph layout engine |
| marked | `vendor/marked/` | — | Markdown to HTML parser |

## Common Compatibility Issues

### setTimeout/setInterval

GraalJS has no built-in timer functions. If the package uses them:

```javascript
// Simple synchronous shim
var setTimeout = function (fn, delay) { fn(); };
var setInterval = function () { /* noop */ };
var clearTimeout = function () {};
var clearInterval = function () {};
```

### process / global / window

```javascript
var process = { env: {}, nextTick: function (fn) { fn(); } };
var global = globalThis;
var window = globalThis;
```

### ES Modules (import/export)

Cannot be used. Find a UMD, CommonJS, or IIFE build of the package instead. Check:
- `dist/` directory for bundled versions
- `browser` field in package.json
- CDN versions (unpkg, jsdelivr) — often provide UMD builds

### Async/Promises

If the package uses Promises or async/await, it may need to be replaced with a synchronous alternative. See `scripts/vendor/elkjs/elk-sync.js` for an example of wrapping an async API synchronously.

## Deciding Whether to Vendor

Not every npm dependency should be vendored. Consider:

- **Simple utilities** (lodash-style): Rewrite the needed functions inline instead
- **Large frameworks**: Usually too complex to shim; find alternatives
- **Build tools**: Not applicable — these run in Node.js, not JArchi
- **Packages with native deps**: Cannot work in GraalJS at all

Good candidates for vendoring:
- Self-contained libraries with minimal dependencies
- Libraries with UMD/IIFE builds
- Libraries that do computation (layout, parsing, formatting) rather than I/O
