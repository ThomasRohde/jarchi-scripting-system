---
description: Scaffold a new JArchi library module in lib/
argument-hint: [module-name]
allowed-tools: Read, Write, Glob, AskUserQuestion
---

Create a new JArchi library module following the project's dual-export module pattern.

## Instructions

1. Determine the module name from `$ARGUMENTS`. If no name was provided, use the AskUserQuestion tool to ask for a module name and what it should provide.

2. Convert the module name to a suitable filename and global name:
   - Filename: camelCase `.js` (e.g., "widget helpers" becomes `widgetHelpers.js`)
   - Global export name: camelCase matching the filename (e.g., `widgetHelpers`)
   - Place it in `scripts/lib/`

3. Ask what the module should export if not already clear.

4. Generate the module file using this exact template structure:

```javascript
/**
 * @module [moduleName]
 * @description [What this module provides]
 * @version 1.0.0
 * @author [user or "Author"]
 * @lastModifiedDate [today's date YYYY-MM-DD]
 */

(function () {
    "use strict";

    // Guard against double-loading
    if (typeof globalThis !== "undefined" && typeof globalThis.[moduleName] !== "undefined") return;

    // ... module code ...

    const [moduleName] = {
        // exported API
    };

    // Dual export: global (for load()) + CommonJS (for require())
    if (typeof globalThis !== "undefined") globalThis.[moduleName] = [moduleName];
    if (typeof module !== "undefined" && module.exports) module.exports = [moduleName];
})();
```

5. Replace `[moduleName]` with the actual camelCase module name throughout.

6. Implement the module's functionality inside the IIFE, exposing the public API through the export object.

7. Follow these critical JArchi conventions:
   - Always include the double-load guard at the top of the IIFE
   - Always include both globalThis export AND module.exports export
   - Use `Java.type()` for any Java class imports needed
   - If the module depends on other modules loaded via `load()`, document that dependency in the JSDoc header but do NOT call `load()` from within a library module — the consuming script is responsible for load order
   - Use `"use strict"` inside the IIFE

8. Write the file and confirm what was created, including how to use it:
   ```javascript
   load(__DIR__ + "lib/[filename].js");
   const { method1, method2 } = [moduleName];
   ```
