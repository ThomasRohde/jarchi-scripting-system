# Roadmap Gap Scaffold Generator

Generates a complete migration planning scaffold with plateaus, gaps, work packages, deliverables, and implementation events. All elements are auto-linked with the correct ArchiMate relationships and optionally laid out on a roadmap view with color coding.

## Requirements

- An open ArchiMate model

## Usage

1. Run the script from the menu (no selection needed)
2. Enter a **project name** — used as prefix for all generated element names
3. Select a **template** (Gap Analysis or Migration Roadmap)
4. Configure element counts (for Migration Roadmap template)
5. Choose output options (view generation, color coding)
6. Review the preview count at the bottom of the dialog
7. Click **Generate** and confirm the creation summary
8. The scaffold is created and the roadmap view opens (if enabled)

## Templates

### Gap Analysis

Creates a minimal gap analysis scaffold:

| Elements Created | Count |
|---|---|
| Plateaus | 2 (Baseline + Target) |
| Gaps | 1 |
| **Total** | **3 elements, 2 relationships** |

Relationships: Gap is associated with both plateaus.

### Migration Roadmap

Creates a full migration planning scaffold with configurable counts:

| Elements Created | Description |
|---|---|
| Plateaus | Baseline + N transitions + Target |
| Gaps | One between each consecutive plateau pair |
| Work Packages | M per transition |
| Deliverables | K per work package |
| Implementation Events | 1 per transition (optional milestones) |

Relationships auto-linked:
- **Plateau chain**: triggering from Baseline through Transitions to Target
- **Gaps**: association to both adjacent plateaus
- **Work packages**: triggering chain within each transition (sequential)
- **WP to Deliverable**: realization
- **Deliverable to Plateau**: realization to the next plateau
- **Event to WP**: triggering from milestone to first work package of transition

## Dialog Reference

### Project Name

Text field used as prefix for all generated names. For example, with project name "ERP Modernization":
- Plateaus: "ERP Modernization Baseline", "ERP Modernization Target"
- Gaps: "ERP Modernization Gap: Baseline to Target"
- Work Packages: "ERP Modernization WP 1.1"

### Configuration (Migration Roadmap only)

| Field | Range | Default | Description |
|---|---|---|---|
| **Transition plateaus** | 0-5 | 1 | Intermediate stable states between baseline and target |
| **Work packages per transition** | 1-10 | 2 | Implementation activities per transition |
| **Deliverables per work package** | 0-5 | 1 | Outputs produced by each work package |
| **Include implementation events** | on/off | on | Milestone events before each transition |

These fields are disabled when the Gap Analysis template is selected.

### Output Options

| Option | Values | Description |
|---|---|---|
| **Generate roadmap view** | on/off (default on) | Creates an ArchiMate view with all elements laid out |
| **Color coding** | None, Migration Status (default) | Applies fill colors to view elements by role |

### Preview

The preview line at the bottom dynamically shows:

> Will create: N elements, M relationships

This updates whenever you change any setting.

## Color Coding: Migration Status

When enabled, view elements are colored by their role in the migration:

| Element Role | Color | Hex |
|---|---|---|
| Plateau (Baseline) | White | #FFFFFF |
| Plateau (Transition) | Gold | #FFD700 |
| Plateau (Target) | Light Green | #90EE90 |
| Gap | Light Salmon | #FFA07A |
| Work Package | Sky Blue | #87CEEB |
| Deliverable | Light Steel Blue | #B0C4DE |
| Implementation Event | Plum | #DDA0DD |

## View Layout

The generated view uses a column-based layout with time flowing left-to-right:

- **Row 1**: Plateaus across the top
- **Row 2**: Gaps between plateau columns
- **Row 3**: Implementation events (milestones)
- **Rows 4+**: Work packages stacked vertically per transition column
- **Below WPs**: Deliverables beneath their parent work packages

All relationships are drawn as connections between the visual elements.

## Tips

- Start with the **Gap Analysis** template for simple baseline-to-target comparisons, then graduate to **Migration Roadmap** for full planning.
- The generated elements are placed in the **Implementation & Migration** folder in the model tree.
- After generation, manually aggregate existing architecture elements into the plateaus to complete the gap analysis.
- You can run the script multiple times with different project names to create scaffolds for parallel migration streams.
- Edit generated element names and documentation to match your actual project terminology.
- Use **Color by Property** or **Reset Visual Appearance** scripts to adjust colors after generation.
