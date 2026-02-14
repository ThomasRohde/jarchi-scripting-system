# ELK Graph Layout

Automatic graph layout using the **ELK (Eclipse Layout Kernel)** engine. Positions elements and routes connections on the active ArchiMate view using professional graph layout algorithms.

## Requirements

- An open ArchiMate model
- An active view with at least one element

## Usage

1. Open or select a view in Archi
2. Run the script from the menu
3. Configure layout options in the dialog
4. Click **Apply Layout** to position elements

The dialog remembers no state between runs, but you can save and load **templates** to preserve your preferred settings.

## Dialog Reference

### Template Bar

At the top of the dialog, a **Template** dropdown lets you apply saved configurations. Use **Save As...** to save the current settings as a named template, and **Manage...** to rename, reorder, or delete templates. Selecting "-- Custom --" means you are editing settings manually.

### Algorithm & Direction

Choose the layout algorithm and primary flow direction (Down, Up, Left, Right).

| Algorithm | Best For |
|---|---|
| **Layered (Sugiyama)** | Directed flows, hierarchies, process models. Organizes nodes in layers along the chosen direction. The default and most versatile choice for ArchiMate. |
| **Stress Minimization** | Undirected or loosely structured graphs. Produces aesthetically balanced layouts by minimizing edge length deviation. |
| **MrTree** | Tree-like structures with a clear root. Uses minimum spanning tree placement. |
| **Radial** | Hierarchies radiating from a center node. Arranges nodes in concentric circles. |
| **Force-Directed** | Organic, clustered layouts. Simulates physical forces (repulsion between nodes, spring-like edges). |

### Spacing Tab

Controls distances between layout elements:

| Setting | Description | Default |
|---|---|---|
| Node-Node | Minimum gap between adjacent nodes | 60 |
| Edge-Edge | Minimum gap between parallel edges | 15 |
| Edge-Node | Minimum gap between an edge and a non-adjacent node | 20 |
| Component-Component | Gap between disconnected subgraphs | 50 |
| Between Layers (nodes) | Distance between layers (Layered algorithm) | 80 |
| Between Layers (edge-node) | Edge-to-node gap between layers | 25 |
| Padding | Padding around the entire layout | 30 |

### Edges Tab

Configures connection routing and appearance:

| Setting | Options | Default |
|---|---|---|
| Edge Routing | Orthogonal, Polyline, Splines, Undefined | Orthogonal |
| Connection Style After Layout | Don't change, Straight, Orthogonal, Curved | Orthogonal |
| Merge parallel edges | Combine edges between the same node pair | Off |
| Separate disconnected components | Arrange unconnected subgraphs side by side | On |

### Ports Tab

Ports control where connections attach to elements. Each connection endpoint gets a dedicated port.

| Setting | Options | Default |
|---|---|---|
| Port Constraints | Free, Fixed Side, Fixed Order, Fixed Position, Fixed Ratio | Fixed Side |
| Port Alignment | Distributed, Begin, Center, End, Justified | Center |
| Port Side Assignment | By Direction (auto), By Relationship Type, None | By Direction |
| Port Spacing | Minimum gap between ports on the same side | 12 |

**Fixed Side** means ports are assigned to a side (N/S/E/W) but can slide along it. **Center** alignment produces the cleanest look for wide ArchiMate elements.

### Algorithm Tab

Shows settings specific to the selected algorithm. The panel switches dynamically when you change the algorithm.

**Layered options:**

| Setting | Options | Default |
|---|---|---|
| Layering Strategy | Network Simplex, Longest Path, Interactive, Minimize Width | Network Simplex |
| Node Placement | Brandes & Kopf, Linear Segments, Network Simplex, Simple | Network Simplex |
| Crossing Minimization | Layer Sweep, Interactive | Layer Sweep |
| Post-Compaction | None, Edge Length | None |
| Wrapping | None, Single Edge, Multi Edge | None |
| Handle feedback edges (cycles) | Enable cycle handling | On |

**Stress options:** Desired Edge Length (default 200), Iterations (default 300).

**Force options:** Iterations (default 300), Repulsive Power (default 0).

**MrTree options:** Weighting (Model Order / Constraint), Search Order (DFS / BFS).

**Radial:** No additional options.

### Options Tab

General output settings:

| Setting | Options | Default |
|---|---|---|
| Hierarchy | Flat (ignore nesting), Hierarchical (respect groups) | Flat |
| Aspect Ratio | Target width-to-height ratio (x10 in spinner) | 1.6 |
| Apply bendpoints | Write ELK edge routing as Archi bendpoints | On |
| Set view router to Manual | Switch view to manual connection routing | On |
| Preserve existing element sizes | Keep current element dimensions | On |

## Tips

- **Start with Layered (Sugiyama)** for most ArchiMate diagrams. It handles directed flows (serving, composition, assignment) naturally.
- **Use Stress Minimization** for collaboration or association-heavy views where there is no clear direction.
- **Increase Between Layers spacing** if elements feel cramped vertically (or horizontally for LEFT/RIGHT direction).
- **Turn off Apply Bendpoints** if you prefer straight-line connections after layout.
- **Hierarchical mode** respects group nesting but may produce wider layouts. Use Flat for simpler views.
- **Save a template** once you find settings you like -- it saves time on future views.
- The script sets the view connection router to **Manual** by default, which is required for bendpoints to display correctly.
