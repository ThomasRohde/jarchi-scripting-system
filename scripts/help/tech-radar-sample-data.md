# Tech Radar Sample Data

Creates 32 sample technology elements tagged with Tech Radar properties and renders a radar on a new view. Useful for trying out the Tech Radar visualisation without tagging your own model elements.

## Requirements

- An open ArchiMate model

## What It Creates

### Elements (32 total — 8 per quadrant, 2 per ring)

| Quadrant | Element Type | Technologies |
|---|---|---|
| **Platforms** | Node | Kubernetes, AWS, Azure Arc, Cloudflare Workers, WebAssembly Runtime, Edge Computing Platform, On-Premises Data Center, VMware vSphere |
| **Tools** | System Software | GitHub Actions, Terraform, ArgoCD, Backstage, Crossplane, Pulumi, Jenkins, Bamboo |
| **Languages & Frameworks** | Application Component | TypeScript, React, Rust, Next.js, htmx, Deno, jQuery, AngularJS |
| **Techniques** | Business Process | CI/CD Pipelines, Infrastructure as Code, FinOps, Platform Engineering, AI-Assisted Development, Green Computing, Waterfall Methodology, Manual Regression Testing |

Some elements are marked with `tech-radar-new: true` (displayed as triangles on the radar).

### View

A new view named **Tech Radar** is created with the rendered radar image.

## Usage

1. Run **Tech Radar Sample Data** from the Menu
2. Confirm when prompted (the script creates new model elements)
3. The radar view opens automatically

## Tips

- Running the script multiple times creates duplicate elements — use it once per model
- After creating sample data, use **Tech Radar** to re-render if you change any properties
- Delete the sample elements when you no longer need them
