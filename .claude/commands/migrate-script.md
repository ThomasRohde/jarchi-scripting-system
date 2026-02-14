---
description: Migrate JArchi scripts from a GitHub repo into this project
argument-hint: <github-url> [branch]
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, AskUserQuestion
---

Migrate JArchi scripts from an external GitHub repository into this project, transforming them to match project conventions. This is NOT a copy — it is a full integration.

Load the **migrate-script** skill for transformation rules, registry schema, and vendor system details.

## Instructions

### Step 1: Parse Arguments and Clone

Extract the GitHub URL from `$ARGUMENTS`. If a branch is specified as the second argument, use it; otherwise clone the default branch.

Clone to a temporary directory:

```
git clone --depth 1 [--branch <branch>] <url> /tmp/jarchi-migrate-<timestamp>
```

If cloning fails, report the error and stop.

### Step 2: Discover Scripts

Scan the cloned repository for:
- `.ajs` files (top-level scripts)
- `lib/` or similar directories with `.js` helper/library files
- `package.json` (for npm dependencies)
- Any README or documentation describing the scripts

Read each `.ajs` file to understand its purpose. Build a dependency map: which scripts load which library files.

### Step 3: Interactive Selection

Present the discovered scripts to the user using AskUserQuestion. For each script, show:
- Filename and brief description (from JSDoc header or first few lines)
- Dependencies it requires
- Whether it needs npm packages

Let the user choose which scripts to migrate (use `multiSelect: true`).

### Step 4: Analyze Compatibility

For each selected script, read it thoroughly and identify:

1. **Dependencies**: What files does it `load()` or `require()`? Which are local libraries vs npm packages?
2. **SWT/JFace usage**: Does it import Java types that are already in `swtImports`?
3. **Dialog patterns**: Does it use `Java.extend(TitleAreaDialog)` or similar?
4. **Model access**: Does it use `model` or `$.model`?
5. **Node.js-isms**: `require()` for local files, `fs` module, `process`, etc.
6. **Selection requirements**: Does it need elements, views, or relationships selected?
7. **Danger level**: Does it modify the model, or is it read-only?

Check if equivalent functionality already exists in this project by scanning existing scripts and registry entries.

Report findings to the user before proceeding with transformation. If there are conflicts with existing scripts, ask the user how to handle them.

### Step 5: Transform and Write

For each selected script, apply the transformation rules from the migrate-script skill:

1. **Rename** the file to Title Case with spaces and place in `scripts/`
2. **Add JSDoc header** with `@name`, `@description`, `@version 1.0.0`, `@author Thomas Rohde`, `@lastModifiedDate` (today)
3. **Add template wrapper**: `console.clear(); console.show();`, load deps, IIFE, try-catch
4. **Replace logging**: `console.log` → `log.info/detail`, `console.error` → `log.error`, add `log.header()` and `log.success()`
5. **Replace SWT imports**: individual `Java.type()` → `swtImports` destructuring
6. **Fix dialog patterns**: `Java.super(this)` → object-wrapper pattern, add `setHelpAvailable(false)`
7. **Add model guard**: `requireModel()` if script accesses the model
8. **Use resolveSelection**: Replace `$(selection).filter("archimate-diagram-model")` with `resolveSelection.activeView()`
9. **Fix element names**: Add null/empty checks around `element.name`
10. **Convert library files** to dual-export IIFE pattern with double-load guard, place in `scripts/lib/`

Write each transformed file using the Write tool.

### Step 6: Handle npm Dependencies

If any selected scripts use npm packages:

1. Check if the package is already vendored in `scripts/vendor/`
2. If not already vendored:
   - Add the package to `package.json` using `npm install <package> --save`
   - Add a copy entry to `VENDOR_MODULES` in `build/vendor.js`
   - Create a GraalJS wrapper in `scripts/vendor/<package>/` if the package needs environment shims
   - Run `npm install && npm run vendor`
3. Update the script's `load()` calls to reference the vendored location

### Step 7: Create Registry Entries

For each migrated top-level script, create a registry JSON file in `scripts/registry/`:

- **Filename**: kebab-case matching the script name (e.g., `my-script.json`)
- **id**: `category.snake_case_name`
- **title**: Same as the script filename without `.ajs`
- **category**: Choose from Analysis, Layout, Export, Utilities, Model
- **script.path**: The `.ajs` filename
- **description**: One-line description
- **tags**: Relevant keywords
- **danger_level**: `low` (read-only), `medium` (modifies view), `high` (modifies model)
- **selection**: Set types, min, require_view based on analysis

Consult `references/registry-schema.md` in the migrate-script skill for the full schema.

### Step 7a: Create Help Files for Complex Scripts

For migrated scripts that have significant UI complexity (multi-tab dialogs, 5+ configurable options, results that need interpretation), create a help file:

1. Create `scripts/help/<kebab-case-name>.md` using the template from `context/Script Development Guide for Agents.md` Section 8 "Help Files for Complex Scripts"
2. Set `help.markdown_path` in the registry entry to point to the help file (e.g., `"../help/elk-layout.md"`)
3. Include: overview, requirements, usage steps, dialog/table reference, and tips

### Step 8: Clean Up

Remove the temporary clone directory:

```
rm -rf /tmp/jarchi-migrate-<timestamp>
```

### Step 9: Summary

Report to the user:
- List of migrated scripts with their new filenames and categories
- List of library modules added to `scripts/lib/`
- Any npm packages added and vendored
- Registry entries created
- Help files created (if any)
- Any manual steps needed (e.g., testing in Archi, adjusting selection rules)
- Conflicts or issues encountered

## Important Reminders

- Always read source files before transforming — never guess at content
- Use the jarchi-scripting skill for any questions about project conventions
- Check for naming conflicts with existing scripts in `scripts/` and existing IDs in `scripts/registry/`
- Do not overwrite existing project files without asking the user
- Test that `load()` paths are correct: `__DIR__` has a trailing separator, so use `load(__DIR__ + "lib/foo.js")` not `load(__DIR__ + "/lib/foo.js")`
