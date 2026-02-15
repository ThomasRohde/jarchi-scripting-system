# Dependency Cycle Analyzer

Detects dependency cycles in ArchiMate models using Tarjan's strongly connected component (SCC) algorithm. Cycles indicate circular dependencies that can make architecture harder to maintain, deploy, and evolve. Results are presented in a tabbed dialog with sortable tables, double-click navigation, and CSV export.

## Requirements

- An open ArchiMate model with elements and relationships

## Usage

1. Run the script from the menu
2. Configure the analysis in the configuration dialog:
   - **Scope**: Entire Model, Selected Elements, or Layer Filter
   - **Relationship types**: Choose which relationship types to follow
   - **Generate view**: Optionally create a view showing the cycles
3. Click **Analyze** to run the detection
4. Review results in the tabbed dialog:
   - **Summary** tab shows graph size, cycle count, and per-cycle breakdown
   - **Cycles** tab lists all elements involved in cycles
   - **Cycle Paths** tab shows concrete circular paths
5. Double-click a row to reveal the element in the model tree
6. Click **Export CSV** to save a report file
7. Click **Generate View** to create a view (if enabled in config)
8. Click **Close** when done

## Scope Options

| Scope | Description |
|---|---|
| **Entire Model** | Analyzes all elements in the model |
| **Selected Elements** | Only considers the currently selected elements |
| **Layer Filter** | Filters elements by ArchiMate layer (checkboxes) |

## Relationship Types

Relationships are grouped into four categories:

| Group | Types |
|---|---|
| **Structural** | Composition, Aggregation, Assignment, Realization |
| **Dependency** | Serving, Access, Influence |
| **Dynamic** | Triggering, Flow |
| **Other** | Specialization, Association |

By default, Structural, Dependency, and Dynamic types are checked. Association and Specialization are unchecked as they are too generic for meaningful cycle detection.

## Impact Scoring

Each cycle is ranked by a composite impact score:

- **Element count** x 3 — larger cycles are harder to break
- **Edge count** x 1 — more relationships mean tighter coupling
- **Cross-layer count** x 5 — cycles spanning multiple layers are architecturally significant
- **Average degree** x 2 — highly connected elements increase risk

Higher scores indicate cycles that should be addressed first.

## Results Tabs

### Summary

Overview of the analysis including graph size, scope, relationship types used, and a per-cycle breakdown showing element count, relationship count, impact score, and layers involved.

### Cycles

Flat table with one row per element per cycle:

| Column | Description |
|---|---|
| **Cycle#** | Cycle number (sorted by impact) |
| **Impact** | Composite impact score for the cycle |
| **Element** | Element name |
| **Type** | ArchiMate element type |
| **Layer** | ArchiMate layer |
| **Connections** | Number of relationships within the cycle |
| **ID** | Element identifier |

### Cycle Paths

Concrete circular paths extracted from each cycle:

| Column | Description |
|---|---|
| **Cycle#** | Cycle number |
| **Path Length** | Number of relationships in the path |
| **Path** | Element names joined with arrows (e.g., A -> B -> C -> A) |
| **Layers Crossed** | Number of distinct layers in the path |

## CSV Export

The exported file `dependency_cycle_report.csv` contains columns: Cycle, Impact Score, Element, Type, Layer, Connections, Element ID, Path Example.

## View Generation

When enabled, creates a new view named `"Dependency Cycles (YYYY-MM-DD)"` with:

- Elements placed in a grid layout per cycle
- Color-coded by cycle (8-color palette)
- Internal relationships connected

## Tips

- Start with the default relationship types; add Association/Specialization only if needed
- Focus on high-impact cycles first — they represent the most tightly coupled areas
- Cross-layer cycles (e.g., Application -> Technology -> Application) often indicate architectural issues
- Use the Layer Filter scope to focus on specific layers
- Export CSV to share findings with your architecture review team
- Run after making structural changes to verify cycles have been broken
