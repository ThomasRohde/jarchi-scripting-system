---
name: migrate-script
description: This skill should be used when the user asks to "migrate a JArchi script", "import a script from GitHub", "integrate an external script", "adapt a script to this project", "convert a script to project conventions", "port a script to this project", or mentions migrating, importing, porting, or integrating JArchi/Archi scripts from external repositories or sources into this project.
---

# JArchi Script Migration

Procedural guide for migrating external JArchi scripts into this project. Migration means transforming scripts to match project conventions — not copying files verbatim.

## Migration vs. Copying

Migration involves structural transformation:
- Rewriting to match the project's script template (IIFE, try-catch, `log.js`)
- Adapting dependencies to use project libraries (`swtImports.js`, `requireModel.js`, etc.)
- Converting file naming to project conventions
- Creating registry entries for the menu system
- Handling npm dependencies through the vendor system

## Migration Workflow

### 1. Clone and Discover

Clone the source repository to a temporary directory and scan for scripts:

```bash
git clone --depth 1 <url> /tmp/jarchi-migrate-<timestamp>
```

Identify `.ajs` files and their local dependencies (other `.js` files loaded via `load()` or `require()`). Map the dependency graph before making changes.

### 2. Analyze Each Script

For each script, determine:
- **Purpose and category** — what it does, which registry category fits (Analysis, Layout, Export, Editing, Cleanup, Utilities)
- **Dependencies** — local `.js` files it loads, npm packages it uses
- **Selection requirements** — does it need elements, views, relationships selected?
- **Danger level** — does it modify the model (medium/high) or only read (low)?
- **Compatibility issues** — Node.js-isms, missing GraalJS support, incompatible patterns

### 3. Transform Scripts

Apply these transformations to each top-level `.ajs` script:

**File naming:** Convert to Title Case with spaces (e.g., `myScript.ajs` → `My Script.ajs`, `export-csv.ajs` → `Export CSV.ajs`).

**Template conformance:** Add a JSDoc header (see `references/transformation-rules.md` for format) and wrap in the project's standard template:
```javascript
/**
 * @name Script Name
 * @description Brief description
 * @version 1.0.0
 * @author Thomas Rohde
 * @lastModifiedDate YYYY-MM-DD
 */

console.clear();
console.show();

load(__DIR__ + "lib/log.js");
// other loads...

(function () {
    "use strict";
    try {
        log.header("Script Name");
        // migrated logic
        log.success("Script Name: Complete.");
    } catch (error) {
        log.error("Script failed: " + error.toString());
        if (error.stack) log.error(error.stack);
        window.alert("Error: " + error.message);
    }
})();
```

**Logging:** Replace `console.log` → `log.info`, `console.warn` → `log.warn`, `console.error` → `log.error`. Add `log.header()` at start, `log.success()` at end.

**Dependencies:** Replace inline `Java.type()` SWT/JFace imports with `swtImports` destructuring. Replace custom dialog patterns with the `ExtendedTitleAreaDialog` object-wrapper pattern from `swtImports`. Add `requireModel()` if the script accesses the model.

**Module pattern:** Convert any library files to the project's dual-export IIFE pattern with double-load guard. Use camelCase filenames for `lib/` modules.

See `references/transformation-rules.md` for the complete transformation ruleset.

### 4. Handle npm Dependencies

If the source script uses npm packages:

1. Check if the package is already vendored in `scripts/vendor/`
2. If not, add the package to `package.json`
3. Add a copy entry to `VENDOR_MODULES` in `build/vendor.js`
4. Create a GraalJS-compatible wrapper in `scripts/vendor/<package>/` if needed (shim `setTimeout`, `module`, `exports`, `global`)
5. Run `npm install && npm run vendor`

See `references/vendor-system.md` for wrapper patterns.

### 5. Create Registry Entries

For each migrated script, create a JSON file in `scripts/registry/` following this schema:

```json
{
  "id": "category.snake_case_name",
  "title": "Human Readable Title",
  "category": ["Category"],
  "order": 10,
  "script": {
    "path": "Title Case Script Name.ajs"
  },
  "description": "One-line description of what the script does.",
  "tags": ["relevant", "tags"],
  "help": {
    "markdown_path": ""
  },
  "run": {
    "danger_level": "low",
    "confirm_message": ""
  },
  "selection": {
    "types": [],
    "min": 0,
    "require_view": false
  }
}
```

Registry field guidelines:
- **id**: `category.snake_case_name` (e.g., `analysis.find_unused_elements`)
- **category**: One of `["Analysis"]`, `["Layout"]`, `["Export"]`, `["Editing"]`, `["Cleanup"]`, `["Utilities"]`
- **danger_level**: `"low"` (read-only), `"medium"` (modifies view/layout), `"high"` (modifies model elements)
- **selection.types**: `["element"]`, `["view"]`, `["relationship"]`, or `[]` for no requirement
- **selection.require_view**: `true` if script operates on a view

If a help file was created (see below), set `markdown_path` to its path relative to `scripts/` (e.g., `"../help/elk-layout.md"`).

See `references/registry-schema.md` for full field documentation.

### 5a. Create Help Files for Complex Scripts

For scripts with significant UI complexity, create an extended help file:

**Complexity criteria** (create a help file if any apply):
- Multi-tab or multi-panel dialog
- 5+ configurable options
- Results that need interpretation (tables, reports)
- Non-obvious behavior that benefits from explanation

**Steps:**
1. Create `scripts/help/<kebab-case-name>.md` (matching the registry filename)
2. Use the help file template from `context/Script Development Guide for Agents.md` Section 8
3. Include: overview, requirements, usage steps, dialog/table column reference, and tips
4. Set `help.markdown_path` in the registry entry

### 6. Clean Up

Remove the temporary clone directory after migration is complete.

### 7. Present Results

Summarize what was migrated:
- Scripts added (with filenames and categories)
- Library modules added
- npm dependencies added
- Registry entries created
- Any manual steps still needed (e.g., testing in Archi)

## Common Source Patterns to Rewrite

| Source Pattern | Project Pattern |
|---|---|
| `require("./lib/foo.js")` | `load(__DIR__ + "lib/foo.js")` |
| `const SWT = Java.type("org.eclipse.swt.SWT")` | `load(__DIR__ + "lib/swtImports.js"); const { SWT } = swtImports;` |
| `console.log("msg")` | `log.info("msg")` |
| `console.error("Error:", err)` | `log.error("Error: " + err.toString())` |
| `Java.super(this).method()` | `Java.super(obj.dialog).method()` |
| Bare script code (no IIFE) | IIFE with `"use strict"` and try-catch |
| `model.something` without check | Add `load(__DIR__ + "lib/requireModel.js"); requireModel();` |
| `$(selection).filter("archimate-diagram-model")` | `load(__DIR__ + "lib/resolveSelection.js"); resolveSelection.activeView()` |
| `$(selection).filter("element")` | `load(__DIR__ + "lib/resolveSelection.js"); resolveSelection.selectedConcepts("element")` |
| `$(selection).filter("relationship")` | `load(__DIR__ + "lib/resolveSelection.js"); resolveSelection.selectedConcepts("relationship")` |

## Reference Files

- **`references/transformation-rules.md`** — Complete transformation rules with before/after examples
- **`references/registry-schema.md`** — Full registry JSON schema documentation
- **`references/vendor-system.md`** — npm vendor system integration guide
