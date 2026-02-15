# Model Sync

CSV/JSON upsert with full dry-run preview. Imports elements and relationships from CSV or JSON files, matching against existing model elements using a deterministic cascade (ID > external key > name+type). Supports create-only, create+update, and create+update+delete modes. All changes are previewed in a tabbed dry-run dialog before any modifications are applied.

## Requirements

- An open ArchiMate model
- A CSV or JSON file with elements and/or relationships

## Usage

1. Run the script from the menu
2. Select a CSV or JSON file to sync
3. Configure sync in the configuration dialog:
   - **Sync mode**: Create Only, Create + Update, or Create + Update + Delete
   - **External key property**: Optional property name for matching (e.g., `cmdb-id`)
   - **Name+type fallback**: Enable/disable name+type matching
4. Click **Generate Dry Run** to preview changes
5. Review the dry-run results in the tabbed dialog:
   - **Summary** shows file, mode, and reconciliation counts
   - **To Create** lists new elements to be added
   - **To Update** shows elements with detected changes
   - **To Delete** (delete mode only) shows elements to remove
   - **Ambiguous** lists records that matched multiple elements
   - **Skipped** shows records that match existing elements with no changes
6. Double-click any row with an ID to reveal the element in the model tree
7. Click **Export Dry Run CSV** to save the preview as a report
8. Click **Apply Changes...** to execute (with confirmation dialog)
9. A sync report CSV is automatically saved next to the input file

## Sync Modes

| Mode | Description |
|---|---|
| **Create Only** | Only creates new elements. Never modifies or deletes existing elements. Safest mode. |
| **Create + Update** | Creates new elements and updates existing matched elements with changed values. Default mode. |
| **Create + Update + Delete** | Full sync: creates, updates, and deletes elements not found in the input file. Delete is scoped to element types present in the input. |

## Matching Cascade

Elements are matched in strict order. Once a match is found, no further matching is attempted:

| Priority | Method | Behavior |
|---|---|---|
| 1 | **By ID** | Definitive match if the element ID exists in the model |
| 2 | **By external key** | Matches on a configurable property value (e.g., `cmdb-id`). Definitive. |
| 3 | **By name+type** | Opt-in only. Single match = tentative (with warning). Multiple matches = ambiguous (skipped). |

Ambiguous matches (2+ elements with the same name and type) are **never auto-applied**. They appear in the Ambiguous tab for manual review.

## CSV Format

### Element CSV

Compatible with the format produced by "Export View to CSV":

```csv
Name,Type,ID,Documentation
My Service,application-service,abc-123,Handles requests
New Component,application-component,,A new element
```

Extended properties use `ext:` prefix columns:

```csv
Name,Type,ID,Documentation,ext:owner,ext:status
My Service,application-service,abc-123,,Team A,Active
```

### Relationship CSV

```csv
Source,Source ID,Type,Target,Target ID,Name,ID
My Service,abc-123,serving-relationship,My Component,def-456,,
```

## JSON Format

```json
{
    "format": "archimate-sync",
    "version": "1.0",
    "elements": [
        {
            "id": "abc-123",
            "name": "My Service",
            "type": "application-service",
            "documentation": "Handles requests",
            "properties": {
                "owner": "Team A",
                "status": "Active"
            }
        }
    ],
    "relationships": [
        {
            "id": "rel-001",
            "type": "serving-relationship",
            "name": "",
            "sourceId": "abc-123",
            "sourceName": "My Service",
            "targetId": "def-456",
            "targetName": "My Component"
        }
    ]
}
```

## Delete Mode Safety

Delete mode only targets element types present in the input file. For example, if your CSV only contains `application-component` elements, only `application-component` elements not in the file will be candidates for deletion.

Each delete candidate shows:
- **Views**: Number of views containing the element (red highlight if > 0)
- **Relationships**: Number of relationships connected to the element

Elements with view references are highlighted in red as a warning.

## Results Tabs

### Summary

Overview including file name, sync mode, matching configuration, and a reconciliation line showing how input records map to actions.

### To Create

| Column | Description |
|---|---|
| **Row** | Source file row number |
| **Name** | Element name |
| **Type** | ArchiMate element type |
| **Properties** | Extended property keys being set |

### To Update

| Column | Description |
|---|---|
| **Row** | Source file row number |
| **Name** | Current element name in model |
| **Type** | ArchiMate element type |
| **Matched By** | How the match was determined (ID, External Key, Name+Type) |
| **Changes** | Field-level diff (e.g., name: Old -> New) |
| **ID** | Element identifier |

### To Delete

| Column | Description |
|---|---|
| **Name** | Element name |
| **Type** | ArchiMate element type |
| **Views** | Number of view references (red if > 0) |
| **Relationships** | Number of connected relationships |
| **ID** | Element identifier |

### Ambiguous

| Column | Description |
|---|---|
| **Row** | Source file row number |
| **Name** | Input record name |
| **Type** | Input record type |
| **Match Count** | Number of matching elements in model |
| **Candidates** | List of matching element names and IDs |

### Skipped

| Column | Description |
|---|---|
| **Row** | Source file row number |
| **Name** | Input record name |
| **Type** | Input record type |
| **Matched By** | How the existing element was matched |
| **ID** | Matched element ID |

## Sync Report

After applying changes, a report CSV is automatically saved next to the input file with the naming pattern `{inputName}_sync_report_{timestamp}.csv`. This report includes every row's outcome (created, updated, deleted, skipped, failed) with element IDs for audit trailing.

## Rollback

- Use **Ctrl+Z** (Edit > Undo) in Archi to undo model operations
- The sync report CSV serves as an audit trail with all element IDs
- Delete mode reports include deleted element details for manual re-creation
- **Always save your model before running sync** as a safety measure

## Relationship Processing

Relationships are processed **after** elements. This ensures that newly created elements have IDs available for source/target resolution. Relationship matching uses:

1. ID match (definitive)
2. Key match (source ID + type + target ID + name)

Relationships with unresolvable source or target endpoints appear in the Ambiguous tab.

## Tips

- Start with **Create Only** mode to test your file format
- Use **Create + Update** for routine synchronization
- Reserve **Create + Update + Delete** for full inventory reconciliation
- Always review the dry-run preview carefully before applying
- Use external key properties for reliable matching across systems
- Export a view to CSV first to see the expected format
- Save your model before running sync in delete mode
- Use the sync report CSV for change tracking and auditing
