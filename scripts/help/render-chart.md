# Render Chart

Renders chart images on note elements that contain chart definitions. For each chart note found, the script collects data from the model according to the definition, renders a Chart.js chart to PNG, and displays the image on the note.

## Requirements

- An open ArchiMate model
- An active (open) view containing one or more chart notes (created by **Create Chart Definition**)

## Usage

1. Open a view that contains chart notes
2. Optionally select specific chart notes to render (otherwise all chart notes on the view are rendered)
3. Run the script from the menu
4. The script processes each chart note:
   - Reads the `chart-definition` JSON property
   - Collects data from the model based on the definition
   - Renders the chart to a temporary PNG file
   - Sets the PNG as the note's image
5. Review the rendered charts on the view

## How It Works

### Chart Note Detection

The script identifies chart notes by scanning for `diagram-model-note` objects that have a `chart-definition` property. Regular notes without this property are ignored.

### Data Collection

Each chart definition specifies a data collection method:

| Method | Description |
|---|---|
| `property-distribution` | Counts elements grouped by a property value |
| `type-distribution` | Counts elements by their ArchiMate type |
| `relationship-count` | Counts relationships per element, ranks top N |
| `property-scatter` | Maps element properties to X/Y/R coordinates |
| `property-radar` | Maps element properties across radar axes |

### Scope

The data scope (model vs view) is determined by the chart definition:
- **Entire Model**: Queries all matching elements in the model
- **Current View**: Only includes elements that appear on the active view

### Rendering

Charts are rendered server-side using Chart.js with a Java AWT canvas shim. The output is a standard PNG file stored in the system temp directory and loaded as the note's image.

## Rendering Behavior

| Scenario | Behavior |
|---|---|
| Selected chart notes | Only renders the selected notes |
| No selection | Renders all chart notes on the view |
| No chart notes found | Shows an alert message |
| Rendering fails for a note | Logs the error and continues with remaining notes |

## Tips

- Run this script whenever model data changes to refresh chart images
- Select individual chart notes to re-render just those charts
- The script produces PNG files in the system temp directory — they persist until the OS cleans them
- If a chart appears blank, check that the matching elements have the required properties set
- For property-based charts, ensure elements have the expected property values (run **Create Chart Definition** with "Initialize data properties" enabled if needed)
- Chart images survive model save/load — they are stored as note image references
- Create a dedicated "Dashboard" view with multiple chart notes for an at-a-glance overview
