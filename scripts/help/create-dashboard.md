# Create Dashboard

Creates a new view containing all 12 available chart templates arranged in a symmetric 4-column by 3-row grid layout. Automatically initializes missing data properties with random values on matching model elements and renders every chart.

## Requirements

- An open ArchiMate model with elements (the more elements, the richer the charts)

## Usage

1. Run the script from the menu
2. Enter a name for the dashboard view (default: "EA Dashboard")
3. The script will:
   - Initialize random values for any missing chart data properties
   - Create a new view with the given name
   - Place all 12 chart templates as notes in a grid
   - Render each chart to a PNG image
   - Open the dashboard view

## Dashboard Layout

The dashboard arranges charts in three logical rows:

### Row 1 — Overview (no custom properties needed)

| Chart | Type | Description |
|---|---|---|
| **Element Distribution** | Doughnut | Model elements by ArchiMate type |
| **Architecture Layer Balance** | Polar Area | Elements across architectural layers |
| **Relationship Complexity** | Horizontal Bar | Top 15 elements by relationship count |
| **View Coverage** | Horizontal Bar | Top 20 elements by view appearances |

### Row 2 — Application Analysis

| Chart | Type | Key Properties |
|---|---|---|
| **Technical Debt Distribution** | Bar | `technical-debt` on application-components |
| **Application Portfolio** | Bubble | `business-value`, `technical-quality`, `annual-cost` |
| **Risk Assessment Matrix** | Scatter | `risk-impact`, `risk-likelihood` |
| **Lifecycle by Category** | Stacked Bar | `department`, `lifecycle-status` |

### Row 3 — Technology & Capability

| Chart | Type | Key Properties |
|---|---|---|
| **Technology Lifecycle** | Bar | `lifecycle-status` on technology elements |
| **Technology Stack Composition** | Stacked Bar | `technology-category`, `lifecycle-status` |
| **Capability Maturity** | Radar | `maturity-current`, `maturity-target` on capabilities |
| **Maturity Trend** | Line | `maturity-current`, `maturity-target` on capabilities |

## Random Data Initialization

For charts that require custom properties, the script checks each matching element. If a required property is not set, it assigns a random value:

| Property | Random Values |
|---|---|
| `technical-debt` | low, medium, high, critical |
| `lifecycle-status` | emerging, current, sunset, retired |
| `business-value` | 1–5 |
| `technical-quality` | 1–5 |
| `annual-cost` | 50–500 |
| `maturity-current` | 1–4 |
| `maturity-target` | 3–5 |
| `department` | IT, Finance, HR, Operations, Marketing |
| `risk-impact` | 1–5 |
| `risk-likelihood` | 1–5 |
| `technology-category` | Infrastructure, Middleware, Database, Security, DevOps |

Existing property values are never overwritten.

## Tips

- Run the script multiple times to create dashboards with different random data distributions
- After creating the dashboard, edit individual element properties to reflect real data, then run **Render Chart** on the dashboard view to update
- The dashboard charts use "Entire Model" scope — they analyze all elements in the model, not just those on the dashboard view
- To update a single chart, select its note on the dashboard and run **Render Chart**
- Chart notes can be resized or repositioned after creation without affecting the rendered image
