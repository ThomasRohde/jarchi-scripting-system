# Available Scripts

All scripts are located in `scripts/` and can be launched from the **Menu** (`Menu.ajs`).

## Launcher

| Script | Description |
|--------|-------------|
| **Menu** | Launcher UI for discovering, searching, and running JArchi scripts. Opens a dialog with a category tree, fuzzy search, details pane, and Markdown help browser. Scripts are registered via JSON files in the `registry/` directory. |

## Layout

| Script | Description |
|--------|-------------|
| **ELK Layout** | Automatic graph layout using the ELK (Eclipse Layout Kernel) engine. Provides a comprehensive options dialog for configuring layout algorithm, spacing, edge routing, port constraints, and more. Applies computed positions and bendpoints back to the active ArchiMate view. |

## Analysis

| Script | Description |
|--------|-------------|
| **Model Statistics** | Shows a summary of elements, relationships, and views grouped by type. Displays counts in a sortable table dialog. Works on the entire model. |
| **Model Health Check** | Runs a suite of health checks on the entire model and displays results in a tabbed dialog. Checks for unnamed elements, missing documentation, unused elements, empty views, and duplicate elements. |
| **Element Usage Map** | Shows where selected elements (or all elements) are used across views. For each element, lists every view that contains a visual reference. Useful for impact analysis before making changes. |
| **Where Used** | Shows which views contain the selected element(s). Lists every view reference for each selected element, making it easy to find where an element appears across the model. |
| **Find Unused Elements** | Scans the model for elements that are not placed on any view. Shows results in a sortable table dialog with type, name, relationships, and folder location. Helps identify candidates for cleanup. |
| **Find Duplicate Elements** | Scans the model for elements that share the same name and type. Displays groups of duplicates in a sortable table, helping identify candidates for merging. |
| **Relationship Compliance Checker** | Validates all relationships against the ArchiMate 3.1 specification matrix. Reports invalid relationships (errors) and weak modeling patterns (warnings) in a tabbed dialog with sortable tables, navigation, and CSV export. |
| **Strict Layer Violation Detector** | Detects cross-layer relationship violations based on a configurable layering policy. Reports prohibited direct links between non-adjacent ArchiMate layers with mediation suggestions. Results in a tabbed dialog with sortable tables, navigation, and CSV export. |
| **Dependency Cycle Analyzer** | Detects dependency cycles in ArchiMate models using Tarjan's SCC algorithm. Reports cycles with impact scoring, concrete cycle paths, and optional view generation. Configurable scope, layer filter, and relationship type selection. |
| **Impact Path Explorer** | Explores downstream and upstream dependency paths from selected elements using BFS traversal. Shows impacted endpoints, full paths, and optionally generates an impact analysis view. Requires element selection. |

## Visualization

| Script | Description |
|--------|-------------|
| **Color by Property** | Colors diagram objects on the active view based on a property value. Each unique property value gets a distinct color from a built-in palette. Double-click any row in the preview table to open a native color picker. |
| **Render Chart** | Renders chart images on note elements that have a `chart-definition` property. Collects data from the model, renders via Chart.js to PNG, and sets the image on the note. Processes selected notes or all chart notes on the view. |
| **Create Chart Definition** | Creates a chart definition on a note element in the active view. Opens a dialog to select from pre-defined EA chart templates, configure dimensions and scope, and optionally initialize data properties on matching model elements. |
| **Edit Chart Definition** | Edits an existing chart definition on a selected note element. Parses the stored chart-definition property, opens a dialog pre-populated with current settings (title, dimensions, scope, font, colors, visibility), and saves changes back to the note. Works on selected notes or lets you pick from all chart notes on the view. |
| **Create Dashboard** | Creates a new dashboard view with all 12 chart templates in a symmetric 4x3 grid. Initializes missing data properties with random values, creates sample elements for missing types, and renders all charts automatically. |
| **Tech Radar** | Renders a Thoughtworks-style Technology Radar as a native image on the active view. Scans model elements tagged with `tech-radar-ring` and `tech-radar-quadrant` properties and plots numbered blips across four rings (Adopt, Trial, Assess, Hold) and four quadrants with a colour-coded legend. |
| **Tech Radar Sample Data** | Creates 32 sample technology elements across four quadrants and four rings, then renders a Tech Radar on a new view. Useful for trying out the radar without tagging your own elements. |

## Editing

| Script | Description |
|--------|-------------|
| **Rename Elements** | Bulk find-and-replace in element names. Searches selected elements (or all elements if none selected) for a text pattern and replaces it. Supports plain text and optional regex matching. |

## Export / Import

| Script | Description |
|--------|-------------|
| **Copy to Clipboard** | Copies selected elements' information to the clipboard as tab-delimited text. The output can be pasted directly into Excel, Word, or other applications. Includes name, type, documentation, and properties. |
| **Export View to CSV** | Exports elements and relationships from the active view to a CSV file. Creates two CSV files: one for elements (name, type, documentation) and one for relationships (source, type, target, name). |
| **Import from CSV** | Imports elements and/or relationships from CSV files into the model. Accepts the same CSV format produced by "Export View to CSV". Auto-detects whether the file contains elements or relationships based on the header row. |

## Cleanup

| Script | Description |
|--------|-------------|
| **Delete Unused Elements** | Finds and deletes elements that are not placed on any view. Also removes relationships connected only to unused elements. Shows a confirmation dialog before deleting. |
| **Merge Duplicate Elements** | Detects duplicate elements (same type + normalized name), lets the user pick a canonical element per group, and merges relationships, view references, properties, and documentation from duplicates onto the canonical. Supports dry-run preview. |
| **Reset Visual Appearance** | Resets fill color, font color, font, and line color of selected diagram objects back to their default values. Works on the current selection in a view, or all objects in the active view if nothing is selected. |

## Planning

| Script | Description |
|--------|-------------|
| **Roadmap Gap Scaffold Generator** | Wizard-driven scaffold creation for migration planning: plateaus, gaps, work packages, deliverables, and implementation events with auto-linked relationships and optional roadmap view generation with color coding presets. |

## Utilities

| Script | Description |
|--------|-------------|
| **Set Property** | Batch-set a property on all selected elements. Prompts for property name and value, then applies to every selected element. Can also remove a property by leaving the value empty. |
| **Naming and Property Standards Enforcer** | Validates model elements against configurable naming, property, and documentation standards. Reports violations in a tabbed dialog with auto-fix suggestions for whitespace cleanup and default property values. Supports check-only and apply modes with CSV export. |
| **Model Sync** | CSV/JSON upsert with full dry-run preview. Imports elements and relationships, matching against existing model by ID, external key, or name+type. Supports create-only, create+update, and create+update+delete modes with confirmation and audit report generation. |

## Server

| Script | Description |
|--------|-------------|
| **Model API Server** | Production HTTP REST API server for ArchiMate models with undoable operations. Exposes endpoints for querying, searching, creating, and modifying model elements over HTTP (localhost:8765). Supports async plan/apply pattern and idempotency keys. |

## Codex

| Script | Description |
|--------|-------------|
| **Codex Chat** | Multi-turn chat dialog for conversing with Codex about the ArchiMate model. Supports streaming responses, slash commands (`/plan`, `/apply`, `/clear`, `/context`, `/model`, `/status`, `/help`), model/effort switching, and server configuration inspection via tabs. Requires `codex app-server --listen ws://127.0.0.1:19000` running. |
