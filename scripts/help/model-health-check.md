# Model Health Check

Runs five health checks on the entire model and displays the results in a tabbed dialog with sortable tables. This is a read-only analysis script — it does not modify the model.

## Requirements

- An open ArchiMate model

## Usage

1. Run the script from the menu (no selection needed)
2. Review the summary banner showing issue counts per check
3. Click through the tabs to see detailed results for each check
4. **Double-click** any row to navigate to the object (see below)
5. Click column headers to sort
6. Click **Close** when done

## Health Checks

### 1. Unnamed Elements

Elements with an empty or blank name. These may be placeholders or accidentally created elements that should be named or removed.

| Column | Description |
|---|---|
| **Type** | The ArchiMate element type |
| **ID** | The element's unique identifier |

### 2. Missing Documentation

Elements that have no documentation set. Useful for enforcing documentation standards across the model.

| Column | Description |
|---|---|
| **Type** | The ArchiMate element type |
| **Name** | The element's display name |
| **ID** | The element's unique identifier |

### 3. Unused Elements

Elements not placed on any view in the model. These are candidates for cleanup or may need to be added to a diagram.

| Column | Description |
|---|---|
| **Type** | The ArchiMate element type |
| **Name** | The element's display name |
| **ID** | The element's unique identifier |

### 4. Empty Views

Views that contain zero diagram objects. These may be stubs or accidentally created views.

| Column | Description |
|---|---|
| **Type** | The view type |
| **Name** | The view's display name |
| **ID** | The view's unique identifier |

### 5. Duplicate Elements

Elements of the same type with the same normalized name (case-insensitive). Duplicates may indicate accidental double-creation or a need to merge elements.

| Column | Description |
|---|---|
| **Type** | The ArchiMate element type |
| **Name** | The element's display name |
| **Count** | How many elements share this type + name |
| **ID** | The element's unique identifier |

## Dialog Reference

### Summary Banner

The dialog header shows:

> 5 checks completed — N issues found

Below the header, a summary line shows per-check counts:

> Unnamed: N | Missing Docs: N | Unused: N | Empty Views: N | Duplicates: N

### Tab Labels

Each tab label includes its issue count in parentheses for quick reference:

> Unnamed (12), Missing Docs (45), Unused (3), Empty Views (0), Duplicates (8)

Tabs with 0 issues show a "No issues found." label instead of a table.

### Double-Click Navigation

Double-click any row to navigate to the object:
- **Empty Views** tab: opens the view in the editor
- **All other tabs**: selects and reveals the element in the model tree

### Sorting

- Click a column header to sort by that column
- Click the same header again to reverse the sort direction
- Default sort is alphabetical ascending by the first column

## Tips

- Run this script periodically as a quality gate before publishing or sharing your model.
- The **Unnamed** and **Unused** checks are the quickest wins — unnamed elements are almost always errors, and unused elements clutter the model.
- Use **Find Unused Elements** for a more detailed view of unused elements (with relationship counts and folder paths).
- Use **Find Duplicate Elements** for a dedicated duplicate analysis with merge capabilities.
- The **Missing Documentation** check is most useful for models with documentation standards — expect high counts in early-stage models.
