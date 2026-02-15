# Import from CSV

Imports elements or relationships from a CSV file into the model. Designed as the inverse of **Export View to CSV** — it accepts the same CSV format.

## Requirements

- An open ArchiMate model

## Usage

1. Run the script from the menu
2. Select a CSV file using the file dialog
3. The script auto-detects whether the file contains elements or relationships
4. Review the summary of created, skipped, and failed items

## CSV Formats

### Element CSV

The script detects element format when the header starts with `Name,Type`:

```
Name,Type,ID,Documentation
Application Service,application-service,abc123,"Handles user requests"
Business Process,business-process,def456,"Core workflow"
```

| Column | Required | Description |
|---|---|---|
| **Name** | Yes | The element's display name |
| **Type** | Yes | ArchiMate type (e.g., `application-service`, `business-process`) |
| **ID** | No | Archi element ID — used for duplicate detection |
| **Documentation** | No | Documentation text to set on the element |

### Relationship CSV

The script detects relationship format when the header starts with `Source,Type,Target`:

```
Source,Type,Target,Name,ID
Application Service,serving-relationship,Business Process,,rel789
```

| Column | Required | Description |
|---|---|---|
| **Source** | Yes | Source element name or ID |
| **Type** | Yes | Relationship type (e.g., `serving-relationship`) |
| **Target** | Yes | Target element name or ID |
| **Name** | No | Optional relationship name |
| **ID** | No | Archi relationship ID — used for duplicate detection |

## Duplicate Handling

The script avoids creating duplicate entries:

1. **By ID**: If the CSV row has an ID and an element/relationship with that ID already exists in the model, the row is skipped.
2. **By type + name** (elements only): If no ID is provided, the script checks for an existing element with the same type and name (case-insensitive match). If found, the row is skipped.

Skipped items are counted and reported in the summary.

## CSV Parsing

The parser handles standard CSV edge cases:
- Fields containing commas are wrapped in double quotes
- Double quotes inside fields are escaped as `""`
- Empty fields are parsed as empty strings

## Round-Trip Workflow

1. Open a view and run **Export View to CSV** to generate element and relationship CSV files
2. Edit the CSV files (add rows, modify names, etc.)
3. Run **Import from CSV** on the modified file
4. Existing elements (matched by ID) are skipped; new rows are created

## Tips

- Always back up your model before importing, especially for large CSV files.
- The script creates elements in the default folder for their type. You can reorganize them in the model tree afterward.
- For relationship import, source and target elements must already exist in the model. Import elements first, then relationships.
- Check the console output for warnings about skipped or failed rows.
- If a type name is incorrect (e.g., misspelled), the row will fail with an error message in the console.
