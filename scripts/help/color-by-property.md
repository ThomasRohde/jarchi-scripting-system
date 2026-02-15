# Color by Property

Colors diagram objects on the active view based on a property value. Each unique property value gets a distinct color from a built-in palette. Double-click any row to open a native color picker and choose a custom color.

## Requirements

- An open ArchiMate model
- An active view with elements that have properties set

## Usage

1. Open a view that contains elements with properties
2. Run the script from the menu
3. Select a property name from the dropdown
4. Review the color preview table -- each unique value gets a default palette color
5. **Double-click** any row to open the native color picker and choose a custom color
6. Optionally check "Color elements without this property" to include them (defaults to gray, also customizable)
7. Click **Apply** to color the view, or **Cancel** to abort

## Dialog Reference

### Property Dropdown

Lists all property names found on elements in the active view, sorted alphabetically. Changing the selection rebuilds the preview table with new values and default colors. Any custom colors you picked for the previous property are discarded.

### Color Preview Table

Shows each unique property value and its assigned color:

| Column | Description |
|---|---|
| **Value** | The property value text |
| **Color** | The hex color code -- background shows the actual color |

**Double-click** any row to open the native OS color picker for that value. The picker opens pre-set to the current color. Your custom color choices are preserved while the dialog is open.

### Include Empty Checkbox

When checked, elements that don't have the selected property (or have an empty value) appear as a "(no value)" row in the table, defaulting to gray (#C0C0C0). You can double-click this row to pick a custom color for it too. When unchecked (default), those elements are left unchanged.

## Default Color Palette

The script assigns colors from a 12-color palette as defaults. You can override any of them via the color picker.

| Color | Hex |
|---|---|
| Steel Blue | `#4E79A7` |
| Orange | `#F28E2B` |
| Red | `#E15759` |
| Teal | `#76B7B2` |
| Green | `#59A14F` |
| Yellow | `#EDC948` |
| Purple | `#B07AA1` |
| Pink | `#FF9DA7` |
| Brown | `#9C755F` |
| Gray | `#BAB0AC` |
| Light Teal | `#86BCB6` |
| Rose | `#D37295` |

If there are more than 12 unique values, default colors repeat from the beginning of the palette (round-robin). Values are sorted alphabetically before assignment.

## Tips

- Use **Reset Visual Appearance** to undo the coloring and return elements to their default colors.
- This script is useful for visualizing status (e.g., "lifecycle" property with values like "current", "target", "retired") or domain ownership.
- Properties must be set on the underlying model elements (concepts), not on the diagram objects. Use Archi's Properties tab to add or edit element properties.
- The coloring applies to the diagram objects' fill color only -- font colors and line colors are not changed.
- Run the script multiple times with different properties to compare categorizations. Remember to reset between runs if needed.
