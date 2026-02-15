# Strict Layer Violation Detector

Detects relationships that skip ArchiMate layers, violating strict layering discipline. For example, a direct relationship from a Business Process to a Node bypasses the Application layer. Results are presented in a tabbed dialog with sortable tables, double-click navigation, and CSV export.

## Requirements

- An open ArchiMate model with at least one relationship

## Usage

1. Run the script from the menu (no selection required)
2. The script loads the layering policy (built-in default or custom config)
3. All relationships are scanned against the policy
4. Review results in the tabbed dialog:
   - **Summary** tab shows statistics and violation breakdown by rule
   - **Violations** tab lists all violations in a sortable table
   - **Mediation Patterns** tab shows reference patterns for fixing violations
5. Click a row to see mediation advice below the table
6. Double-click a row to reveal the relationship in the model tree
7. Click **Export CSV** to save a report file
8. Click **Close** when done

## Severity Levels

| Severity | Condition | Example |
|---|---|---|
| **Error** | Relationship spans 3+ layers | Strategy to Technology (skips Business and Application) |
| **Warning** | Relationship spans 2 layers | Business to Technology (skips Application) |

## What Gets Checked

The script checks all relationships in the model except:

- **Same-layer relationships** — always allowed
- **Cross-cutting layers** — Motivation and Implementation & Migration layers connect freely to all layers
- **Association and Specialization** — too generic to enforce layering on
- **Allowlisted exceptions** — specific source/target/type tuples approved in the policy

## Default Layer Order

| Layer | Order | Elements |
|---|---|---|
| Strategy | 5 | Resource, Capability, Course of Action, Value Stream |
| Business | 4 | Business Actor, Role, Process, Function, Service, Object, etc. |
| Application | 3 | Application Component, Service, Function, Data Object, etc. |
| Technology | 2 | Node, Device, System Software, Artifact, etc. |
| Physical | 1 | Equipment, Facility, Distribution Network, Material |

Motivation and Implementation & Migration are cross-cutting and excluded from checks.

## Allowed Transitions (Default)

- Strategy ↔ Business (adjacent)
- Business ↔ Application (adjacent)
- Application ↔ Technology (adjacent)
- Technology ↔ Physical (adjacent)

Any other cross-layer relationship is flagged as a violation.

## Customizing the Policy

Edit `scripts/config/layer-policy.json` to customize:

- **elementTypeToLayer** — change which layer an element type belongs to (e.g., move physical types into technology)
- **allowedTransitions** — add or remove permitted layer transitions
- **excludedRelationshipTypes** — add relationship types to skip
- **allowlist** — add specific source-type/target-type/relationship-type exceptions
- **mediationSuggestions** — define fix patterns for specific layer violations

If the config file is missing or cannot be parsed, the script falls back to its built-in default policy.

## Table Columns

| Column | Description |
|---|---|
| **Rule** | The violated layer transition (e.g., Business → Technology) |
| **Severity** | Error or Warning based on layer distance |
| **Source** | Name of the source element |
| **Source Type** | ArchiMate type of the source element |
| **Rel Type** | Relationship type (human-readable label) |
| **Target** | Name of the target element |
| **Target Type** | ArchiMate type of the target element |
| **Rel ID** | Unique relationship identifier |

## CSV Export

The exported file `layer_violation_report.csv` contains columns: Rule, Severity, Source, Source Type, Source Layer, Relationship Type, Target, Target Type, Target Layer, Relationship ID, Mediation.

## Tips

- Run after the Relationship Compliance Checker for full governance coverage
- The default policy is strict; add transitions to `allowedTransitions` to relax it
- To merge Physical into Technology, change the physical element types to map to "technology" in the config
- Use the allowlist for organization-specific approved exceptions
- Export CSV reports to share with your governance team
