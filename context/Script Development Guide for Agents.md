# JArchi Script Development Guide for Coding Agents

This guide provides comprehensive instructions for AI coding agents (Claude, GPT, Copilot, etc.) on creating, migrating, and maintaining JArchi scripts. Follow these instructions precisely to produce working scripts.

---

## Table of Contents

1. [Environment Overview](#environment-overview)
2. [Script Template](#script-template)
3. [Loading Dependencies](#loading-dependencies)
4. [Java Interoperability](#java-interoperability)
5. [Creating Dialogs with Java.extend](#creating-dialogs-with-javaextend)
6. [Working with the ArchiMate Model](#working-with-the-archiarchimate-model)
7. [Adding Scripts to the Menu System](#adding-scripts-to-the-menu-system)
8. [Documentation Requirements](#documentation-requirements)
9. [Common Pitfalls and Solutions](#common-pitfalls-and-solutions)
10. [Testing Scripts in Archi](#testing-scripts-in-archi)
11. [Migration Checklist](#migration-checklist)
12. [Complete Script Example](#complete-script-example)

---

## Environment Overview

### Critical Understanding

**JArchi scripts run in GraalVM JavaScript, NOT Node.js.**

Key differences from Node.js:
- No `require()` for local files - use `load()` instead
- No npm packages - only Java interop and built-in JavaScript
- Java classes are available via `Java.type()`
- The runtime provides special globals: `$`, `shell`, `selection`, `model`

### Runtime Globals Available

| Global | Description |
|--------|-------------|
| `$` | jArchi collection constructor - wrap elements to use collection methods |
| `$(selection)` | Currently selected elements in Archi |
| `$.model` | The currently open ArchiMate model |
| `shell` | The Eclipse SWT Shell (parent window) |
| `model` | Alias for `$.model` |
| `__DIR__` | Directory path of the current script (with trailing slash) |
| `__FILE__` | Full path of the current script |
| `console` | Console object for logging |
| `window` | Object with dialog utilities |

### JArchi Version Requirements

- Archi: 5.7+
- JArchi plugin: 1.11+
- Scripts in this repository use features from JArchi 1.11

---

## Script Template

Every top-level script (`.ajs` file in `scripts/` folder) should follow this template:

```javascript
/**
 * @name Script Name
 * @description Brief description of what the script does
 * @version 1.0.0
 * @author Your Name
 * @lastModifiedDate YYYY-MM-DD
 */

console.clear();
console.show();

// Load dependencies
load(__DIR__ + "lib/log.js");

// Wrap in IIFE for encapsulation
(function () {
    "use strict";

    try {
        log.header("Script Name");

        // Main script logic here

        log.success("Script Name complete.");
    } catch (error) {
        log.error("Script failed: " + error.toString());
        if (error.stack) log.error(error.stack);
        window.alert("Error: " + error.message);
    }
})();
```

### Key Points

1. **Always clear console first**: `console.clear(); console.show();`
2. **Load `lib/log.js`** and use `log.header()` / `log.info()` / `log.success()` / `log.error()` for output
3. **Use IIFE pattern**: `(function() { ... })();` prevents variable pollution
4. **Use "use strict"**: Catches common JavaScript errors
5. **Wrap in try-catch**: Provide user-friendly error messages with `error.stack` logging

---

## Loading Dependencies

### The `load()` Function

Use `load()` to include JavaScript files. This is NOT the same as `require()`.

```javascript
// Load from lib folder relative to script
load(__DIR__ + "lib/log.js");
load(__DIR__ + "lib/swtImports.js");
load(__DIR__ + "lib/resolveSelection.js");
```

### Important Notes

- `__DIR__` includes a trailing path separator
- Files loaded with `load()` execute in global scope
- Loaded files typically expose variables to global scope or use module patterns
- Order matters - load dependencies before files that use them

### Available Library Modules

| Module | Path | Purpose |
|--------|------|---------|
| log | `lib/log.js` | Color-coded console logging (header, info, detail, success, warn, error) |
| swtImports | `lib/swtImports.js` | SWT/JFace Java type imports |
| resolveSelection | `lib/resolveSelection.js` | Selection and view resolution |
| requireModel | `lib/requireModel.js` | Ensure a model is open before proceeding |

### Using Loaded Modules

After loading, modules expose their exports as globals:

```javascript
// Load the module
load(__DIR__ + "lib/swtImports.js");

// Access exports from the global
const { SWT, GridDataFactory, TitleAreaDialog } = swtImports;

// Or access directly
const display = swtImports.Display.getCurrent();
```

---

## Java Interoperability

### Importing Java Classes

Use `Java.type()` to import Java classes:

```javascript
// SWT and JFace classes
const SWT = Java.type("org.eclipse.swt.SWT");
const GridDataFactory = Java.type("org.eclipse.jface.layout.GridDataFactory");
const TitleAreaDialog = Java.type("org.eclipse.jface.dialogs.TitleAreaDialog");
const Composite = Java.type("org.eclipse.swt.widgets.Composite");
const Label = Java.type("org.eclipse.swt.widgets.Label");
const Button = Java.type("org.eclipse.swt.widgets.Button");
const Text = Java.type("org.eclipse.swt.widgets.Text");

// Or use the swtImports module (recommended)
load(__DIR__ + "lib/swtImports.js");
const { SWT, GridDataFactory, Label, Button, Text } = swtImports;
```

### Extending Java Classes

Use `Java.extend()` to create JavaScript objects that extend Java classes:

```javascript
const TitleAreaDialog = Java.type("org.eclipse.jface.dialogs.TitleAreaDialog");
const ExtendedDialog = Java.extend(TitleAreaDialog);

// Create instance with method overrides
const dialog = new ExtendedDialog(shell, {
    createDialogArea: function(parent) {
        // Override implementation
    }
});
```

### Calling Superclass Methods (CRITICAL)

**This is the most common source of errors.**

❌ **WRONG** - `Java.super(this)` does NOT work in GraalVM:
```javascript
// THIS WILL FAIL
const dialog = new ExtendedDialog(shell, {
    configureShell: function(newShell) {
        Java.super(this).configureShell(newShell);  // BROKEN!
    }
});
```

✅ **CORRECT** - Store dialog in object and reference it:
```javascript
const myDialog = {
    dialog: new ExtendedDialog(shell, {
        configureShell: function(newShell) {
            Java.super(myDialog.dialog).configureShell(newShell);  // WORKS!
            newShell.setText("Title");
        },
        createDialogArea: function(parent) {
            const area = Java.super(myDialog.dialog).createDialogArea(parent);
            // Build UI here
            return area;
        }
    }),
    open: function() {
        return this.dialog.open() === 0;  // OK = 0
    }
};
```

---

## Creating Dialogs with Java.extend

Dialogs are created by extending JFace's `TitleAreaDialog` using `Java.extend()`. The key pattern is to store the dialog instance in an object so `Java.super()` can reference it.

### Basic Dialog

```javascript
load(__DIR__ + "lib/swtImports.js");

const { SWT, Label, Text, GridDataFactory, TitleAreaDialog } = swtImports;
const ExtendedDialog = Java.extend(TitleAreaDialog);

var userName = "";

var myDialog = {
    dialog: new ExtendedDialog(shell, {
        configureShell: function(newShell) {
            Java.super(myDialog.dialog).configureShell(newShell);
            newShell.setText("User Input");
        },
        isResizable: function() {
            return true;
        },
        getShellStyle: function() {
            return SWT.CLOSE | SWT.TITLE | SWT.BORDER | SWT.APPLICATION_MODAL | SWT.RESIZE | SWT.MAX;
        },
        createDialogArea: function(parent) {
            var area = Java.super(myDialog.dialog).createDialogArea(parent);
            myDialog.dialog.setMessage("Please enter your name:");

            var text = new Text(area, SWT.BORDER);
            GridDataFactory.fillDefaults().grab(true, false).applyTo(text);
            myDialog._nameText = text;

            return area;
        },
        okPressed: function() {
            userName = myDialog._nameText.getText().trim();
            if (userName === "") {
                myDialog.dialog.setErrorMessage("Name cannot be empty");
                return;  // Don't close
            }
            Java.super(myDialog.dialog).okPressed();
        }
    })
};

if (myDialog.dialog.open() === 0) {  // OK = 0
    log.info("Hello, " + userName);
}
```

### Confirmation Dialog

Use `window.confirm()` for simple yes/no prompts:

```javascript
if (window.confirm("Are you sure you want to delete this item?")) {
    // User confirmed
    performDelete();
}
```

### Simple Input Dialog

Use `window.prompt()` for single-value input:

```javascript
var name = window.prompt("Enter element name:", "Default Name");
if (name) {
    log.info("Creating: " + name);
}
```

---

## Working with the ArchiMate Model

### Accessing Model Elements

```javascript
// Get current model
const currentModel = $.model;

// Get selected elements (works from model tree AND view canvas)
load(__DIR__ + "lib/resolveSelection.js");
const selectedElements = resolveSelection.selectedConcepts("element");

// Get the active view (menu context → selection → active editor)
const currentView = resolveSelection.activeView();

// Find all elements of a type
const allBusinessProcesses = $("business-process");

// Find by name
const element = $("element").filter(e => e.name === "Customer");
```

### Working with Views

```javascript
// Get all views
const views = $("archimate-diagram-model");

// Get elements in a view
$(view).children().each(function(child) {
    if (child.concept) {
        console.log("Element: " + child.concept.name);
    }
});

// Find visual objects for a concept
const visualRefs = $(element).viewRefs();
```

### Creating Elements

```javascript
// Create a new element
const newProcess = model.createElement("business-process", "My Process");
newProcess.documentation = "Process documentation";

// Add to a folder
const folder = $("folder").filter(f => f.name === "Business").first();
folder.add(newProcess);
```

### Creating Relationships

```javascript
// Create a relationship
const rel = model.createRelationship("serving-relationship", source, target);
rel.name = "Serves";

// Add to view
const viewRef = view.add(rel, sourceView, targetView);
```

### Handling Unnamed Elements

Always handle potentially empty names:

```javascript
const displayName = element.name && element.name.trim() 
    ? element.name 
    : "-- unnamed --";
```

---

## Adding Scripts to the Menu System

### Create the Script File

Create your script in `scripts/Your Script.ajs` following the template. Use **Title Case with spaces** for filenames (e.g., `ELK Layout.ajs`, `Find Unused Elements.ajs`).

### Registration

Create a JSON registry entry in `scripts/registry/<kebab-case-name>.json` to make the script appear in the Menu launcher. The registry defines metadata (title, description, category, tags), selection requirements, danger level, and optional help file path. See existing registry files for examples.

### Categories

Use existing categories when possible:
- `Analysis` - Scripts that analyze model content
- `Layout` - Scripts that arrange views
- `Export` - Scripts that export data
- `Utilities` - General-purpose tools
- `Cleanup` - Scripts that remove or reset content
- `Editing` - Scripts that modify elements or properties

---

## Documentation Requirements

### JSDoc Header

Every script file must have a JSDoc header:

```javascript
/**
 * @name Script Name
 * @description What the script does
 * @version 1.0.0
 * @author Your Name
 * @lastModifiedDate YYYY-MM-DD
 */
```

### Library Modules

Library modules (in `lib/`) need module-level JSDoc:

```javascript
/**
 * @module moduleName
 * @description What this module provides
 * @version 1.0.0
 * @author Your Name
 * @since JArchi 1.0
 * @lastModifiedDate YYYY-MM-DD
 */
```

### Help Files for Complex Scripts

Scripts with significant UI complexity should have an extended help file in `scripts/help/`. Create a help file when any of these apply:

- The script presents a **dialog with multiple tabs or panels**
- The script has **5+ configurable options**
- The script produces **results that need interpretation** (tables, reports)
- The script has **non-obvious behavior** that benefits from explanation

**File location:** `scripts/help/<kebab-case-name>.md` (matching the registry filename)

**Help file template:**

```markdown
# Script Title

One-paragraph overview of what the script does.

## Requirements

- What must be open/selected before running

## Usage

1. Step-by-step instructions
2. ...

## Dialog Reference (or Table Columns)

Describe each tab, column, or interactive element.

## Tips

- Practical advice for getting the best results
```

**Linking to the registry:** Set `help.markdown_path` in the script's registry JSON to the path relative to `scripts/`:

```json
"help": {
    "markdown_path": "../help/elk-layout.md"
}
```

See existing help files in `scripts/help/` for examples.

### Functions

Document significant functions:

```javascript
/**
 * Process the selected elements and return results
 * @param {Object[]} elements - Array of ArchiMate elements
 * @param {Object} options - Processing options
 * @param {boolean} options.recursive - Whether to process recursively
 * @returns {Object[]} Processed results
 */
function processElements(elements, options) {
    // ...
}
```

---

## Common Pitfalls and Solutions

### Pitfall 1: Using `require()` Instead of `load()`

❌ **Wrong:**
```javascript
const utils = require("./lib/utils.js");  // Node.js style - FAILS
```

✅ **Correct:**
```javascript
load(__DIR__ + "lib/utils.js");  // JArchi style
```

### Pitfall 2: Using `Java.super(this)`

❌ **Wrong:**
```javascript
Java.super(this).configureShell(newShell);  // FAILS in GraalVM
```

✅ **Correct:**
```javascript
Java.super(myDialog.dialog).configureShell(newShell);  // Reference stored object
```

### Pitfall 3: Multiple Arguments to `console.error()`

❌ **Wrong:**
```javascript
console.error("Error:", error, "in function", funcName);  // May fail
```

✅ **Correct:**
```javascript
console.error("Error: " + error.toString() + " in function " + funcName);
```

### Pitfall 4: Not Handling Empty Names

❌ **Wrong:**
```javascript
const name = element.name;  // May be null or empty
label.setText(name);
```

✅ **Correct:**
```javascript
const name = element.name && element.name.trim() ? element.name : "-- unnamed --";
label.setText(name);
```

### Pitfall 5: Forgetting to Dispose Resources

❌ **Wrong:**
```javascript
const color = new Color(display, 255, 0, 0);
// Using color...
// Forgot to dispose!
```

✅ **Correct:**
```javascript
const color = new Color(display, 255, 0, 0);
try {
    // Using color...
} finally {
    color.dispose();
}
```

### Pitfall 6: Not Resolving View Correctly

❌ **Wrong:**
```javascript
const view = $(selection).filter("archimate-diagram-model").first();
// Fails when user selected elements on a view, or has a view open but selected in tree
```

✅ **Correct:**
```javascript
load(__DIR__ + "lib/resolveSelection.js");
const view = resolveSelection.activeView();
if (!view) {
    window.alert("Please select or open a view first.");
    return;
}
```

### Pitfall 7: Non-Resizable Dialogs

`isResizable()` alone does **not** make dialogs resizable in GraalJS. The `Java.extend` proxy may not dispatch the `isResizable()` override correctly during the Java-side `Dialog.create()` call chain, so the shell is created without `SWT.RESIZE` flags.

❌ **Wrong:**
```javascript
var myDialog = {
    dialog: new ExtendedDialog(shell, {
        isResizable: function() { return true; },  // Not sufficient!
        // ...
    })
};
```

✅ **Correct — override both `isResizable` and `getShellStyle`:**
```javascript
var myDialog = {
    dialog: new ExtendedDialog(shell, {
        isResizable: function() {
            return true;
        },
        getShellStyle: function() {
            return SWT.CLOSE | SWT.TITLE | SWT.BORDER | SWT.APPLICATION_MODAL | SWT.RESIZE | SWT.MAX;
        },
        // ...
    })
};
```

`getShellStyle()` is called by `Window.createShell()` when constructing the shell, so overriding it reliably sets the resize and maximize flags regardless of `isResizable()` dispatch.

### Pitfall 8: Path Separator Issues

❌ **Wrong:**
```javascript
load(__DIR__ + "/lib/utils.js");  // Double separator on Windows
```

✅ **Correct:**
```javascript
load(__DIR__ + "lib/utils.js");  // __DIR__ already has trailing separator
```

---

## Testing Scripts in Archi

### Basic Testing Workflow

1. **Open Archi** with a test model
2. **Open Scripts window**: Window → JArchi Scripts
3. **Navigate to your script** in the scripts folder
4. **Double-click** to run (or right-click → Run)
5. **Check Console** for errors: Window → Console

### Debugging Tips

1. **Add logging statements:**
   ```javascript
   console.log("DEBUG: variable = " + JSON.stringify(variable));
   ```

2. **Use Chrome DevTools** (JArchi 1.9+):
   - Start Archi with debugging enabled
   - Connect Chrome to `chrome://inspect`

3. **Test incrementally:**
   - Test small sections of code
   - Add try-catch blocks around new code
   - Verify each step works before moving on

---

## Migration Checklist

When migrating a legacy script to use modern patterns:

- [ ] Add proper JSDoc header with all required fields
- [ ] Add `console.clear(); console.show();` at start
- [ ] Load `lib/log.js` and use `log.header()` / `log.success()` / `log.error()`
- [ ] Wrap main code in IIFE with `"use strict"`
- [ ] Replace inline `Java.type()` calls with `swtImports` module
- [ ] Use `Java.extend()` + `myDialog` object pattern for dialogs (see Section 5)
- [ ] Add try-catch error handling with `error.stack` logging
- [ ] Use `resolveSelection` for view and element selection (never `$(selection).filter("archimate-diagram-model")`)
- [ ] Handle empty element names properly
- [ ] Create a registry entry in `scripts/registry/`
- [ ] Test in Archi

---

## Complete Script Example

Here's a complete working script following all conventions:

```javascript
/**
 * @name Element Counter
 * @description Counts elements by type in the current view or model
 * @version 1.0.0
 * @author Coding Agent
 * @lastModifiedDate 2026-02-14
 */

console.clear();
console.show();

// Load dependencies
load(__DIR__ + "lib/log.js");
load(__DIR__ + "lib/swtImports.js");
load(__DIR__ + "lib/resolveSelection.js");

(function () {
    "use strict";

    var { SWT, Table, TableColumn, TableItem, GridDataFactory, TitleAreaDialog } = swtImports;
    var ExtendedDialog = Java.extend(TitleAreaDialog);

    try {
        log.header("Element Counter");

        // Get current view or use full model
        var currentView = resolveSelection.activeView();
        var scope = currentView ? $(currentView).children("element") : $("element");

        if (scope.size() === 0) {
            window.alert("No elements found.");
            return;
        }

        // Count elements by type
        var counts = {};
        scope.each(function (item) {
            var concept = item.concept || item;
            var typeName = concept.type || "unknown";
            counts[typeName] = (counts[typeName] || 0) + 1;
        });

        // Sort by count descending
        var sorted = Object.entries(counts).sort(function (a, b) { return b[1] - a[1]; });

        // Create results dialog
        var myDialog = {
            dialog: new ExtendedDialog(shell, {
                configureShell: function (newShell) {
                    Java.super(myDialog.dialog).configureShell(newShell);
                    newShell.setText("Element Counter Results");
                },
                isResizable: function () {
                    return true;
                },
                getShellStyle: function () {
                    return SWT.CLOSE | SWT.TITLE | SWT.BORDER | SWT.APPLICATION_MODAL | SWT.RESIZE | SWT.MAX;
                },
                createDialogArea: function (parent) {
                    var area = Java.super(myDialog.dialog).createDialogArea(parent);
                    myDialog.dialog.setMessage(
                        currentView ? "Elements in view: " + currentView.name : "Elements in model"
                    );

                    // Create table
                    var table = new Table(area, SWT.BORDER | SWT.FULL_SELECTION);
                    table.setHeaderVisible(true);
                    table.setLinesVisible(true);
                    GridDataFactory.fillDefaults().grab(true, true).applyTo(table);

                    // Add columns
                    var typeCol = new TableColumn(table, SWT.NONE);
                    typeCol.setText("Element Type");
                    typeCol.setWidth(300);

                    var countCol = new TableColumn(table, SWT.RIGHT);
                    countCol.setText("Count");
                    countCol.setWidth(100);

                    // Add rows
                    sorted.forEach(function (entry) {
                        var item = new TableItem(table, SWT.NONE);
                        item.setText(0, entry[0]);
                        item.setText(1, String(entry[1]));
                    });

                    return area;
                }
            })
        };

        myDialog.dialog.setHelpAvailable(false);
        myDialog.dialog.open();
        log.success("Element Counter complete.");

    } catch (error) {
        log.error("Script failed: " + error.toString());
        if (error.stack) log.error(error.stack);
        window.alert("Error: " + error.message);
    }
})();
```

---

## Quick Reference Card

| Task | Pattern |
|------|---------|
| Load a library | `load(__DIR__ + "lib/filename.js");` |
| Import Java class | `var Cls = Java.type("full.class.Name");` |
| Use swtImports | `var { SWT, Label } = swtImports;` |
| Create dialog | `Java.extend(TitleAreaDialog)` + `myDialog` object pattern (see Section 5) |
| Get selected elements | `resolveSelection.selectedConcepts("element")` (load `lib/resolveSelection.js` first) |
| Get current view | `resolveSelection.activeView()` (load `lib/resolveSelection.js` first) |
| Get model | `$.model` or `model` |
| Handle empty name | `name && name.trim() ? name : "-- unnamed --"` |
| Log header | `log.header("Script Name");` |
| Log message | `log.info("message");` |
| Log success | `log.success("Done.");` |
| Log error | `log.error("Failed: " + error.toString());` |
| Show alert | `window.alert("message");` |
| Confirm dialog | `window.confirm("Are you sure?")` |

---

*Last updated: 2026-02-14*
