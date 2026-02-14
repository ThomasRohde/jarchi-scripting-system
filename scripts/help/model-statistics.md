# Model Statistics

Displays a summary of all elements, relationships, and views in the current model, grouped by type with counts.

## Requirements

- An open ArchiMate model

## Usage

1. Run the script from the menu (no selection needed)
2. Review the statistics in the tabbed dialog
3. Click column headers to sort
4. Click **Close** when done

## Dialog Reference

### Summary Banner

The dialog header shows totals across all categories:

> *N* elements, *N* relationships, *N* views, *N* folders

### Tabs

The dialog has three tabs, each containing a sortable two-column table:

| Tab | Contents |
|---|---|
| **Elements (*N*)** | ArchiMate element types and their counts (e.g., Business Process: 12, Application Component: 8) |
| **Relationships (*N*)** | Relationship types and their counts (e.g., serving-relationship: 15, composition-relationship: 10) |
| **Views (*N*)** | View types and their counts (e.g., archimate-diagram-model: 5) |

The tab labels include the total count in parentheses for quick reference.

### Table Columns

Each table has two columns:

| Column | Description |
|---|---|
| **Type** | The ArchiMate type name |
| **Count** | Number of instances of that type |

### Sorting

- Click a column header to sort by that column
- Click the same header again to reverse the sort direction
- The sort indicator arrow shows the current sort column and direction
- **Type** column sorts alphabetically (ascending by default)
- **Count** column sorts numerically (descending by default)

## Tips

- Use this script as a quick health check for your model -- it gives an instant overview of model composition.
- Large counts for a single relationship type may indicate over-use of that relationship.
- If the Views tab shows only one view type, that is normal -- most models use only `archimate-diagram-model`.
- The folder count in the summary banner includes all model tree folders (element, relationship, view, and custom folders).
