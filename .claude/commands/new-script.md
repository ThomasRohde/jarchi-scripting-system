---
description: Scaffold a new JArchi top-level .ajs script
argument-hint: [script-name]
allowed-tools: Read, Write, Glob, AskUserQuestion
---

Create a new JArchi top-level script file following the project conventions.

## Instructions

1. Determine the script name from `$ARGUMENTS`. If no name was provided, use the AskUserQuestion tool to ask for a script name and brief description.

2. Convert the script name to a suitable filename:
   - Use **Title Case with spaces** for the `.ajs` filename (e.g., "element counter" becomes `Element Counter.ajs`, "ELK layout" becomes `ELK Layout.ajs`)
   - Place it in the `scripts/` directory

3. Ask what the script should do if not already clear from the name.

4. Generate the script file using this exact template structure:

```javascript
/**
 * @name [Script Name]
 * @description [Brief description]
 * @version 1.0.0
 * @author [user or "Author"]
 * @lastModifiedDate [today's date YYYY-MM-DD]
 */

console.clear();
console.show();

// Load dependencies
load(__DIR__ + "lib/log.js");

(function () {
    "use strict";

    try {
        log.header("[Script Name]");

        // Main script logic here

        log.success("[Script Name] complete.");
    } catch (error) {
        log.error("Script failed: " + error.toString());
        if (error.stack) log.error(error.stack);
        window.alert("Error: " + error.message);
    }
})();
```

5. Adapt the template based on what the script needs:
   - If it uses UI dialogs, add `load(__DIR__ + "lib/swtImports.js");` and use `Java.extend(TitleAreaDialog)` with the `myDialog` object pattern (see `context/Script Development Guide for Agents.md` Section 5)
   - If it works with model elements, add selection checks and the `$()` collection API
   - If it needs a view, add `load(__DIR__ + "lib/resolveSelection.js");` and use `resolveSelection.activeView()` — never use `$(selection).filter("archimate-diagram-model")`
   - If it needs the model to be open, add `load(__DIR__ + "lib/requireModel.js");` and call `requireModel()` at the start of the IIFE
   - Add only the dependencies actually needed

6. Follow these critical JArchi conventions:
   - Use `load()` not `require()` for local files
   - `__DIR__` already has a trailing separator — do NOT add a leading `/`
   - Use `"use strict"` inside the IIFE
   - Concatenate strings with `+` for `console.error()` — no comma-separated arguments
   - Handle potentially null element names: `name && name.trim() ? name : "-- unnamed --"`
   - Dispose SWT graphics resources (Color, Font, Image) in a `finally` block

7. **Create a registry entry** in `scripts/registry/<kebab-case-name>.json` so the script appears in the Menu system. Follow the schema in `.claude/skills/migrate-script/references/registry-schema.md`. Key fields:
   - `id`: `category.snake_case_name` (e.g., `analysis.element_counter`)
   - `title`: matches the script name
   - `category`: one of `["Analysis"]`, `["Layout"]`, `["Export"]`, `["Editing"]`, `["Cleanup"]`, `["Utilities"]`
   - `script.path`: the `.ajs` filename
   - `danger_level`: `"low"` (read-only), `"medium"` (modifies view/layout), `"high"` (modifies model)

8. **Help file for complex scripts**: If the script has a multi-tab dialog, 5+ configurable options, or produces results that need interpretation, create a help file at `scripts/help/<kebab-case-name>.md`. Use the template from `context/Script Development Guide for Agents.md` Section 8 "Help Files for Complex Scripts". Set `help.markdown_path` in the registry entry (e.g., `"../help/elk-layout.md"`).

9. Write the files and confirm what was created.
