---
name: jarchi-scripting
description: This skill should be used when the user asks to "write a JArchi script", "create an Archi script", "build an .ajs script", "add a dialog to a script", "use SWT widgets", "create a JFace dialog", "use Eclipse UI in JArchi", "extend a Java class in JavaScript", "use Java.type()", "work with ArchiMate elements", "use the jArchi API", "create a library module", "use GraalJS", mentions JArchi, Archi scripting, ArchiMate modeling scripts, SWT/JFace UI, or GraalVM JavaScript for Archi.
---

# JArchi Script Development

Comprehensive guide for writing JArchi scripts — GraalVM GraalJS scripts for Archi (ArchiMate modeling tool) with Eclipse SWT/JFace UI support.

## Environment Overview

**JArchi scripts run in GraalVM GraalJS (ECMAScript 2024), NOT Node.js.** Requirements: Archi 5.7+, JArchi plugin 1.11+.

Critical constraints:
- No Web Workers, no async I/O, no `setTimeout` (unless shimmed)
- No core Node.js modules (`fs`, `path`, `http`) — use `Java.type()` equivalents
- No `require()` for local files — use `load()` instead
- `this` inside `Java.extend()` overrides refers to the Java proxy, not JS

Runtime globals: `$` (jArchi collection constructor), `shell` (Eclipse SWT Shell), `model` / `$.model` (current ArchiMate model), `selection` (selected elements), `__DIR__` (script directory with trailing slash), `__FILE__`, `console`, `window`.

## Script Template

Every top-level `.ajs` script follows this pattern:

```javascript
/**
 * @name Script Name
 * @description Brief description
 * @version 1.0.0
 * @author Author Name
 * @lastModifiedDate YYYY-MM-DD
 */
console.clear();
console.show();

load(__DIR__ + "lib/log.js");
load(__DIR__ + "lib/swtImports.js");

(function () {
    "use strict";
    try {
        log.header("Script Name");
        // Main script logic
        log.success("Script Name: Complete.");
    } catch (error) {
        log.error("Script failed: " + error.toString());
        window.alert("Error: " + error.message);
    }
})();
```

Key points: always clear console first, load `log.js`, wrap in IIFE with `"use strict"`, use try-catch with colored logging.

## Module Pattern

Library modules in `lib/` use the dual-export IIFE pattern:

```javascript
(function() {
    "use strict";
    if (typeof globalThis !== "undefined" && typeof globalThis.myModule !== "undefined") return;
    // ... module code ...
    if (typeof globalThis !== "undefined") globalThis.myModule = myModule;
    if (typeof module !== "undefined" && module.exports) module.exports = myModule;
})();
```

The double-load guard prevents re-initialization. The dual export supports both `load()` (global) and `require()` (CommonJS).

## Loading Dependencies

Use `load()` for local files — it executes in global scope:

```javascript
load(__DIR__ + "lib/swtImports.js");
const { SWT, Label, Text, GridDataFactory } = swtImports;
```

**Never use `require()` for local files** — it resolves to `node_modules/`. Order matters: load dependencies before files that use them. `__DIR__` already includes a trailing separator.

## Java Interoperability

Import Java classes with `Java.type()`, extend with `Java.extend()`:

```javascript
const File = Java.type("java.io.File");
const TitleAreaDialog = Java.type("org.eclipse.jface.dialogs.TitleAreaDialog");
const ExtendedDialog = Java.extend(TitleAreaDialog);
```

**Critical `Java.super()` pattern** — store the dialog reference in an object wrapper:

```javascript
const myDialog = {
    dialog: new ExtendedDialog(shell, {
        configureShell: function(newShell) {
            Java.super(myDialog.dialog).configureShell(newShell);
            newShell.setText("Title");
        },
        createDialogArea: function(parent) {
            const area = Java.super(myDialog.dialog).createDialogArea(parent);
            // Build UI here
            return area;
        }
    }),
    open: function() { return this.dialog.open() === 0; }
};
```

**Always remove the default help button** — `TitleAreaDialog` shows a help button in the lower-left by default. Remove it before opening:

```javascript
myDialog.dialog.setHelpAvailable(false);
myDialog.dialog.open();
```

`Java.super(this)` does NOT work — `this` refers to the Java proxy. Always reference the stored object property.

## JArchi Collection API

Work with model elements using the `$()` collection API:

```javascript
const allProcesses = $("business-process");
// Get selected elements (works from model tree AND view canvas)
load(__DIR__ + "lib/resolveSelection.js");
const selected = resolveSelection.selectedConcepts("element");
const currentView = resolveSelection.activeView();
const named = $("element").filter(e => e.name === "Customer");

// Create elements and relationships
const proc = model.createElement("business-process", "My Process");
const rel = model.createRelationship("serving-relationship", source, target);

// View operations
$(view).children().each(function(child) {
    if (child.concept) console.log(child.concept.name);
});
```

Always handle empty names: `element.name && element.name.trim() ? element.name : "-- unnamed --"`. Check `model` exists before use (may be unset if no model is open).

## Eclipse SWT/JFace UI

### Importing SWT Types

Use the `swtImports` module — it pre-imports all commonly needed SWT/JFace types:

```javascript
load(__DIR__ + "lib/swtImports.js");
const { SWT, GridDataFactory, GridLayoutFactory, Label, Text, Button,
        Combo, Table, TableColumn, TableItem, Tree, TreeItem,
        TabFolder, TabItem, SashForm, Composite, Group,
        TitleAreaDialog, MessageDialog, Dialog,
        Color, Font, Image, Point } = swtImports;
```

It also provides `ExtendedTitleAreaDialog` and `ExtendedDialog` (pre-extended via `Java.extend()`).

### Dialog Pattern (Java.extend + Object Wrapper)

Dialogs use `Java.extend(TitleAreaDialog)` (or `swtImports.ExtendedTitleAreaDialog`) with an object wrapper to solve `Java.super()` scoping:

```javascript
load(__DIR__ + "lib/swtImports.js");
var { SWT, Text, GridDataFactory, ExtendedTitleAreaDialog } = swtImports;

var myDialog = {
    dialog: new ExtendedTitleAreaDialog(shell, {
        configureShell: function(newShell) {
            Java.super(myDialog.dialog).configureShell(newShell);
            newShell.setText("My Dialog");
        },
        createDialogArea: function(parent) {
            var area = Java.super(myDialog.dialog).createDialogArea(parent);
            myDialog.dialog.setMessage("Enter information:");
            var text = new Text(area, SWT.BORDER);
            GridDataFactory.fillDefaults().grab(true, false).applyTo(text);
            myDialog._nameText = text;
            return area;
        },
        okPressed: function() {
            var value = myDialog._nameText.getText().trim();
            if (!value) { myDialog.dialog.setErrorMessage("Required"); return; }
            Java.super(myDialog.dialog).okPressed();
        }
    })
};
myDialog.dialog.setHelpAvailable(false);
if (myDialog.dialog.open() === 0) { /* user clicked OK */ }
```

Simple prompts: `window.prompt("Enter name:")`, `window.confirm("Are you sure?")`, `window.alert("Done.")`.

### Layouts

Use JFace layout factories for cleaner code:

```javascript
GridLayoutFactory.fillDefaults().numColumns(2).margins(10, 10).applyTo(composite);
GridDataFactory.fillDefaults().grab(true, false).span(2, 1).applyTo(widget);
```

Available layouts: `GridLayout`/`GridData`, `FillLayout`, `RowLayout`/`RowData`. Factories: `GridLayoutFactory`, `GridDataFactory`.

### Widgets Quick Reference

| Widget | Style | Purpose |
|--------|-------|---------|
| `Label` | `SWT.NONE`, `SWT.WRAP` | Display text |
| `Text` | `SWT.BORDER`, `SWT.MULTI \| SWT.V_SCROLL` | Text input |
| `Button` | `SWT.PUSH`, `SWT.CHECK`, `SWT.RADIO` | Buttons/checkboxes |
| `Combo` | `SWT.DROP_DOWN \| SWT.READ_ONLY` | Dropdowns |
| `Table` | `SWT.BORDER \| SWT.FULL_SELECTION` | Data tables |
| `Tree` | `SWT.BORDER \| SWT.CHECK` | Hierarchical data |
| `Group` | `SWT.NONE` | Labeled container |
| `TabFolder` | `SWT.TOP` | Tabbed panels |
| `SashForm` | `SWT.HORIZONTAL` | Resizable split |
| `Browser` | `SWT.NONE` | Embedded web view |

### Resource Disposal

Always dispose graphics resources (Color, Font, Image, Cursor) when done. Acquire the display with `swtImports.Display.getCurrent()`:

```javascript
const display = swtImports.Display.getCurrent();
const color = new Color(display, 255, 0, 0);
try { /* use color */ } finally { color.dispose(); }
```

### Event Handling

Add listeners using the `addListener` or typed listener methods:

```javascript
button.addListener(SWT.Selection, function(event) { /* handle click */ });
text.addModifyListener(function(event) { /* handle text change */ });
table.addListener(SWT.Selection, function(event) { /* handle row select */ });
```

## Common Pitfalls

1. **`require()` instead of `load()`** — use `load(__DIR__ + "lib/file.js")`
2. **`Java.super(this)`** — store dialog ref in object, use `Java.super(obj.dialog)`
3. **Raw console.log/error** — use `log.header/info/detail/success/warn/error` from `lib/log.js` instead
4. **Null element names** — always check before using
5. **Undisposed resources** — use try/finally for Color, Font, Image
6. **Double path separator** — `__DIR__` already has trailing separator
7. **Unchecked selection** — use `resolveSelection` (not raw `$(selection)` filters): `selectedConcepts("element")` for elements, `activeView()` for views
8. **Help button on dialogs** — always call `dialog.setHelpAvailable(false)` before `open()` to remove the default help button from `TitleAreaDialog`

## Reference Files

For detailed API documentation and patterns, consult these reference files:

- **`references/script-development-guide.md`** — Full script development guide with complete examples, dialog patterns, model operations, and migration checklist
- **`references/jarchi-api-reference.md`** — JArchi 1.11 API reference with all collection methods, element types, and view operations
- **`references/graaljs-compatibility.md`** — GraalJS runtime details, ECMAScript 2024 features, compatibility extensions, and `load()` semantics
- **`references/java-interop.md`** — Complete Java interoperability guide: `Java.type()`, `Java.extend()`, `Java.super()`, type mappings, and array conversions
