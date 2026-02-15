# Relationship Compliance Checker

Validates every relationship in the current model against the ArchiMate 3.1 allowed-relationship matrix and flags weak modeling patterns. Results are presented in a tabbed dialog with sortable tables, double-click navigation, and CSV export.

## Requirements

- An open ArchiMate model with at least one relationship

## Usage

1. Run the script from the menu (no selection required)
2. The script scans all relationships in the model
3. Review results in the tabbed dialog:
   - **Summary** tab shows statistics and warning breakdown
   - **Errors** tab lists specification violations
   - **Warnings** tab lists weak modeling patterns
4. Click a row to see remediation advice below the table
5. Double-click a row to reveal the relationship in the model tree
6. Click **Export CSV** to save a report file
7. Click **Close** when done

## Severity Levels

### Errors (specification violations)

A relationship type that is not permitted between the given source and target element types according to the ArchiMate 3.1 specification. This can occur when relationships are created via import or scripting.

### Warnings (weak modeling patterns)

Valid relationships that indicate potential quality issues:

| Warning Type | Description |
|---|---|
| **Association overuse** | An association-relationship is used where more specific types (serving, flow, triggering, etc.) are available between the source and target types |
| **Duplicate relationships** | Two or more relationships of the same type exist between the same source and target elements |
| **Bidirectional directed** | A serving or flow relationship exists in both directions between two elements, suggesting confusion about direction semantics |
| **Self-relationship** | An element has a relationship to itself, which is rarely intentional |

## Table Columns

| Column | Description |
|---|---|
| **Source** | Name of the source element |
| **Source Type** | ArchiMate type of the source element |
| **Rel Type** | Relationship type (human-readable label) |
| **Target** | Name of the target element |
| **Target Type** | ArchiMate type of the target element |
| **Message** | Description of the violation or warning |
| **Rel ID** | Unique relationship identifier |

## CSV Export

The exported file `relationship_compliance_report.csv` contains all errors and warnings with columns: Severity, Source, Source Type, Relationship Type, Target, Target Type, Relationship ID, Message, Remediation.

## Tips

- Run this script after bulk imports to catch invalid relationships early
- Focus on errors first as they indicate specification violations
- Association overuse warnings are the most common; review them to strengthen your model semantics
- Use the CSV export to share compliance reports with your governance team
- The script skips junction elements and relationship-on-relationship constructs automatically
