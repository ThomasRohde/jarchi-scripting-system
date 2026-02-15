# Create Chart Definition

Creates a chart definition stored as a JSON property on a note element in the active view. Select from 6 pre-defined EA-relevant chart templates, configure dimensions and scope, and optionally initialize data properties on matching model elements.

## Requirements

- An open ArchiMate model
- An active (open) view where the chart note will be placed

## Usage

1. Open a view where you want the chart to appear
2. Run the script from the menu
3. Select a **chart template** from the dropdown
4. Review the template description and properties it will create
5. Customize the **chart title**, **dimensions**, and **data scope**
6. Optionally enable **Initialize data properties** to set defaults on elements
7. Click **Create**
8. A note element appears on the view with the chart definition stored
9. Run **Render Chart** to generate the actual chart image

## Templates

### Technical Debt Distribution (Bar)

Counts `application-component` elements grouped by their `technical-debt` property value (low / medium / high / critical).

### Technology Lifecycle (Bar)

Counts technology-layer elements grouped by their `lifecycle-status` property value (emerging / current / sunset / retired).

### Application Portfolio (Bubble)

Plots `application-component` elements as bubbles:
- **X axis**: `business-value` (1-5)
- **Y axis**: `technical-quality` (1-5)
- **Bubble size**: `annual-cost` (numeric)

### Capability Maturity (Radar)

Compares current vs target maturity across `capability` elements:
- **Dataset 1**: `maturity-current` (1-5)
- **Dataset 2**: `maturity-target` (1-5)

### Element Distribution (Doughnut)

Counts all model elements by their ArchiMate type. No custom properties needed.

### Relationship Complexity (Horizontal Bar)

Shows the top 15 elements ranked by total relationship count (incoming + outgoing). No custom properties needed.

## Dialog Reference

### Template

Dropdown list of all available chart templates. Selecting a template updates the description, default title, dimensions, and property information.

### Chart Settings

| Field | Range | Description |
|---|---|---|
| **Chart Title** | Text | Title displayed on the chart and the note |
| **Width** | 200-2000 px | Chart image width in pixels |
| **Height** | 200-2000 px | Chart image height in pixels |
| **Scope** | Entire Model / Current View | Data collection scope |

### Data Properties

| Option | Description |
|---|---|
| **Initialize data properties** | When checked, sets default property values on matching elements that don't already have the property set |
| **Properties list** | Shows which properties the template will create |

Templates that don't require custom properties (Element Distribution, Relationship Complexity) have this option disabled.

## How Chart Definitions Work

The chart definition is stored as a JSON string in the `chart-definition` property of the note element. This JSON contains:

- Chart type (bar, doughnut, radar, bubble, etc.)
- Data source configuration (which elements, properties, and collection method)
- Chart.js rendering options (title, legend, scales, etc.)
- Color palette
- Dimensions

The **Render Chart** script reads this definition, collects data from the model, and renders it to a PNG image displayed on the note.

## Tips

- Start with **Element Distribution** or **Relationship Complexity** templates — they don't require custom properties and work with any model
- Use **Current View** scope to chart only elements that appear on the active view
- Property initialization only sets values where the property doesn't exist yet — it won't overwrite existing values
- You can manually edit the `chart-definition` property on the note to customize beyond what the dialog offers
- Place multiple chart notes on a single "dashboard" view, then run Render Chart to update them all at once
- Chart note dimensions on the view are independent of chart pixel dimensions — resize the note to fit your view layout
