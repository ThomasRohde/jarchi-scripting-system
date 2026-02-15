# Find Unused Elements

Scans the model for elements that are not placed on any view. Lists orphaned elements with their type, name, relationship count, and folder location to help identify candidates for cleanup.

## Requirements

- An open ArchiMate model

## Usage

1. Run the script from the menu (no selection needed)
2. Review unused elements in the table
3. **Double-click** any row to reveal the element in the model tree
4. Click column headers to sort
5. Click **Close** when done

If all elements appear on at least one view, an information dialog is shown instead.

## How Detection Works

An element is considered **unused** if it has zero view references -- it does not appear on any diagram in the model. The script checks every element using `$(element).viewRefs().size()`.

Elements that are unused AND have zero relationships are called **isolated** elements. These are highlighted in the summary banner and are the safest candidates for cleanup.

## Dialog Reference

### Summary Banner

The dialog header shows:

> *N* unused out of *N* total elements -- *N* fully isolated (no relationships)

The isolated count only appears if there are isolated elements.

### Table Columns

| Column | Description |
|---|---|
| **Type** | The ArchiMate element type |
| **Name** | The element's display name (shows "(unnamed)" for elements without a name) |
| **Rels** | Number of relationships connected to this element |
| **Folder** | The element's location in the model tree (e.g., "Business / Processes") |
| **ID** | The element's unique Archi identifier |

### Isolated Element Indicator

Elements with 0 relationships have their **Rels** column text displayed in gray, providing a visual cue that these elements are fully isolated (not on any view and not connected to anything).

### Sorting

- Click a column header to sort by that column
- Click the same header again to reverse the sort direction
- The Rels column sorts numerically; all other columns sort alphabetically
- Default sort is by Type ascending

### Double-Click Navigation

Double-click any row to select and reveal the element in the model tree. This makes it easy to inspect or delete individual elements without searching for them manually.

### Footer

A summary label shows the total element count and a reminder about double-click navigation and column sorting.

## Interpreting Results

| Scenario | Risk Level | Recommendation |
|---|---|---|
| **0 Rels, no views** (isolated) | Very low | Safe to delete -- the element has no connections or visual presence |
| **Has Rels, no views** | Medium | The element participates in relationships but isn't shown anywhere. It may be intentionally modeled but not yet placed on a view. |

## Tips

- **Start cleanup with isolated elements** (0 relationships) -- these have no impact on the model's semantic structure when removed.
- The **Folder** column helps locate elements in the model tree if you want to review them before deleting.
- Elements with relationships but no views may be candidates for a new view rather than deletion -- they represent modeled concepts that aren't yet visualized.
- Run this script after importing elements or merging models, as these operations often create orphaned elements.
- Use the companion script **Delete Unused Elements** to batch-remove unused elements after reviewing them here.
