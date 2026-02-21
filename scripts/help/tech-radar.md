# Tech Radar

Renders a Thoughtworks-style Technology Radar as a native image embedded in an ArchiMate view. The radar visualises technology choices across four quadrants and four maturity rings, plotted as numbered blips with a colour-coded legend.

## Requirements

- An open ArchiMate model
- Model elements tagged with `tech-radar-ring` and `tech-radar-quadrant` properties
- An active view to render the radar onto (for **Tech Radar**)

## Tagging Elements

Add these properties to any model element you want to appear on the radar:

| Property | Values | Required |
|---|---|---|
| `tech-radar-ring` | `Adopt`, `Trial`, `Assess`, `Hold` | Yes |
| `tech-radar-quadrant` | `Platforms`, `Tools`, `Languages & Frameworks`, `Techniques` | Yes |
| `tech-radar-new` | `true` | No — marks blip with a triangle |

The element's **name** is used as the blip label. Any ArchiMate element type can be tagged.

## Rings

| Ring | Colour | Meaning |
|---|---|---|
| **Adopt** | Green | Proven technologies recommended for broad use |
| **Trial** | Blue | Worth pursuing in projects that can handle some risk |
| **Assess** | Amber | Worth exploring to understand how they will affect you |
| **Hold** | Red | Proceed with caution; not recommended for new projects |

## Quadrants

| Quadrant | Position | Typical contents |
|---|---|---|
| **Platforms** | Top-right | Infrastructure, cloud providers, runtime platforms |
| **Tools** | Bottom-right | Development tools, CI/CD, monitoring |
| **Languages & Frameworks** | Bottom-left | Programming languages, libraries, frameworks |
| **Techniques** | Top-left | Practices, processes, architectural patterns |

## Visual Indicators

- **Circle** (●) — existing technology on the radar
- **Triangle** (▲) — newly added technology (set `tech-radar-new` to `true`)
- **Numbered labels** — each blip has a number matching the legend below the radar

## Usage

### Tech Radar (rendering only)

1. Open a view where the radar should appear
2. Run **Tech Radar** from the Menu
3. The radar image replaces any existing "Tech Radar" image on the view

### Tech Radar Sample Data

1. Run **Tech Radar Sample Data** from the Menu
2. The script creates 32 sample technology elements (8 per quadrant) with radar properties
3. A new "Tech Radar" view is created with the rendered radar

Running the sample data script multiple times will create duplicate elements.

## Tips

- You can resize the embedded image after rendering — it stays crisp at any scale
- Re-run the script to update the radar after changing element properties
- The radar uses deterministic placement, so blips stay in the same position across renders as long as their ID and name don't change
- Delete the image named "Tech Radar" from the view to start fresh
