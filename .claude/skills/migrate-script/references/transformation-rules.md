# Transformation Rules

Complete rules for transforming external JArchi scripts to match this project's conventions.

## File Naming

### Top-Level Scripts (.ajs)

Convert any naming convention to **Title Case with spaces**:

| Source Name | Target Name |
|---|---|
| `myScript.ajs` | `My Script.ajs` |
| `export-csv.ajs` | `Export CSV.ajs` |
| `find_unused.ajs` | `Find Unused.ajs` |
| `ELKLayout.ajs` | `ELK Layout.ajs` |

Preserve acronyms as uppercase: `CSV`, `ELK`, `HTML`, `SVG`.

### Library Modules (.js in lib/)

Convert to **camelCase**:

| Source Name | Target Name |
|---|---|
| `my-utils.js` | `myUtils.js` |
| `dialog_helpers.js` | `dialogHelpers.js` |
| `CSVExporter.js` | `csvExporter.js` |

## JSDoc Header

Add or rewrite the JSDoc header. For top-level scripts:

```javascript
/**
 * @name Script Name
 * @description Brief description of what the script does
 * @version 1.0.0
 * @author Thomas Rohde
 * @lastModifiedDate YYYY-MM-DD
 */
```

For library modules:

```javascript
/**
 * @module moduleName
 * @description What this module provides
 * @version 1.0.0
 * @author Thomas Rohde
 * @lastModifiedDate YYYY-MM-DD
 */
```

Set `@lastModifiedDate` to today's date. Set `@author` to "Thomas Rohde" unless the original author should be preserved — in that case, use `@author Original Author (migrated by Thomas Rohde)`.

## Script Structure

### Before (typical external script)

```javascript
// Some script
var SWT = Java.type("org.eclipse.swt.SWT");
var elements = $("element");
elements.each(function(e) {
    console.log(e.name);
});
console.log("Done");
```

### After (project convention)

```javascript
/**
 * @name Some Script
 * @description Describes what the script does
 * @version 1.0.0
 * @author Thomas Rohde
 * @lastModifiedDate 2026-02-14
 */

console.clear();
console.show();

load(__DIR__ + "lib/log.js");
load(__DIR__ + "lib/swtImports.js");
load(__DIR__ + "lib/requireModel.js");

(function () {
    "use strict";

    var SWT = swtImports.SWT;

    try {
        requireModel();
        log.header("Some Script");

        var elements = $("element");
        elements.each(function (e) {
            var name = e.name && e.name.trim() ? e.name : "(unnamed)";
            log.info(name);
        });

        log.success("Some Script: Complete.");
    } catch (error) {
        log.error("Script failed: " + error.toString());
        if (error.stack) log.error(error.stack);
        window.alert("Error: " + error.message);
    }
})();
```

## Dependency Replacement

### SWT/JFace Type Imports

Do NOT import SWT/JFace types with individual `Java.type()` calls. Replace with `swtImports`:

```javascript
// BEFORE
var SWT = Java.type("org.eclipse.swt.SWT");
var Label = Java.type("org.eclipse.swt.widgets.Label");
var Text = Java.type("org.eclipse.swt.widgets.Text");
var Button = Java.type("org.eclipse.swt.widgets.Button");
var GridDataFactory = Java.type("org.eclipse.jface.layout.GridDataFactory");

// AFTER
load(__DIR__ + "lib/swtImports.js");
var SWT = swtImports.SWT;
var Label = swtImports.Label;
var Text = swtImports.Text;
var Button = swtImports.Button;
var GridDataFactory = swtImports.GridDataFactory;
```

Available in `swtImports`: SWT, Display, Composite, Label, Text, Button, Combo, Table, TableColumn, TableItem, Tree, TreeItem, TabFolder, TabItem, SashForm, Group, GridDataFactory, GridLayoutFactory, GridData, GridLayout, FillLayout, RowLayout, RowData, Color, Font, Image, Point, TitleAreaDialog, MessageDialog, Dialog, IDialogConstants, ExtendedTitleAreaDialog, ExtendedDialog, and more. Check `scripts/lib/swtImports.js` for the complete list.

Types NOT in swtImports that need direct `Java.type()`:
- `Spinner`: `Java.type("org.eclipse.swt.widgets.Spinner")`
- `StackLayout`: `Java.type("org.eclipse.swt.custom.StackLayout")`

### Model Access

If the script uses `model` or `$.model`, add the requireModel guard:

```javascript
load(__DIR__ + "lib/requireModel.js");

(function () {
    "use strict";
    try {
        requireModel();  // Exits early with alert if no model is open
        // ... rest of script
    } catch (error) { /* ... */ }
})();
```

### Logging

Replace all console output with the `log` module:

```javascript
load(__DIR__ + "lib/log.js");

// BEFORE → AFTER
console.log("Starting...")       → log.header("Script Name");
console.log("Processing...")     → log.info("Processing...");
console.log("  detail")          → log.detail("  detail");
console.log("Done")              → log.success("Script Name: Complete.");
console.warn("Warning")          → log.warn("Warning");
console.error("Error: " + err)   → log.error("Error: " + err);
```

### Dialog Patterns

#### Simple Dialogs

Note: `window.prompt()` works in JArchi for simple string input and does not require migration. For richer input dialogs, use the `ExtendedTitleAreaDialog` pattern:

```javascript
// Simple string input — window.prompt() is acceptable as-is
var name = window.prompt("Enter name:");

// For multi-field or validated input, use ExtendedTitleAreaDialog:
load(__DIR__ + "lib/swtImports.js");
var { SWT, Text, GridDataFactory, ExtendedTitleAreaDialog } = swtImports;
// ... (see Complex Dialogs below for the full pattern)
```

#### Complex Dialogs (TitleAreaDialog)

If the source uses `Java.extend(TitleAreaDialog)`, convert to use `swtImports.ExtendedTitleAreaDialog` and the object-wrapper pattern:

```javascript
// BEFORE (common but broken pattern)
var dialog = new ExtendedDialog(shell, {
    configureShell: function(s) {
        Java.super(this).configureShell(s);  // BROKEN
    }
});

// AFTER (project pattern)
var myDialog = {
    dialog: new swtImports.ExtendedTitleAreaDialog(shell, {
        configureShell: function(s) {
            Java.super(myDialog.dialog).configureShell(s);
            s.setText("Title");
        },
        createDialogArea: function(parent) {
            var area = Java.super(myDialog.dialog).createDialogArea(parent);
            // build UI
            return area;
        }
    })
};
myDialog.dialog.setHelpAvailable(false);
myDialog.dialog.open();
```

### File I/O

Replace any Node.js `fs` module usage with Java equivalents:

```javascript
// BEFORE (Node.js - won't work)
var fs = require("fs");
var content = fs.readFileSync("file.txt", "utf8");

// AFTER (Java interop)
var Files = Java.type("java.nio.file.Files");
var Paths = Java.type("java.nio.file.Paths");
var JString = Java.type("java.lang.String");
var content = new JString(Files.readAllBytes(Paths.get("file.txt")), "UTF-8");
```

### String Concatenation in console.error

GraalJS `console.error()` does not support multiple arguments reliably:

```javascript
// BEFORE
console.error("Error:", error, "in", context);

// AFTER
log.error("Error: " + error.toString() + " in " + context);
```

## Module Conversion

Convert external library files to the project's dual-export IIFE pattern:

```javascript
// BEFORE (various patterns)
module.exports = { helper: function() {} };
// or
var MyLib = { helper: function() {} };
// or
function helper() {}

// AFTER (project pattern)
(function () {
    "use strict";
    if (typeof globalThis !== "undefined" && typeof globalThis.myLib !== "undefined") return;

    function helper() { /* ... */ }

    var myLib = {
        helper: helper
    };

    if (typeof globalThis !== "undefined") globalThis.myLib = myLib;
    if (typeof module !== "undefined" && module.exports) module.exports = myLib;
})();
```

## Element Name Safety

Wrap any element name access:

```javascript
// BEFORE
var name = element.name;
item.setText(name);

// AFTER
var name = element.name && element.name.trim() ? element.name : "(unnamed)";
item.setText(name);
```

## Selection Handling

Use `resolveSelection` for view resolution (checks menu context, selection, and active editor):

```javascript
load(__DIR__ + "lib/resolveSelection.js");

// Check for view — works even when elements are selected on a view canvas
var view = resolveSelection.activeView();
if (!view) {
    window.alert("Please select or open a view first.");
    return;
}

// Check for elements — works from both model tree and view canvas
var selected = resolveSelection.selectedConcepts("element");
if (selected.size() === 0) {
    window.alert("Please select at least one element.");
    return;
}

// Check for relationships
var rels = resolveSelection.selectedConcepts("relationship");

```
