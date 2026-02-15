# Find Duplicate Elements

Scans the model for elements that share the same name and type, displaying groups of duplicates to help identify candidates for merging.

## Requirements

- An open ArchiMate model

## Usage

1. Run the script from the menu (no selection needed)
2. Review duplicate groups in the table
3. **Double-click** any row to reveal the element in the model tree
4. Click column headers to sort
5. Click **Close** when done

If no duplicates are found, an information dialog is shown instead.

## How Detection Works

Two elements are considered duplicates when they have:
- The **same ArchiMate type** (e.g., both are `business-process`)
- The **same name** (case-insensitive comparison)

Elements with empty or whitespace-only names are **skipped** -- they are not included in duplicate detection.

## Dialog Reference

### Summary Banner

The dialog header shows:

> *N* group(s) of duplicates (*N* elements total)

### Table Columns

| Column | Description |
|---|---|
| **Type** | The ArchiMate element type |
| **Name** | The element's display name |
| **Copies** | How many elements share this name+type combination |
| **Views** | Number of views this specific element appears on |
| **Rels** | Number of relationships connected to this element |
| **ID** | The element's unique Archi identifier |

### Visual Grouping

Rows belonging to the same duplicate group share an alternating background color. When the table is sorted by Type or Name, rows in the same group appear adjacent with a tinted background, making it easy to distinguish groups visually.

### Sorting

- Click a column header to sort by that column
- Click the same header again to reverse the sort direction
- Numeric columns (Copies, Views, Rels) sort descending by default
- Text columns (Type, Name, ID) sort ascending by default

### Double-Click Navigation

Double-click any row to select and reveal the element in the model tree. This is useful for inspecting a specific duplicate before deciding which copy to keep.

### Footer

A summary label shows the total number of duplicate groups and a reminder about double-click navigation and column sorting.

## Interpreting Results

When deciding which duplicate to keep:

- **Higher Views count** = the element is used on more diagrams. Keeping this one avoids having to update multiple views.
- **Higher Rels count** = the element has more relationships. Keeping this one preserves more of the model's semantic structure.
- **ID** can help identify which element was created first (useful for traceability).

## Tips

- After identifying duplicates, you can manually merge them in Archi by moving relationships and view references from one element to the other, then deleting the unused copy.
- Run this script periodically as a model hygiene check, especially in models maintained by multiple people.
- If you see many duplicates of the same type, consider establishing naming conventions for your team.
- Case differences (e.g., "Customer" vs "customer") will be flagged as duplicates since matching is case-insensitive.
