# Where Used

Shows which views contain the selected element(s). Lists every view reference for each selected element, making it easy to find where an element appears across the model. This is a read-only analysis script — it does not modify the model.

## Requirements

- An open ArchiMate model
- One or more elements selected (in the model tree or on a view)

## Usage

1. Select one or more elements in the model tree or on a view canvas
2. Run the script from the menu
3. Review the results table showing which views each element appears on
4. **Double-click** any row to open the view in the editor
5. Click column headers to sort
6. Click **Close** when done

If no elements are selected, an alert dialog prompts you to select elements first.

## Dialog Reference

### Summary Banner

The dialog header shows:

> *N* element(s) found on *N* view(s)

### Table Columns

| Column | Description |
|---|---|
| **Element** | The element's display name (shows "(unnamed)" for elements without a name) |
| **Element Type** | The ArchiMate element type |
| **View** | The name of the view containing the element (shows "(not on any view)" if the element has no view references) |
| **View Type** | The type of the containing view |

### Elements Not on Any View

If a selected element is not placed on any view, it appears as a single row with the View column showing "(not on any view)" and an empty View Type. Double-click is disabled for these rows.

### Double-Click Navigation

Double-click any row to open the referenced view in the Archi editor. This navigates directly to the view where the element is used.

### Sorting

- Click a column header to sort by that column
- Click the same header again to reverse the sort direction
- Default sort is alphabetical ascending by Element name

### Footer

A summary label shows the total row count and a reminder about double-click navigation and column sorting.

## Tips

- Use this script to understand the impact of changing or deleting an element — if it appears on many views, changes will have a wider effect.
- Select multiple elements at once (using Ctrl+click or Shift+click in the model tree) to check view references for a batch of elements in a single run.
- Elements shown as "(not on any view)" are candidates for cleanup — consider using **Find Unused Elements** for a more detailed view of all unused elements.
- Combine with **Element Usage Map** for a visual overview of element usage across the model.
