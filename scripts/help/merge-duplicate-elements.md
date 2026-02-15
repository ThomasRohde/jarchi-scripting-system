# Merge Duplicate Elements

Detects elements that share the same type and name, displays them in groups, and lets you merge duplicates into a single canonical element. Relationships, view references, properties, and documentation from duplicates are transferred to the canonical before the duplicates are deleted.

## Requirements

- An open ArchiMate model

## Usage

1. Run the script from the menu (no selection needed)
2. Review the duplicate groups in the table
3. **Click** a row to set it as the canonical element for its group (marked with a checkmark and bold font)
4. **Double-click** any row to reveal the element in the model tree for inspection
5. Configure merge options (property merge policy, documentation delimiter)
6. Click **Merge...** to see a dry-run preview
7. Confirm the preview to execute the merge, or cancel to abort

If no duplicates are found, an information dialog is shown instead.

## How Detection Works

Two elements are considered duplicates when they have:
- The **same ArchiMate type** (e.g., both are `business-process`)
- The **same name** (case-insensitive, trimmed)

Elements with empty or whitespace-only names are **skipped**.

Within each group, the element with the most view references is pre-selected as the canonical (tiebreaker: most relationships).

## Dialog Reference

### Summary Banner

The dialog header shows:

> *N* duplicate group(s) found (*N* elements). Select canonical element per group, then merge.

### Table Columns

| Column | Description |
|---|---|
| **(checkmark)** | Shows **\u2713** for the current canonical element in each group |
| **Type** | The ArchiMate element type |
| **Name** | The element's display name |
| **Views** | Number of views this element appears on |
| **Rels** | Number of relationships connected to this element |
| **Folder** | Folder path where the element lives in the model tree |
| **ID** | The element's unique Archi identifier |

### Visual Grouping

Rows belonging to the same duplicate group share an alternating background color. The canonical element in each group is displayed in **bold**.

### Selecting the Canonical

Click any row to make it the canonical for its group. All other members of the group will be merged into the canonical when you proceed. The default canonical is the element with the most view references.

### Merge Options

| Option | Values | Description |
|---|---|---|
| **Property merge** | Fill missing (default) | Copies properties from duplicates only if the canonical lacks that property |
| | Canonical wins | Keeps all canonical properties unchanged; ignores duplicate properties |
| **Doc delimiter** | --- (horizontal rule, default) | Separator inserted between canonical and duplicate documentation |
| | Empty line | Uses a blank line as separator |
| | No append | Does not merge documentation from duplicates |

### Double-Click Navigation

Double-click any row to select and reveal the element in the model tree. This lets you inspect elements before deciding which to keep as canonical.

## Merge Operations

When you click **Merge...**, the script performs these steps in order:

1. **Dry-run preview** — Shows a summary of all planned changes (relationships to rewire, view references to reassign, properties to merge, documentation to append, elements to delete). No changes are made yet.
2. **Confirmation** — You must explicitly confirm before any changes are applied.
3. **Execute** — For each duplicate group:
   - Rewires all relationships from duplicates to point to/from the canonical
   - Reassigns view object concept references so diagram appearances now show the canonical
   - Merges properties according to the selected policy
   - Appends documentation with the chosen delimiter
   - Deletes the duplicate element
4. **Summary** — Displays final statistics of all operations performed.

## Interpreting the Preview

The dry-run preview shows:

| Metric | Meaning |
|---|---|
| **Groups to merge** | Number of duplicate groups being processed |
| **Duplicates to remove** | Total elements that will be deleted |
| **Relationships to rewire** | Relationships whose source or target will be changed to the canonical |
| **View references to reassign** | Diagram objects that will now point to the canonical element |
| **Properties to merge** | Property values that will be copied to canonical elements |
| **Documentation segments to append** | Unique documentation blocks that will be appended |

## Tips

- Run **Find Duplicate Elements** first to review duplicates without risk before using this merge script.
- Elements with the **most views and relationships** are pre-selected as canonical — this minimizes the number of references that need rewiring.
- The merge is irreversible once confirmed. Save your model beforehand or use Archi's undo if available.
- After merging, run **Model Health Check** to verify model integrity.
- If you see many duplicate groups, consider merging in batches by running the script multiple times.
- Case differences (e.g., "Customer" vs "customer") are treated as duplicates since matching is case-insensitive.
