# Impact Path Explorer

Explores downstream and upstream dependency paths from selected seed elements using breadth-first search (BFS). Identifies all reachable endpoints within a configurable depth, showing how changes to selected elements might ripple through the architecture. Results are presented in a tabbed dialog with sortable tables, double-click navigation, and CSV export.

## Requirements

- An open ArchiMate model
- At least one element selected in the model tree or on a view

## Usage

1. Select one or more elements in the model tree or on a view canvas
2. Run the script from the menu
3. Configure the analysis in the configuration dialog:
   - Review the **seed elements** (read-only, from selection)
   - **Direction**: Downstream, Upstream, or Both
   - **Max depth**: 1-15 hops (default 5)
   - **Relationship types**: Choose which types to traverse
   - **Generate view**: Optionally create an impact view
4. Click **Explore** to run the analysis
5. Review results in the tabbed dialog:
   - **Summary** tab shows seeds, parameters, and top 10 most-impacted endpoints
   - **Endpoints** tab lists all reachable endpoints with path counts and depth range
   - **Paths** tab shows every individual path with relationship labels
6. Double-click a row to reveal the element in the model tree
7. Click **Export CSV** to save a report
8. Click **Generate View** to create a view (if enabled in config)
9. Click **Close** when done

## Direction Options

| Direction | Description |
|---|---|
| **Downstream** | Follow relationships outward from seeds (source to target). Answers: "What does this element affect?" |
| **Upstream** | Follow relationships inward to seeds (target to source). Answers: "What affects this element?" |
| **Both** | Explore in both directions. Gives the full dependency neighborhood. |

## Relationship Types

Relationships are grouped into four categories. By default, Influence, Specialization, and Association are unchecked:

| Group | Types | Default |
|---|---|---|
| **Structural** | Composition, Aggregation, Assignment, Realization | On |
| **Dependency** | Serving, Access, Influence | Serving and Access on; Influence off |
| **Dynamic** | Triggering, Flow | On |
| **Other** | Specialization, Association | Off |

## Results Tabs

### Summary

Overview including seed elements, direction, max depth, relationship types, total paths found, unique endpoints, and a ranked list of the top 10 most-impacted endpoints.

### Endpoints

Aggregated view of all reachable endpoints:

| Column | Description |
|---|---|
| **Element** | Endpoint element name |
| **Type** | ArchiMate element type |
| **Layer** | ArchiMate layer |
| **Paths** | Number of distinct paths reaching this endpoint |
| **Min Depth** | Shortest path length (hops) |
| **Max Depth** | Longest path length (hops) |
| **Direction** | Which direction(s) this endpoint was reached from |
| **ID** | Element identifier |

### Paths

Full list of individual paths with relationship labels:

| Column | Description |
|---|---|
| **Seed** | Starting element name |
| **Direction** | downstream or upstream |
| **Length** | Number of hops |
| **Path** | Full path with relationship labels (e.g., A -> [Serving] -> B -> [Flow] -> C) |
| **Endpoint** | Terminal element name |
| **Endpoint Type** | Terminal element type |

## CSV Export

The exported file `impact_paths.csv` contains columns: Seed, Direction, Length, Path, Endpoint, Endpoint Type, Endpoint Layer.

## View Generation

When enabled, creates a new view named `"Impact Analysis (YYYY-MM-DD)"` with:

- Elements placed in columns by depth (seeds at left)
- Seed elements highlighted in pink (`#FFE0E0`)
- Relationship connections from discovered paths

## Tips

- Start with downstream direction to understand what a change affects
- Use upstream to understand what an element depends on
- Keep max depth at 3-5 for focused analysis; increase for thorough exploration
- Elements with many paths are high-risk change points
- Disable Association and Specialization for cleaner dependency chains
- Use the path view to understand exactly how dependencies flow
- Export CSV to share impact analysis with stakeholders
- Select multiple seeds to analyze the combined impact of a planned change
