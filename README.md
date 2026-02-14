# JArchi Scripting System

A comprehensive scripting toolkit for [Archi](https://www.archimatetool.com/) — the open-source ArchiMate modeling tool. Provides a menu-driven launcher, automatic graph layout, a REST API server, model analysis tools, and a library of reusable modules, all powered by the [jArchi](https://www.archimatetool.com/plugins/) scripting plugin.

Built for AI-assisted development with [Claude Code](https://claude.ai/code) — custom skills and slash commands let you describe what you need in plain language and get production-ready JArchi scripts that follow all project conventions.

## Requirements

- [Archi](https://www.archimatetool.com/) 5.7 or later
- [jArchi plugin](https://www.archimatetool.com/plugins/) 1.11 or later
- [Node.js](https://nodejs.org/) (only for the build step that vendors npm packages)
- [Claude Code](https://claude.ai/code) (optional, for AI-assisted development)

## Installation

1. **Clone the repository** into your Archi scripts directory:

   ```bash
   git clone https://github.com/ThomasRohde/jarchi-scripting-system.git
   ```

2. **Install dependencies and vendor them** into the scripts directory:

   ```bash
   cd jarchi-scripting-system
   npm install
   ```

   This runs `npm install` followed by the `postinstall` vendor script, which copies required npm packages (ELK, dagre, marked) into `scripts/vendor/` with GraalJS-compatible wrappers.

3. **Point Archi to the scripts folder.** In Archi, go to *Edit > Preferences > Scripting* and set the scripts directory to the `scripts/` folder inside this repository.

4. **Run the Menu script** (`scripts/Menu.ajs`) to access all scripts through a searchable launcher dialog.

## Developing with Claude Code

This project is designed for AI-assisted development. Open it in [Claude Code](https://claude.ai/code) and use the built-in skills and slash commands to create, migrate, and extend scripts without needing to learn the full JArchi API or project conventions manually.

### Slash Commands

Slash commands are the fastest way to scaffold new project components:

| Command | Description |
|---------|-------------|
| `/new-script [name]` | Scaffold a complete top-level `.ajs` script with IIFE wrapper, try-catch, logging, and a registry entry for the menu system |
| `/new-library [name]` | Scaffold a library module in `lib/` with the dual-export pattern (global + CommonJS), double-load guard, and JSDoc header |
| `/migrate-script <github-url>` | Clone an external repository, analyze its scripts, interactively select which to import, and transform them to match all project conventions |

**Examples:**

```
/new-script Element Counter
/new-library colorUtils
/migrate-script https://github.com/someone/jarchi-scripts
```

### Skills

Skills provide deep domain knowledge that Claude Code draws on automatically when relevant. You don't invoke them directly — they activate when you ask about their topic.

**jarchi-scripting** — The primary skill for all script development. Covers:
- GraalVM GraalJS runtime constraints and ECMAScript 2024 features
- jArchi `$()` collection API for model traversal
- Java interop via `Java.type()` and `Java.extend()`
- SWT/JFace dialog creation (TitleAreaDialog, widgets, layouts)
- Project conventions: IIFE template, `log` module, `load()` dependencies, selection resolver
- ArchiMate element types, relationships, and view semantics

**migrate-script** — Activated when importing external scripts. Covers:
- Transformation rules (rename files, rewrite logging, replace SWT imports, fix dialog patterns)
- Dependency mapping and the vendor system for npm packages
- Registry entry creation and help file scaffolding
- Compatibility analysis between source scripts and project libraries

### What You Can Ask

Just describe what you need in natural language:

- *"Write a script that finds all elements with no documentation and lists them by type"*
- *"Create a dialog that lets me pick a property name and set it on all selected elements"*
- *"Add an ELK layout option for radial tree with configurable radius"*
- *"Migrate the scripts from https://github.com/example/archi-tools"*
- *"Build a library module that converts between color formats"*

Claude Code will use the project's skills and context files to generate code that follows all conventions — correct template structure, proper `load()` imports, SWT widget patterns, error handling, registry entries, and more.

## Features

- **Script Menu** — searchable launcher with category tree, fuzzy search, detail pane, and Markdown help browser
- **ELK Graph Layout** — automatic diagram layout with 5 algorithms (Layered, Stress, Force, MrTree, Radial), configurable options, and saveable templates
- **Model API Server** — HTTP REST API for external model access with undo support, async plan/apply pattern, and a live monitor dialog
- **Analysis & Cleanup** — model statistics, find unused/duplicate elements, element usage maps, bulk deletion
- **Export** — clipboard copy (tab-delimited for Excel), CSV export from views
- **Editing** — bulk rename with regex, batch property setting, visual appearance reset
- **Shared Libraries** — selection resolver, SWT/JFace imports, color-coded logging, model validation

### Included Scripts

| Category | Scripts |
|----------|---------|
| **Analysis** | Model Statistics, Find Unused Elements, Find Duplicate Elements, Element Usage Map, Where Used |
| **Layout** | ELK Graph Layout (5 algorithms with full options dialog) |
| **Export** | Copy to Clipboard, Export View to CSV |
| **Editing** | Rename Elements, Set Property, Reset Visual Appearance |
| **Cleanup** | Delete Unused Elements |
| **Utilities** | Model API Server |

All scripts are accessible through the **Menu** launcher (`Menu.ajs`), which provides category browsing, fuzzy search, and inline help.

## Architecture

```
scripts/
  *.ajs                  Top-level scripts (Title Case names)
  help/                  Extended help docs for complex scripts (.md)
  lib/                   Shared library modules
    menu/                Menu system (dialog, search, registry scanner)
    server/              API server (endpoints, queue, undo, monitor UI)
  registry/              Script metadata (JSON, one per script)
  vendor/                Vendored npm packages with GraalJS wrappers
build/
  vendor.js              Copies npm packages into scripts/vendor/
context/                 Reference docs (ArchiMate spec, jArchi API, GraalJS)
.claude/
  commands/              Slash commands (/new-script, /new-library, /migrate-script)
  skills/                Domain knowledge (jarchi-scripting, migrate-script)
```

### Runtime

Scripts run in **GraalVM GraalJS (ECMAScript 2024)**, not Node.js. The jArchi plugin provides:

- **`$`** — jQuery-like collection API for ArchiMate model traversal
- **`model`** — the currently open ArchiMate model
- **`selection`** — currently selected objects
- **`shell`** — SWT Shell for dialog creation
- **`__DIR__`** — directory of the currently executing script
- **`Java.type()`** / **`Java.extend()`** — full Java interop

### Vendor System

npm packages cannot be loaded directly in GraalJS. The vendor system bridges this:

1. Dependencies are declared in `package.json`
2. `build/vendor.js` copies specific files into `scripts/vendor/`
3. Wrapper scripts shim missing globals (`setTimeout`, `module`, `global`) for GraalJS compatibility
4. Scripts load vendored packages via `load(__DIR__ + "vendor/...")`

### Registry System

Each script has a JSON metadata file in `scripts/registry/` that declares its title, description, category, tags, selection requirements, and danger level. The menu system scans the registry at startup and presents scripts organized by category with fuzzy search.

## Model API Server

The Model API Server enables external tools and automations to interact with ArchiMate models:

```bash
curl http://localhost:8765/health
curl -X POST http://localhost:8765/model/search \
  -H "Content-Type: application/json" \
  -d '{"name": "Application"}'
```

**Key endpoints:** `/health`, `/model/query`, `/model/search`, `/model/plan`, `/model/apply`, `/views`, `/scripts/run`

All mutations are undoable (Ctrl+Z). Supports async plan/apply pattern and idempotency keys. Binds to localhost only — intended for local development and automation.

## Contributing

Contributions are welcome! The easiest way to contribute is to use Claude Code with this project's skills — it will enforce all conventions automatically. For manual contributions, follow:

- **Scripts**: Title Case filenames, IIFE wrapper, try-catch, `log` module for output
- **Libraries**: camelCase filenames, double-load guard, dual export (global + CommonJS)
- **Registry**: kebab-case JSON filenames, all required fields populated

## License

[MIT](LICENSE)
