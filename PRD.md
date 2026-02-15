# PRD: Remaining High-Value Scripts for JArchi Scripting System

Date: 2026-02-15  
Status: Draft  
Owner: Project Maintainer

## 1. Summary
This PRD tracks the remaining high-value scripts that are not yet implemented in the JArchi scripting system. The focus is on dependency risk detection, impact analysis, standards enforcement, and safer model synchronization.

## 2. Goals
1. Reduce architecture coupling risk with dependency cycle detection.
2. Improve confidence before major model changes through path-based impact analysis.
3. Enforce consistent naming and metadata standards at scale.
4. Enable safer external-data synchronization workflows with dry-run support.

## 3. Non-Goals
1. Replacing the Model API Server.
2. Full enterprise governance platform features (RBAC, audit platform, multi-user workflows).
3. Automatic semantic correction without user confirmation.

## 4. Users
1. Enterprise architects maintaining large ArchiMate repositories.
2. Solution architects doing impact and dependency analysis.
3. EA governance leads enforcing modeling standards.
4. Integration owners synchronizing model data from external sources.

## 5. Success Metrics
1. 40% faster impact analysis workflow for selected change scenarios.
2. 50% reduction in manually found dependency/coupling issues.
3. 50% reduction in naming and required-property violations after two governance review cycles.
4. At least 70% of script runs completed without manual post-fix.

## 6. Prioritized Script Backlog

### P0 (Build first)
1. Dependency Cycle Analyzer
2. Impact Path Explorer

### P1 (Build second)
1. Naming and Property Standards Enforcer
2. Model Sync (CSV/JSON Upsert with Dry Run)

## 7. Detailed Requirements

## 7.1 Dependency Cycle Analyzer
Script file: `scripts/Dependency Cycle Analyzer.ajs`  
Registry ID: `analysis.dependency_cycle_analyzer`  
Category: Analysis  
Danger level: low

Problem:
Cycles make architecture harder to evolve and increase coupling risk.

Core requirements:
1. Build dependency graph from configurable relationship types.
2. Detect strongly connected components and explicit cycle paths.
3. Rank cycles by impact:
   1. Node count, edge count, cross-layer count, centrality proxy.
4. Allow filtering by scope:
   1. Entire model.
   2. Selected elements subtree.
   3. Type/layer filter.
5. Optional generation of a dedicated cycle view showing only cycle nodes/relations.

Acceptance criteria:
1. Analyzer finds known cycles in seeded test model.
2. Results include reproducible cycle path examples.
3. Optional view creation is explicit opt-in.

## 7.2 Impact Path Explorer
Script file: `scripts/Impact Path Explorer.ajs`  
Registry ID: `analysis.impact_path_explorer`  
Category: Analysis  
Danger level: low

Problem:
Impact analysis is currently manual and time-consuming across large models.

Core requirements:
1. Start from selected element(s) as seeds.
2. Traverse upstream/downstream dependencies by relationship type and depth.
3. Provide path-centric results:
   1. Element chain.
   2. Relationship chain.
   3. Path length and endpoint type.
4. Optional output modes:
   1. Tabular report.
   2. Temporary impact view with highlighted paths.
5. Exclude noisy relationship types via filter presets.

Acceptance criteria:
1. User can identify top impacted endpoints within configurable depth.
2. Result set can be exported to CSV.
3. Explorer handles multiple seeds in one run.

## 7.3 Naming and Property Standards Enforcer
Script file: `scripts/Naming and Property Standards Enforcer.ajs`  
Registry ID: `utilities.naming_property_standards_enforcer`  
Category: Utilities  
Danger level: medium

Problem:
Inconsistent naming and missing metadata degrade findability and governance.

Core requirements:
1. Load standards from config file:
   1. Naming regex by type/layer/folder.
   2. Required properties by type/layer/folder.
   3. Required documentation rules.
2. Validate current model against standards.
3. Show violations with bulk-fix support:
   1. Rename transform templates.
   2. Add missing properties with default values.
4. Support check-only mode and apply mode.

Acceptance criteria:
1. Script can run without config by using safe defaults.
2. No write operations occur in check-only mode.
3. Apply mode shows exact change preview before commit.

## 7.4 Model Sync (CSV/JSON Upsert with Dry Run)
Script file: `scripts/Model Sync.ajs`  
Registry ID: `utilities.model_sync_upsert`  
Category: Utilities  
Danger level: high

Problem:
Current CSV import is creation-focused and cannot safely support full sync workflows.

Core requirements:
1. Support CSV and JSON input.
2. Upsert modes:
   1. Create only.
   2. Create + update.
   3. Create + update + delete missing.
3. Stable matching strategy:
   1. Prefer ID.
   2. Fallback to external key property.
   3. Optional name+type fallback with ambiguity guard.
4. Dry run diff output:
   1. To create, update, delete, skip, ambiguous.
5. Apply only after explicit confirmation.
6. Produce import report file with row-level outcomes.

Acceptance criteria:
1. Ambiguous matches never auto-apply silently.
2. Dry run and apply counts must reconcile.
3. Rollback path is documented and practical.

## 8. Shared UX and Technical Requirements
1. All scripts must follow project template and conventions:
   1. `log` usage, `requireModel`, `resolveSelection`, try/catch.
   2. Registry entry in `scripts/registry/`.
   3. Help markdown in `scripts/help/` for complex scripts.
2. Any destructive path requires preview + confirmation.
3. Large model operations must provide progress feedback.
4. Export options should use CSV for interoperability.
5. Navigation support (double-click to reveal/open) is required for analysis scripts.

## 9. Dependencies
1. Existing shared libs:
   1. `scripts/lib/log.js`
   2. `scripts/lib/requireModel.js`
   3. `scripts/lib/resolveSelection.js`
   4. `scripts/lib/swtImports.js`
2. New helper libs likely needed:
   1. `scripts/lib/modelGraph.js` (graph building, traversal, SCC/paths)
   2. `scripts/lib/modelPolicies.js` (standards policy loading and validation helpers)
   3. `scripts/lib/modelSyncEngine.js` (matching, diff generation, apply orchestration)

## 10. Delivery Plan
Phase 1 (P0):
1. Dependency Cycle Analyzer
2. Impact Path Explorer

Phase 2 (P1):
1. Naming and Property Standards Enforcer
2. Model Sync (CSV/JSON Upsert with Dry Run)

## 11. Definition of Done (per script)
1. Script implemented with error handling and logging.
2. Registry metadata added and validated.
3. Help markdown added with examples.
4. Manual test checklist completed on representative model.
5. `npm test` passes.
