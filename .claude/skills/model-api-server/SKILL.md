---
name: model-api-server
description: This skill should be used when the user asks to "use the model API server", "call the API", "query the model via HTTP", "create elements via API", "use curl with Archi", "interact with the REST API", "use the plan/apply pattern", "plan and apply changes", "run a script via API", "export a view via API", "search elements via HTTP", mentions the Model API Server, REST endpoints, or HTTP-based model operations against the JArchi server running on localhost:8765.
---

# Model API Server

Guide for interacting with the JArchi Model API Server — an HTTP REST API running inside Archi that exposes ArchiMate model operations to external clients.

## Overview

The Model API Server runs on `http://localhost:8765` (default) inside Archi's JVM. It provides read/write access to ArchiMate models via HTTP. All mutations are undoable (Ctrl+Z) through the GEF command stack.

**Prerequisites before calling any endpoint:**
- An ArchiMate model must be open in Archi
- At least one view from the model must be open (required for undo/redo)
- The "Model API Server" script must be running (starts the HTTP listener)
- Port 8765 must be available

**Security:** Binds to `127.0.0.1` only, no authentication. For local development and automation only.

## Endpoint Categories

### Health & Lifecycle

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/health` | Health check with uptime, memory, model info |
| `GET` | `/test` | UI thread connectivity test |
| `GET` | `/model/diagnostics` | Run model diagnostics (orphan detection) |
| `POST` | `/shutdown` | Graceful server shutdown |

### Read Operations

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/model/query` | Full model snapshot (elements, relationships, views) |
| `GET` | `/model/stats` | Model statistics with type breakdowns |
| `POST` | `/model/search` | Search by name pattern, type, or property |
| `GET` | `/model/element/{id}` | Full element details with relationships and views |
| `GET` | `/views` | List all views |
| `GET` | `/views/{id}` | View details with elements and connections |
| `GET` | `/folders` | List all model folders |

### Mutation Operations (Plan/Apply)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/model/apply` | Apply changes asynchronously (returns operation ID) |
| `GET` | `/ops/status?opId=...` | Poll async operation status |
| `GET` | `/ops/list` | List recent operations |
| `POST` | `/model/save` | Save model to disk |

### View Operations

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/views` | Create a new view |
| `DELETE` | `/views/{id}` | Delete a view |
| `POST` | `/views/{id}/export` | Export view as PNG/JPEG image |
| `POST` | `/views/{id}/duplicate` | Duplicate a view |
| `PUT` | `/views/{id}/router` | Set connection router type |
| `POST` | `/views/{id}/layout` | Apply automatic layout |
| `GET` | `/views/{id}/validate` | Validate view integrity |

### Script Execution

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/scripts/run` | Execute JArchi script code synchronously |

## Plan/Apply Pattern (Mutations)

All model mutations use `POST /model/apply` with a `changes` array. Each change has an `op` field:

**Model operations:** `createElement`, `createOrGetElement`, `createRelationship`, `createOrGetRelationship`, `updateElement`, `updateRelationship`, `deleteElement`, `deleteRelationship`, `setProperty`, `moveToFolder`, `createFolder`

**View operations:** `addToView`, `addConnectionToView`, `nestInView`, `deleteConnectionFromView`, `styleViewObject`, `styleConnection`, `moveViewObject`, `createNote`, `createGroup`, `createView`, `deleteView`

### Workflow

1. **Apply** -- `POST /model/apply` with `{ "changes": [...] }`. Returns `operationId` immediately.
2. **Poll** -- `GET /ops/status?opId=<id>` until status is `complete` or `error`.
3. **Undo** -- All changes appear in Archi's Edit > Undo menu.

### TempId Cross-referencing

Operations within a single batch can reference each other using `tempId`:

```json
{
  "changes": [
    { "op": "createElement", "type": "business-actor", "name": "Actor A", "tempId": "t1" },
    { "op": "createElement", "type": "business-process", "name": "Process B", "tempId": "t2" },
    { "op": "createRelationship", "type": "serving-relationship", "sourceId": "t1", "targetId": "t2", "tempId": "t3" },
    { "op": "addToView", "viewId": "view-id-here", "elementId": "t1", "tempId": "v1", "x": 50, "y": 50 },
    { "op": "addToView", "viewId": "view-id-here", "elementId": "t2", "tempId": "v2", "x": 300, "y": 50 },
    { "op": "addConnectionToView", "viewId": "view-id-here", "relationshipId": "t3", "autoResolveVisuals": true }
  ]
}
```

The response includes `tempIdMappings` that map each `tempId` to its resolved real ID.

### Duplicate Handling

Set `duplicateStrategy` at the request level or `onDuplicate` per-operation:
- `"error"` (default) -- fail if a same-type/same-name element exists
- `"reuse"` -- return the existing element instead of creating a new one
- `"rename"` -- auto-rename with a suffix (e.g., "Actor (2)")

### Idempotency

Include `"idempotencyKey": "unique-key"` in the apply request body. Replaying the same key within 24 hours returns the existing operation result instead of re-applying.

## Script Execution via API

`POST /scripts/run` executes JArchi code on the SWT display thread:

```json
{ "code": "var elements = findElements('business-actor'); __scriptResult.value = elements;" }
```

**Preamble helpers** available in API-executed scripts (no need to load libraries):
- `getModel()` -- get the server's bound model
- `findElements(type)` -- find elements (returns array of `{id, name, type, documentation}`)
- `findViews(name)` -- find views
- `findRelationships(type)` -- find relationships
- `model` -- pre-bound to the server's model
- `$()` -- auto-scoped to the server's model
- `__scriptResult.value` -- set return value
- `__scriptResult.files` -- set output file paths

**Limitation:** JArchi proxy mutators fail in API script context because `CommandHandler.compoundcommands` is null:
- `element.name = "..."` — NPE
- `el.prop(key, value)` — NPE from `CommandHandler.executeCommand`
- Use `/model/apply` with `updateElement`/`setProperty` for single changes
- For **bulk property updates**, raw EMF in `/scripts/run` is most reliable:
  ```javascript
  var el = ArchimateModelUtils.getObjectByID(model, id);
  var props = el.getProperties();
  for (var i = 0; i < props.size(); i++) {
      if (props.get(i).getKey().equals(key)) { props.get(i).setValue(val); return; }
  }
  // Add new property if not found
  var p = IArchimateFactory.eINSTANCE.createProperty();
  p.setKey(key); p.setValue(val); props.add(p);
  ```
  Note: raw EMF mutations bypass the undo stack (not Ctrl+Z undoable).

**Path note:** `__DIR__` is automatically replaced with `__scriptsDir__` in API-executed scripts. Use `__scriptsDir__` when loading libraries (e.g., `load(__scriptsDir__ + "lib/log.js")`).

## Common curl Patterns

```bash
# Health check
curl http://localhost:8765/health

# Search elements by name
curl -X POST http://localhost:8765/model/search \
  -H "Content-Type: application/json" \
  -d '{"namePattern": "Customer", "type": "business-actor"}'

# Create an element
curl -X POST http://localhost:8765/model/apply \
  -H "Content-Type: application/json" \
  -d '{"changes": [{"op": "createElement", "type": "business-process", "name": "New Process"}]}'

# Poll operation status
curl "http://localhost:8765/ops/status?opId=op_1234567890"

# Export view as PNG
curl -X POST http://localhost:8765/views/VIEW_ID/export \
  -H "Content-Type: application/json" \
  -d '{"format": "png", "scale": 2}'
```

## Critical Constraints

- **Always open a view** before starting the server — the undo/redo command stack requires an open editor
- Use `POST /model/search` for targeted lookups instead of `POST /model/query` (which returns the full snapshot)
- `POST /scripts/run` runs **synchronously** on the SWT display thread — long-running scripts block other API requests
- Rate limit: 600 requests/minute. Max request body: 1 MB. Max changes per apply: 1000.
- The full OpenAPI 3.1 specification is in `context/openapi.yaml`

## Reference Files

For detailed endpoint schemas and operation specifications, consult these files in this skill's directory:

- **`references/endpoint-reference.md`** -- Consult when constructing API requests: full request/response schemas, query parameters, and example responses for every endpoint
- **`references/plan-apply-operations.md`** -- Consult when building `changes` arrays for `/model/apply`: all 21 change operation types with field descriptions, type enums, and a complete batch example
