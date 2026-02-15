# Naming and Property Standards Enforcer

Validates model elements against configurable naming, property, and documentation standards. Reports violations in a tabbed dialog with sortable tables, double-click navigation, and CSV export. In apply mode, auto-fixes whitespace issues and sets default property values.

## Requirements

- An open ArchiMate model with elements

## Usage

1. Run the script from the menu
2. Configure validation in the configuration dialog:
   - **Mode**: Check Only (read-only) or Check and Apply Fixes
   - **Standards**: Shows the loaded configuration source
   - **Scope**: Entire Model or Selected Elements
   - **Rule Categories**: Naming, Properties, Documentation (any combination)
3. Click **Validate** to run the checks
4. Review results in the tabbed dialog:
   - **Summary** tab shows element count, violation breakdown by category and severity
   - **Naming** tab lists naming violations with proposed fixes
   - **Properties** tab lists missing or invalid properties
   - **Documentation** tab lists documentation violations
5. Double-click any row to reveal the element in the model tree
6. Click **Export CSV** to save a report file
7. Click **Apply Fixes...** (apply mode only) to fix auto-fixable issues
8. Click **Close** when done

## Modes

| Mode | Description |
|---|---|
| **Check Only** | Read-only analysis. No model changes. Safe for auditing. |
| **Check and Apply Fixes** | Validates and offers to apply auto-fixable violations after review. Shows a confirmation dialog before making changes. |

## Default Rules (Zero-Config)

The built-in defaults are intentionally conservative to avoid false positives:

| Rule | Default | Description |
|---|---|---|
| Min name length | 2 | Names must have at least 2 characters |
| Max name length | 120 | Names must not exceed 120 characters |
| Trim whitespace | On | Detects leading/trailing whitespace |
| No multiple spaces | On | Detects consecutive spaces in names |
| No control chars | On | Detects invisible control characters |
| Required properties | None | No properties required by default |
| Required documentation | None | No documentation required by default |

## Custom Configuration

Place a `naming-standards.json` file in `scripts/config/` to customize rules. The script loads this file automatically and merges it with built-in defaults.

### Configuration Structure

```json
{
    "version": "1.0.0",
    "naming": {
        "global": {
            "minLength": 2,
            "maxLength": 120,
            "trimWhitespace": true,
            "noMultipleSpaces": true,
            "noControlChars": true
        },
        "byType": {
            "business-process": {
                "pattern": "^[A-Z]",
                "transform": "capitalizeFirst"
            }
        },
        "byLayer": {
            "technology": {
                "maxLength": 80
            }
        }
    },
    "properties": {
        "global": [
            { "name": "owner", "required": true, "defaultValue": "TBD" }
        ],
        "byType": {
            "application-component": [
                { "name": "status", "allowedValues": ["Active", "Planned", "Retired"] }
            ]
        },
        "byLayer": {}
    },
    "documentation": {
        "requiredForTypes": ["business-service", "application-service"],
        "requiredForLayers": [],
        "minLength": 10
    }
}
```

### Naming Rules

Type-specific rules override layer-specific rules, which override global rules.

| Field | Type | Description |
|---|---|---|
| `minLength` | number | Minimum name length after trimming |
| `maxLength` | number | Maximum name length |
| `trimWhitespace` | boolean | Check for leading/trailing whitespace |
| `noMultipleSpaces` | boolean | Check for consecutive spaces |
| `noControlChars` | boolean | Check for control characters |
| `pattern` | string | Regex pattern the name must match |
| `transform` | string | Suggested name transform (see below) |

### Naming Transforms

| Transform | Description | Example |
|---|---|---|
| `trim` | Remove leading/trailing whitespace | `" Foo "` -> `"Foo"` |
| `collapseSpaces` | Replace multiple spaces with one | `"Foo  Bar"` -> `"Foo Bar"` |
| `stripControlChars` | Remove control characters | Invisible chars removed |
| `capitalizeFirst` | Capitalize first letter | `"my process"` -> `"My process"` |
| `titleCase` | Capitalize each word | `"my process"` -> `"My Process"` |

### Property Rules

Properties can be defined as simple strings (just the name) or as objects with additional options:

```json
{ "name": "owner", "required": true, "defaultValue": "TBD", "allowedValues": ["Team A", "Team B"] }
```

| Field | Type | Description |
|---|---|---|
| `name` | string | Property key name |
| `required` | boolean | Whether the property must exist (default: true) |
| `defaultValue` | string | Value to set when applying fixes |
| `allowedValues` | string[] | Valid values (violations reported for other values) |

## Severity Levels

| Severity | Description |
|---|---|
| **Error** | Serious issue (empty names, control characters) |
| **Warning** | Standard violation (whitespace, missing property, pattern mismatch) |
| **Info** | Suggestion (transform recommendation, short documentation) |

## Auto-Fixable Violations

The following violation types can be automatically fixed in apply mode:

| Violation | Fix Applied |
|---|---|
| Leading/trailing whitespace | Name trimmed |
| Multiple consecutive spaces | Spaces collapsed |
| Control characters | Characters removed |
| Transform suggestion | Name transformed |
| Missing property with default | Default value set |

## CSV Export

The exported file `naming_standards_report.csv` contains columns: Category, Severity, Element, Type, Layer, Issue, Current Value, Proposed Fix, Element ID.

## Tips

- Start with Check Only mode to understand the violation landscape
- Use the default zero-config rules first, then customize as needed
- Export CSV to share findings with your governance team
- Run after bulk imports to catch naming inconsistencies
- Apply fixes for whitespace cleanup across the whole model
- Use type-specific patterns for naming conventions (e.g., business processes start with a capital letter)
- Use the `byLayer` configuration to enforce layer-specific standards
