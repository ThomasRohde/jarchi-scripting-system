# PRD: New High-Value Scripts for JArchi Scripting System

Date: 2026-02-15  
Status: Draft  
Owner: Project Maintainer

## 1. Summary
This PRD defines the next set of high-value scripts to add to the JArchi scripting system. The focus is on model quality, impact analysis, and faster change execution with safe previews.

## 2. Goals
1. Reduce model quality issues and architecture smells.
2. Cut manual effort for recurring cleanup and governance tasks.
3. Improve confidence before major model changes through impact and dependency analysis.
4. Keep workflows consistent with existing project conventions (Menu, registry metadata, help docs, logging, selection gating).

## 3. Non-Goals
1. Replacing the Model API Server.
2. Full enterprise governance platform features (RBAC, audit platform, multi-user workflows).
3. Automatic semantic correction without user confirmation.

## 4. Users
1. Enterprise architects maintaining large ArchiMate repositories.
2. Solution architects doing impact and dependency analysis.
3. EA governance leads enforcing modeling standards.

## 5. Success Metrics
1. 30% reduction in duplicate element count in first month of use.
2. 50% reduction in manually found relationship/layering violations.
3. 40% faster impact analysis workflow for selected change scenarios.
4. At least 70% of script runs completed without manual post-fix.

## 6. Prioritized Script Backlog

### P0 (Build first)
1. Merge Duplicate Elements
2. Relationship Compliance Checker
3. Strict Layer Violation Detector
4. Dependency Cycle Analyzer

### P1 (Build second)
1. Impact Path Explorer
2. Naming and Property Standards Enforcer
3. Model Sync (CSV/JSON Upsert with Dry Run)

### P2 (Build third)
1. Roadmap/Gap Scaffold Generator

## 7. Detailed Requirements

## 7.1 Merge Duplicate Elements
Script file: `scripts/Merge Duplicate Elements.ajs`  
Registry ID: `cleanup.merge_duplicate_elements`  
Category: Cleanup  
Danger level: high

Problem:
Duplicate elements (same concept represented multiple times) increase inconsistency and maintenance cost.

Core requirements:
1. Detect duplicate groups by configurable key:
   1. Type + normalized name (default).
   2. Optional inclusion of selected properties.
2. Show grouped preview table:
   1. Element ID, type, name, view count, relationship count, folder path.
3. Let user pick canonical element per group.
4. Merge operation options:
   1. Rewire relationships from duplicates to canonical.
   2. Reassign view object concept references where possible.
   3. Merge properties (canonical wins or fill-missing mode).
   4. Append documentation from duplicates with delimiter.
5. Delete duplicates after successful merge.
6. Support dry run summary before apply.

Acceptance criteria:
1. No data loss for properties/documentation under selected merge policy.
2. Relationships and view references of duplicates are preserved on canonical where technically possible.
3. Full operation is undoable as one user action where possible.

## 7.2 Relationship Compliance Checker
Script file: `scripts/Relationship Compliance Checker.ajs`  
Registry ID: `analysis.relationship_compliance_checker`  
Category: Analysis  
Danger level: low

Problem:
Invalid or weak relationship usage reduces model quality and architecture accuracy.

Core requirements:
1. Validate all relationships against allowed source/target/type matrix.
2. Flag likely misuse patterns:
   1. Overuse of association where specific relation is available.
   2. Direction inconsistencies for directed relationship types.
3. Report grouped by severity:
   1. Error: invalid by specification.
   2. Warning: valid but weak modeling practice.
4. Offer quick actions:
   1. Open source/target in tree.
   2. Open view(s) containing violating relationship.
5. Export report to CSV.

Acceptance criteria:
1. Checker returns deterministic results for same model snapshot.
2. Every violation row includes relationship ID and remediation hint.
3. Large models remain usable with progress feedback.

## 7.3 Strict Layer Violation Detector
Script file: `scripts/Strict Layer Violation Detector.ajs`  
Registry ID: `analysis.strict_layer_violation_detector`  
Category: Analysis  
Danger level: low

Problem:
Cross-layer shortcuts (for example Business directly to Technology) break architecture governance.

Core requirements:
1. Configurable layering policy:
   1. Default strict policy based on ArchiMate layers.
   2. Custom allowlist for approved exceptions.
2. Detect prohibited direct links between layers.
3. Provide suggested mediation patterns:
   1. Insert application service/component between business and technology.
4. Group results by policy rule violated.
5. Allow export and navigation.

Acceptance criteria:
1. Policy can be changed without code edits (JSON config in `scripts/config/`).
2. Violations include source and target layer metadata.
3. False-positive rate is low for default policy on reference models.

## 7.4 Dependency Cycle Analyzer
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

## 7.5 Impact Path Explorer
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

## 7.6 Naming and Property Standards Enforcer
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

## 7.7 Model Sync (CSV/JSON Upsert with Dry Run)
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

## 7.8 Roadmap/Gap Scaffold Generator
Script file: `scripts/Roadmap Gap Scaffold Generator.ajs`  
Registry ID: `utilities.roadmap_gap_scaffold_generator`  
Category: Utilities  
Danger level: medium

Problem:
Migration planning models are repetitive to set up and error-prone manually.

Core requirements:
1. Wizard-driven scaffold creation for:
   1. Baseline and target plateaus.
   2. Gap elements.
   3. Work packages.
   4. Deliverables and implementation events.
2. Auto-link common relationships based on chosen template.
3. Optional generation of starter roadmap view.
4. Optional color coding presets for migration status.

Acceptance criteria:
1. Generated scaffold is valid ArchiMate and editable.
2. Template choices are transparent before creation.
3. User can generate scaffold without overwriting existing work.

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
   1. `scripts/lib/modelGraph.js` (graph building, traversal, SCC)
   2. `scripts/lib/modelPolicies.js` (layer and standards policy loading)
   3. `scripts/lib/modelMerge.js` (safe merge utilities)

## 10. Delivery Plan
Phase 1 (P0):
1. Merge Duplicate Elements
2. Relationship Compliance Checker
3. Strict Layer Violation Detector
4. Dependency Cycle Analyzer

Phase 2 (P1):
1. Impact Path Explorer
2. Naming and Property Standards Enforcer
3. Model Sync (CSV/JSON Upsert with Dry Run)

Phase 3 (P2):
1. Roadmap/Gap Scaffold Generator

## 11. Definition of Done (per script)
1. Script implemented with error handling and logging.
2. Registry metadata added and validated.
3. Help markdown added with examples.
4. Manual test checklist completed on representative model.
5. `npm test` passes.
