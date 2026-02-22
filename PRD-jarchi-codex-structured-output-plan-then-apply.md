# PRD: Deterministic Structured Output for JArchi ↔ Codex App-Server (Plan-Then-Apply)

## Document Control

- **Owner:** Thomas Rohde
- **Status:** Draft (developer-ready)
- **Version:** 0.1
- **Target repo area:** JArchi scripting project (`lib/`, `schemas/`, `examples/`, optional local proxy)
- **Primary audience:** Coding agents / developers implementing JArchi + Codex integration
- **Last updated:** 2026-02-22

---

## 1. Problem Statement

The current JArchi integration can already connect to the Codex app-server and execute conversational turns, but the response handling is optimized for **human-readable text**, not **deterministic machine-interpretable modeling actions**.

The real goal is not “make Codex return JSON.”  
The real goal is:

> Create a reliable **plan-then-apply** workflow where Codex returns a strictly validated action plan (preset schema) that JArchi can interpret deterministically into modeling actions.

This avoids heuristic parsing of prose and reduces nondeterminism, hallucinated actions, and unsafe model changes.

---

## 2. Current State (Baseline) — from `codexClient.js`

The uploaded `codexClient.js` (v1.1.0) is a synchronous WebSocket JSON-RPC client for the Codex app-server. It:
- performs WebSocket handshake manually,
- initializes JSON-RPC session,
- starts/resumes threads,
- starts turns,
- collects streaming deltas,
- auto-accepts server approval requests,
- returns a merged text response with items/status,
- can build a **prompt-oriented** model context string (`buildModelContext`). fileciteturn0file0

Important implementation observations for this PRD:
- `ask(threadId, text, options)` currently sends only `input: [{ type: "text", text }]` and returns `{ text, turnId, status, items }`; it does **not** parse structured payloads. fileciteturn0file0
- `_collectTurnResponse(...)` aggregates `item/agentMessage/delta` text but does not extract a JSON object / tool call payload / schema-validated output. fileciteturn0file0
- `buildModelContext(...)` emits Markdown-like summaries of elements/relationships/views and is useful for humans, but it does not provide a strict machine context with IDs, allowlists, and deterministic constraints. fileciteturn0file0

### Implication
The current library is a strong **transport foundation**, but the deterministic action layer must be added on top.

---

## 3. Goals and Non-Goals

## 3.1 Goals

1. **Structured output contract**
   - Codex returns an `ArchiChangePlan` JSON object conforming to a strict schema.

2. **Deterministic execution**
   - JArchi executes only allowlisted operations from validated plans.

3. **Safety-first workflow**
   - Preview + validation before apply.
   - Reject malformed or semantically invalid plans.

4. **Compatibility with existing transport**
   - Reuse current WebSocket JSON-RPC `codexClient.js` transport with minimal disruption.

5. **Extensibility**
   - Schema versioning and action vocabulary that can grow over time (e.g., layout hints, batch ops, idempotency).

## 3.2 Non-Goals (v1)

- Full natural language “autonomous” refactoring without preview.
- Direct execution of model-generated JavaScript/JArchi code.
- Arbitrary tool execution on the host.
- Perfect layout generation in views (only basic deterministic placement hints in v1 if included).

---

## 4. Success Criteria

A successful implementation means:

- A user can provide a request like:
  - “Create a serving relationship from Application Service A to Application Component B and rename component C”
- Codex returns a schema-valid `ArchiChangePlan`.
- JArchi validates:
  - schema,
  - existence of IDs,
  - allowed relationship type(s),
  - scope constraints.
- JArchi previews actions and applies them deterministically.
- Failures produce actionable diagnostics (no silent partial corruption).

---

## 5. Proposed Architecture

## 5.1 High-Level Flow

1. **Selection/Scope collection in JArchi**
2. **Build deterministic context JSON** (IDs, names, types, allowed ops/types)
3. **Prompt + schema contract sent to Codex app-server**
4. **Receive raw response**
5. **Extract structured plan**
6. **Schema validation**
7. **Semantic validation (JArchi-side)**
8. **Preview**
9. **Apply via executor**
10. **Log/audit result**

## 5.2 Recommended Pattern: “Plan Then Apply”

- **Codex = Planner**
  - Produces a proposed action plan only.
- **JArchi = Executor**
  - Applies known operations safely and deterministically.

This separation is the core design decision.

## 5.3 Optional Adapter (Strongly Recommended if app-server lacks schema support)

If Codex app-server does not expose native structured output / tool-call forcing, add a tiny **local proxy** (Node/TS preferred) that:
- accepts JArchi request,
- calls OpenAI/Codex with `response_format` (JSON Schema) or required function tool,
- returns clean JSON plan to JArchi.

JArchi can still call the app-server/proxy through the same transport abstraction.

---

## 6. Functional Requirements

## FR-1: Deterministic Context Builder

Add a new context builder (parallel to `buildModelContext`) that returns machine-readable JSON, not prose.

### Inputs
- selected elements / relationships / views (or model-wide scope)
- options (include properties, docs, max counts, scope restrictions)

### Outputs
`ArchiPlanningContext` JSON object with:
- schema version
- scope metadata
- explicit element list with IDs
- relationship list with IDs
- allowed ops
- allowed relationship types
- constraints/policies

### Minimum fields
- `elements[].id`
- `elements[].name`
- `elements[].type`
- `relationships[].id` (if available)
- `relationships[].source_id`
- `relationships[].target_id`
- `relationships[].type`
- `allowed_ops`
- `allowed_relationship_types`
- `scope_rules`

---

## FR-2: Structured Plan Request API

Add a high-level method (wrapper over existing `ask`) to request a structured action plan.

### Proposed public API (JArchi JS)
```js
var result = codexClient.askPlan(thread.id, {
  userIntent: "Create a serving relationship from Payments API to Card Processor and rename Card Processor to Card Processing Engine",
  context: planningContextJson,
  schema: "archi-change-plan-v1",
  mode: "preview"
});
```

### Output
```js
{
  ok: true,
  raw: { ...transport/raw turn info... },
  plan: { ...ArchiChangePlan... },
  validation: {
    schemaValid: true,
    semanticValid: true,
    errors: [],
    warnings: []
  }
}
```

---

## FR-3: Strict JSON Schema Validation

JArchi-side (or proxy-side) must validate the plan against a JSON Schema before any semantic validation or execution.

### Requirements
- `additionalProperties: false` on plan and action objects
- discriminated action union (via `op`)
- enums for status / operation / relationship types
- schema version constant for v1

### Behavior
- Reject invalid schema with a clear error
- Never attempt execution on schema-invalid payloads

---

## FR-4: Semantic Validation Layer (JArchi-side)

Beyond JSON Schema, validate domain constraints.

### Minimum checks
- element IDs exist in model and in allowed scope (unless create op)
- source and target exist for relationship creation
- relationship type is allowlisted
- no duplicate incompatible operations (e.g., rename same element twice in same plan unless explicitly permitted)
- property operations comply with key/value restrictions
- no out-of-scope modifications
- no unknown temp references (e.g., `@new1`) if create ops are used

### Behavior
- `semanticValid=false` blocks apply
- validation report is previewable

---

## FR-5: Preview/Apply Execution Workflow

### Preview mode (default)
- show human-readable summary of actions
- show validation warnings/errors
- do not modify model

### Apply mode
- execute actions sequentially in deterministic order
- record per-action success/failure
- stop-on-error (default v1) with configurable option for continue-on-error later

---

## FR-6: Action Executor (Deterministic DSL Interpreter)

Implement an internal executor for a small allowlisted action DSL.

### v1 Required operations
- `rename_element`
- `set_property`
- `create_relationship`

### v1 Optional (nice-to-have, if time permits)
- `create_element`
- `add_to_view`
- `set_documentation`

---

## FR-7: Audit Logging

For every plan:
- timestamp
- threadId/turnId (if available)
- user intent
- plan JSON
- schema validation result
- semantic validation result
- execution results

Output can be:
- JArchi console log
- JSON log file
- both

---

## 7. Non-Functional Requirements

## NFR-1: Determinism
- stable ordering of context arrays (sort by ID/name)
- stable prompt template
- narrow action vocabulary

## NFR-2: Safety
- no direct execution of model-generated script
- reject unknown fields and unknown ops
- preview before apply by default
- optional “safe mode” restricting to selected objects only

## NFR-3: Performance
- Target < 2s local validation/execution for plans ≤ 100 actions
- Context builder should support truncation and scope limits

## NFR-4: Backward Compatibility
- Existing `codexClient.ask(...)` remains unchanged
- Structured planning added as new APIs/modules

---

## 8. Protocol and Schema Design

## 8.1 `ArchiChangePlan` (v1) — Canonical Envelope

### Status semantics
- `ready`: plan is actionable
- `needs_clarification`: plan intentionally contains no actions (or minimal no-op) and includes questions
- `refusal`: no actions; explanation in summary/warnings

### Canonical object shape (v1)
```json
{
  "schema_version": "1.0",
  "status": "ready",
  "summary": "Rename one element and create one serving relationship.",
  "warnings": [],
  "questions": [],
  "actions": [
    {
      "op": "rename_element",
      "element_id": "id-123",
      "new_name": "Card Processing Engine"
    },
    {
      "op": "create_relationship",
      "source_id": "id-001",
      "target_id": "id-123",
      "relationship_type": "Serving",
      "name": ""
    }
  ]
}
```

## 8.2 JSON Schema (v1) — Developer Reference

> Store as `schemas/archi-change-plan-v1.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "ArchiChangePlan",
  "type": "object",
  "additionalProperties": false,
  "required": ["schema_version", "status", "summary", "actions"],
  "properties": {
    "schema_version": { "type": "string", "const": "1.0" },
    "status": {
      "type": "string",
      "enum": ["ready", "needs_clarification", "refusal"]
    },
    "summary": { "type": "string", "minLength": 1, "maxLength": 500 },
    "warnings": {
      "type": "array",
      "items": { "type": "string", "maxLength": 500 },
      "default": []
    },
    "questions": {
      "type": "array",
      "items": { "type": "string", "maxLength": 500 },
      "default": []
    },
    "actions": {
      "type": "array",
      "maxItems": 100,
      "items": {
        "oneOf": [
          {
            "type": "object",
            "additionalProperties": false,
            "required": ["op", "element_id", "new_name"],
            "properties": {
              "op": { "const": "rename_element" },
              "element_id": { "type": "string", "minLength": 1 },
              "new_name": { "type": "string", "minLength": 1, "maxLength": 255 }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": ["op", "element_id", "key", "value"],
            "properties": {
              "op": { "const": "set_property" },
              "element_id": { "type": "string", "minLength": 1 },
              "key": { "type": "string", "minLength": 1, "maxLength": 100 },
              "value": { "type": "string", "maxLength": 5000 }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": ["op", "source_id", "target_id", "relationship_type"],
            "properties": {
              "op": { "const": "create_relationship" },
              "source_id": { "type": "string", "minLength": 1 },
              "target_id": { "type": "string", "minLength": 1 },
              "relationship_type": {
                "type": "string",
                "enum": [
                  "Association",
                  "Serving",
                  "Flow",
                  "Triggering",
                  "Assignment",
                  "Realization"
                ]
              },
              "name": { "type": "string", "maxLength": 255 }
            }
          }
        ]
      }
    }
  }
}
```

---

## 9. Prompt/Contract Design

## 9.1 System Contract (required)

The planner prompt must clearly enforce:
- return JSON only
- match schema exactly
- no extra fields
- use allowlisted IDs/ops
- ask clarification when ambiguous

### Recommended template (system)
```text
You are an Archi modeling planner.

Return ONLY a valid JSON object matching the provided ArchiChangePlan schema.

Rules:
- Use only allowed operations and enum values.
- Use only IDs present in the context unless the operation explicitly creates a new object.
- If the request is ambiguous, set status="needs_clarification" and populate questions.
- Do not output markdown, prose outside JSON, or extra fields.
- Prefer the smallest action set that satisfies the request.
```

## 9.2 User Input Payload (recommended shape)

Use a structured user prompt (text or JSON string) containing:
- `intent`
- `context`
- `constraints`
- `schema summary`

Example (logical content):
```json
{
  "intent": "Rename 'Card Processor' to 'Card Processing Engine' and create a Serving relationship from 'Payments API' to it.",
  "context": { "...ArchiPlanningContext..." },
  "constraints": {
    "mode": "preview",
    "scope": "selected",
    "allow_create_element": false
  }
}
```

---

## 10. Transport Strategy (Codex app-server)

## 10.1 Important correction to the integration wording

Although the user goal mentions “HTTP,” the provided `codexClient.js` currently implements a **WebSocket JSON-RPC** client to the Codex app-server. The PRD therefore targets the existing transport and extends it with structured-plan behavior, not a separate HTTP client. fileciteturn0file0

## 10.2 Structured output options

### Option A (Preferred): Native JSON Schema response format
If the app-server supports passing model response format options:
- request strict JSON schema output
- parse returned JSON object directly

### Option B (Excellent fallback): Required function/tool call
If the app-server supports tool/function calls:
- define a single function `propose_archi_change_plan`
- force tool call
- parse arguments as the plan

### Option C (Fallback of last resort): JSON-only prompting
Use only if A/B unavailable:
- prompt for JSON only
- parse first JSON object
- still schema-validate and semantically validate
- expect higher failure rate

### Option D (Recommended adapter): Local proxy
If app-server does not surface A/B, add a local proxy that does.
This is the most reliable path if structured responses are essential.

---

## 11. Detailed Component Design

## 11.1 `codexClient.js` Enhancements (non-breaking)

### New methods (proposed)

#### `askRaw(threadId, turnParams, options)`
Low-level wrapper to allow custom `turn/start` payloads (future-proofing).

```js
codexClient.askRaw(threadId, {
  input: [{ type: "text", text: "..." }],
  // future extensions if app-server supports them
}, options)
```

#### `askPlan(threadId, request, options)`
High-level helper that:
- builds prompt from intent + context + schema
- calls Codex
- extracts JSON plan
- returns raw + parsed info

#### `extractJsonFromTurn(turnResult, options)`
Parses structured data from:
- final text
- tool call item(s) (if present in `items`)
- explicit JSON blocks (fallback only)

#### `buildPlanningContext(options)`
Machine context builder (JSON object), separate from `buildModelContext`.

### Why non-breaking?
Existing scripts using `connect/startThread/ask/...` continue to work unchanged. fileciteturn0file0

---

## 11.2 Validation Module (`lib/planValidator.js`)

### Responsibilities
- JSON Schema validation
- semantic validation against live model / scope
- produce normalized plan for executor (optional)

### Suggested API
```js
var report = planValidator.validate(plan, {
  model: model,
  scope: scope,
  allowedRelationshipTypes: [...],
  allowedOps: [...]
});
```

### Output
```js
{
  schemaValid: true,
  semanticValid: true,
  errors: [],
  warnings: [],
  normalizedPlan: { ... }
}
```

---

## 11.3 Executor Module (`lib/planExecutor.js`)

### Responsibilities
- deterministic mapping from DSL ops → JArchi actions
- ordered execution
- stop-on-error
- result reporting

### Suggested API
```js
var execResult = planExecutor.apply(plan, {
  preview: false,
  stopOnError: true,
  logger: log
});
```

### Output
```js
{
  ok: true,
  applied: 2,
  failed: 0,
  results: [
    { index: 0, op: "rename_element", ok: true },
    { index: 1, op: "create_relationship", ok: true, relationshipId: "..." }
  ]
}
```

---

## 11.4 Preview Renderer (`lib/planPreview.js`) (optional but recommended)

Generates human-readable preview text for a dialog/console.

Example:
- Rename element `id-123` from “Card Processor” → “Card Processing Engine”
- Create `Serving` relationship from `Payments API (id-001)` → `Card Processing Engine (id-123)`

---

## 12. Deterministic Context Schema (v1) — `ArchiPlanningContext`

> Store as `schemas/archi-planning-context-v1.schema.json` (optional, but recommended)

This context is what the model sees and should be consistent and compact.

### Example
```json
{
  "schema_version": "1.0",
  "scope": {
    "mode": "selected",
    "allow_model_wide_changes": false
  },
  "allowed_ops": ["rename_element", "set_property", "create_relationship"],
  "allowed_relationship_types": ["Association", "Serving", "Flow", "Triggering", "Assignment", "Realization"],
  "elements": [
    {
      "id": "id-001",
      "name": "Payments API",
      "type": "application-service",
      "documentation": "..."
    },
    {
      "id": "id-123",
      "name": "Card Processor",
      "type": "application-component"
    }
  ],
  "relationships": [],
  "policies": {
    "require_clarification_on_ambiguous_names": true,
    "prefer_ids_over_names": true
  }
}
```

### Context design rules
- Keep IDs explicit and stable
- Sort elements by ID or name (stable order)
- Truncate docs/properties if token budget is tight
- Include both IDs and names (for human intent mapping)

---

## 13. Execution Semantics

## 13.1 Ordering (v1)
Actions execute in array order.

## 13.2 Transaction behavior (v1)
- **Default:** stop on first error
- No rollback transaction required in v1
- Execution report must indicate partial apply if failure occurs

## 13.3 Idempotency (v1)
Best-effort only:
- rename to same name = no-op success (recommended)
- setting property to same value = no-op success (recommended)
- duplicate relationship creation behavior must be defined explicitly (recommended: detect existing and return no-op warning if identical)

---

## 14. Error Handling & Failure Modes

## 14.1 Transport errors
- connection refused / timeout / server close
- surface cleanly with original cause

## 14.2 Response parsing errors
- non-JSON output
- invalid JSON syntax
- multiple JSON objects / extra prose
- missing expected tool call payload

## 14.3 Schema validation errors
- unknown field
- missing required field
- invalid enum values
- invalid action shape

## 14.4 Semantic validation errors
- unknown IDs
- out-of-scope IDs
- illegal relationship type/source-target combination
- duplicate/conflicting actions

## 14.5 Execution errors
- JArchi API failure while applying action
- model object deleted/changed since validation

### Error reporting requirement
Every failure category must produce:
- error code
- message
- action index (if applicable)
- raw payload snippet (safe truncation)

---

## 15. Security / Safety Model

1. **No generated code execution**
   - The model must not return JS for direct execution.

2. **Allowlist-only operations**
   - Unknown `op` rejected.

3. **Scope enforcement**
   - Enforce selected-scope restrictions in semantic validation.

4. **Preview first**
   - Default mode is preview.

5. **Auditability**
   - Save plan + execution results for traceability.

---

## 16. Developer Work Plan (Implementation Phases)

## Phase 1 — Foundations (MVP)
- [ ] Add `buildPlanningContext(...)`
- [ ] Add `askPlan(...)` (prompt + JSON extraction fallback)
- [ ] Add `schemas/archi-change-plan-v1.schema.json`
- [ ] Add `planValidator.js` (schema + basic semantic checks)
- [ ] Add `planExecutor.js` (rename/set_property/create_relationship)
- [ ] Add console preview/apply script example

## Phase 2 — Reliability
- [ ] Add optional local proxy for native structured outputs/tool forcing
- [ ] Add stronger JSON extraction from `items` if app-server exposes tool payloads
- [ ] Add stable sorting + token-budgeted context truncation
- [ ] Add execution/audit log JSON output

## Phase 3 — UX and Extensions
- [ ] Add dialog preview UI (SWT/JFace if desired)
- [ ] Add `create_element`
- [ ] Add temp refs (`@new1`) for plans that create then connect
- [ ] Add `add_to_view` with deterministic coordinates/layout hints
- [ ] Add duplicate relationship detection / idempotency policy options

---

## 17. File/Module Layout (Proposed)

```text
/scripts
  /lib
    codexClient.js                 # existing transport, extended with askPlan/buildPlanningContext
    planValidator.js               # new
    planExecutor.js                # new
    planPreview.js                 # optional
    jsonSchemaValidator.js         # adapter around chosen validator (if needed)
  /schemas
    archi-change-plan-v1.schema.json
    archi-planning-context-v1.schema.json   # optional but recommended
  /examples
    codex-structured-plan-demo.js
    sample-context.json
    sample-plan-ready.json
    sample-plan-needs-clarification.json
  /docs
    prompt-contract.md
```

---

## 18. Acceptance Criteria (Developer-Testable)

## AC-1: Schema-valid ready plan can be applied
Given a valid plan with `rename_element` and `create_relationship`,
when validated and executed,
then both actions are applied and reported as success.

## AC-2: Invalid schema is rejected
Given a plan with an unknown field (e.g., `"foo": 123`) inside an action,
when validated,
then `schemaValid=false` and execution is blocked.

## AC-3: Out-of-scope ID is rejected
Given a valid schema plan using an element ID not in allowed scope,
when semantically validated,
then `semanticValid=false` and execution is blocked.

## AC-4: Ambiguous request yields clarification
Given an intent referring to a non-unique name in context,
when planning,
then plan status is `needs_clarification` and `questions[]` is non-empty.

## AC-5: Non-JSON response fails safely
Given a model response that contains prose instead of parseable JSON,
when `askPlan` runs,
then it returns a parse error and performs no model changes.

## AC-6: Existing `ask(...)` remains functional
Legacy scripts using `codexClient.ask(...)` continue to work unchanged. fileciteturn0file0

---

## 19. Test Strategy

## 19.1 Unit Tests (logic-level; where feasible)
- JSON schema validation pass/fail fixtures
- semantic validation fixtures
- executor mapping for each op
- no-op/idempotent behavior (same name/property)

## 19.2 Integration Tests (JArchi runtime)
- live model test fixture with known IDs
- preview-only path
- apply path
- malformed response fixtures (simulate model output)

## 19.3 Golden Fixtures
Maintain fixture files for:
- `ready` plan
- `needs_clarification` plan
- `refusal` plan
- schema-invalid plan
- semantically-invalid plan

---

## 20. Suggested `askPlan()` Behavior (Reference Pseudocode)

```js
function askPlan(threadId, req, options) {
  // 1) Build prompt contract + embed context JSON + schema summary
  // 2) Call codexClient.ask(...) (or askRaw if transport supports richer params)
  // 3) Extract structured JSON from response/tool payload
  // 4) Validate schema
  // 5) Validate semantics against live model/scope
  // 6) Return composite result (raw + plan + validation)
}
```

---

## 21. Open Questions (to resolve during implementation)

1. **Structured output support in app-server**
   - Can `turn/start` carry model-level response format/tool-choice parameters through the current app-server?
   - If yes, what exact JSON-RPC field names are supported?
   - If no, implement local proxy.

2. **Schema validator in JArchi runtime**
   - Use a pure JS validator compatible with JArchi/GraalJS?
   - Or validate in proxy and return validation report + plan?
   - Recommendation: do both eventually; start with proxy or lightweight JS validator if runtime constraints are painful.

3. **Relationship type legality matrix**
   - v1 may use a simple allowlist.
   - Future versions may enforce ArchiMate-specific source/target compatibility matrix.

4. **Undo strategy**
   - v1 logs and stop-on-error only.
   - Later: optional compensating actions or snapshot/export checkpoint.

---

## 22. Recommended Next Step (Practical)

Implement **Phase 1 MVP** with a **strict plan envelope** and three operations only:
- `rename_element`
- `set_property`
- `create_relationship`

That is the smallest useful deterministic slice and will validate the architecture quickly.

---

## Appendix A — Example `needs_clarification` Plan

```json
{
  "schema_version": "1.0",
  "status": "needs_clarification",
  "summary": "Multiple elements named 'API' exist in scope.",
  "warnings": [],
  "questions": [
    "Which 'API' do you mean? Candidates: id-001 (Payments API), id-002 (Partner API)."
  ],
  "actions": []
}
```

## Appendix B — Example execution preview text

```text
Plan status: ready
Summary: Rename one element and create one serving relationship.

Actions:
1. rename_element: id-123 -> "Card Processing Engine"
2. create_relationship: Serving id-001 -> id-123
```

## Appendix C — Why this PRD aligns with the current `codexClient.js`

This PRD deliberately preserves the strengths of the current implementation:
- synchronous transport,
- thread/turn lifecycle,
- streaming handling,
- existing `ask(...)` API,
while adding a deterministic planning layer above it rather than replacing the transport. fileciteturn0file0
