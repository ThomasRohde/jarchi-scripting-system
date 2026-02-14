# Registry Schema Reference

Complete documentation for script registry JSON files in `scripts/registry/`.

## Overview

Each script that appears in the menu system has a corresponding JSON file in `scripts/registry/`. The registry scanner (`scripts/lib/menu/registryScanner.js`) reads these files, validates required fields, fills defaults for optional fields, and produces normalized `ScriptDescriptor` objects.

## File Naming

Registry files use **kebab-case** matching the script's logical name:

| Script File | Registry File |
|---|---|
| `Find Unused Elements.ajs` | `find-unused-elements.json` |
| `ELK Layout.ajs` | `elk-layout.json` |
| `Export View to CSV.ajs` | `export-view-to-csv.json` |

## Schema

```json
{
  "id": "string (required)",
  "title": "string (required)",
  "category": ["string"] ,
  "order": 10,

  "script": {
    "path": "string (required)"
  },

  "description": "string",
  "tags": ["string"],

  "help": {
    "markdown_path": "string"
  },

  "run": {
    "danger_level": "low | medium | high",
    "confirm_message": "string"
  },

  "selection": {
    "types": ["string"],
    "min": 0,
    "require_view": false
  }
}
```

## Required Fields

### id

Unique identifier using `category.snake_case_name` format.

Examples:
- `analysis.find_unused_elements`
- `layout.elk_graph_layout`
- `export.view_to_csv`
- `utilities.copy_to_clipboard`
- `cleanup.delete_unused_elements`

The category prefix should match the primary category. The scanner rejects duplicate IDs.

### title

Human-readable title displayed in the menu. Should match the script filename without the `.ajs` extension.

Examples: `"Find Unused Elements"`, `"ELK Graph Layout"`, `"Export View to CSV"`

### category

Array of category strings. Currently, use a single-element array with one of:

| Category | When to Use |
|---|---|
| `"Analysis"` | Scripts that examine model content without modifying it |
| `"Layout"` | Scripts that arrange or position elements on views |
| `"Export"` | Scripts that export data to files or clipboard |
| `"Editing"` | Scripts that modify element properties, names, or visual appearance |
| `"Cleanup"` | Scripts that remove or clean up model content |
| `"Utilities"` | General-purpose tools (server, batch operations, etc.) |

### script.path

Relative path to the `.ajs` file from `scripts/`. The scanner validates that this file exists.

Example: `"Find Unused Elements.ajs"`

## Optional Fields

### order

Sort order within the category. Lower numbers appear first. Default: `100`.

Use `10` for primary scripts, `20-30` for secondary, `100` for the rest.

### description

One-line description of what the script does. Shown in the menu's detail panel.

Example: `"Scans the model for elements not placed on any view. Lists orphaned elements grouped by type, helping identify candidates for cleanup."`

### tags

Array of lowercase keyword strings for search/filtering.

Example: `["analysis", "unused", "orphan", "cleanup", "model-health"]`

### help.markdown_path

Path to a markdown file with extended documentation, relative to `scripts/`. Leave as `""` for simple scripts that don't need extended help.

**When to create a help file:**
- The script has a dialog with multiple tabs or panels
- The script has 5+ configurable options
- The script produces results that need interpretation (tables, reports)
- The script has non-obvious behavior that benefits from explanation

**File location:** `scripts/help/<kebab-case-name>.md` (matching the registry filename).

**Example:** `"../help/elk-layout.md"` for a file at `scripts/help/elk-layout.md`.

See `scripts/help/` for existing examples and `context/Script Development Guide for Agents.md` Section 8 for the help file template.

### run.danger_level

Risk classification:
- `"low"` — read-only operations (default)
- `"medium"` — modifies view layout or visual properties
- `"high"` — creates, modifies, or deletes model elements/relationships

### run.confirm_message

Custom confirmation prompt shown before running high-danger scripts. Leave as `""` for no confirmation.

### selection.types

Array of required selection types. The selection gating system checks these before allowing the script to run.

Valid types:
- `"element"` — matches model elements and diagram objects
- `"relationship"` — matches relationships and diagram connections
- `"view"` — matches diagram model views
- `"folder"` — matches model folders
- `"diagram-object"` — matches only visual diagram objects
- `"diagram-connection"` — matches only visual connections

Empty array `[]` means no type requirement.

### selection.min

Minimum number of matching selection items required. Default: `0`.

Use `1` for scripts that operate on "at least one selected element", `0` for scripts that work on the whole model.

### selection.require_view

Whether an active view (open or selected) is required. Default: `false`.

Set to `true` for layout scripts or scripts that operate on view contents.

## Examples

### Read-only analysis script (no selection needed)

```json
{
  "id": "analysis.model_statistics",
  "title": "Model Statistics",
  "category": ["Analysis"],
  "order": 10,
  "script": { "path": "Model Statistics.ajs" },
  "description": "Displays counts of elements, relationships, and views grouped by type.",
  "tags": ["analysis", "statistics", "count", "overview"],
  "help": { "markdown_path": "" },
  "run": { "danger_level": "low", "confirm_message": "" },
  "selection": { "types": [], "min": 0, "require_view": false }
}
```

### View-dependent layout script

```json
{
  "id": "layout.elk_graph_layout",
  "title": "ELK Graph Layout",
  "category": ["Layout"],
  "order": 10,
  "script": { "path": "ELK Layout.ajs" },
  "description": "Automatic graph layout using the ELK engine.",
  "tags": ["layout", "elk", "auto-layout", "graph"],
  "help": { "markdown_path": "" },
  "run": { "danger_level": "medium", "confirm_message": "" },
  "selection": { "types": ["view"], "min": 0, "require_view": true }
}
```

### Destructive cleanup operation

```json
{
  "id": "cleanup.delete_unused_elements",
  "title": "Delete Unused Elements",
  "category": ["Cleanup"],
  "order": 10,
  "script": { "path": "Delete Unused Elements.ajs" },
  "description": "Finds and deletes elements not placed on any view, along with their relationships.",
  "tags": ["cleanup", "delete", "unused", "orphan", "model-health"],
  "help": { "markdown_path": "" },
  "run": { "danger_level": "high", "confirm_message": "This will permanently delete unused elements and their relationships." },
  "selection": { "types": [], "min": 0, "require_view": false }
}
```

### Element-dependent editing script

```json
{
  "id": "editing.rename_elements",
  "title": "Rename Elements",
  "category": ["Editing"],
  "order": 10,
  "script": { "path": "Rename Elements.ajs" },
  "description": "Bulk find-and-replace in element names. Works on selected elements or all elements.",
  "tags": ["editing", "rename", "find-replace", "bulk", "names"],
  "help": { "markdown_path": "" },
  "run": { "danger_level": "medium", "confirm_message": "" },
  "selection": { "types": ["element"], "min": 0, "require_view": false }
}
```
