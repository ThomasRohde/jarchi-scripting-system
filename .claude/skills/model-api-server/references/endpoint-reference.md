# Model API Server - Endpoint Reference

Complete reference for all HTTP endpoints exposed by the Model API Server.

Base URL: `http://localhost:8765` (configurable in `scripts/lib/server/serverConfig.js`)

## Health & Lifecycle

### GET /health

Server health check with memory, uptime, model info, and operation queue stats.

**Response 200:**
```json
{
  "status": "ok",
  "uptime": 3600,
  "memory": { "used": 128, "total": 512, "max": 1024 },
  "model": { "name": "My Model", "id": "model-id" },
  "operations": { "queued": 0, "processing": 0, "complete": 5, "error": 0 }
}
```

### GET /test

UI thread connectivity test. Returns a simple response confirming the SWT display thread is responsive.

### GET /model/diagnostics

Run model diagnostics including orphan element detection.

**Response 200:**
```json
{
  "diagnostics": {
    "orphanElements": [],
    "orphanRelationships": [],
    "modelIntegrity": "ok"
  }
}
```

### POST /shutdown

Trigger graceful server shutdown. Waits up to 10 seconds for in-flight operations.

---

## Model Read Operations

### POST /model/query

Query a snapshot of the model. Returns element and relationship summaries.

**Request body:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | integer | 10 | Max elements to return |
| `relationshipLimit` | integer | null | Max relationships to return (omit to exclude relationships) |

**Response 200:**
```json
{
  "summary": { "elements": 150, "relationships": 200, "views": 12 },
  "elements": [
    { "id": "abc-123", "name": "Customer", "type": "business-actor", "documentation": "" }
  ],
  "relationships": [
    { "id": "rel-1", "name": "", "type": "serving-relationship", "sourceId": "abc-123", "targetId": "def-456" }
  ]
}
```

### GET /model/stats

Model statistics with type-level breakdowns.

**Response 200:**
```json
{
  "summary": {
    "totalElements": 150,
    "totalRelationships": 200,
    "totalViews": 12,
    "elementTypes": 8,
    "relationshipTypes": 5,
    "viewTypes": 2
  },
  "elements": { "business-actor": 25, "business-process": 40, "application-component": 30 },
  "relationships": { "serving-relationship": 50, "composition-relationship": 30 },
  "views": { "archimate-diagram-model": 12 }
}
```

### POST /model/search

Search elements and relationships by name, type, or property.

**Request body:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `namePattern` | string | null | Regex pattern to match element names (max 256 chars) |
| `type` | string | null | Element type filter (e.g., `"business-actor"`) |
| `caseSensitive` | boolean | false | Case-sensitive name matching |
| `propertyKey` | string | null | Filter by property key |
| `propertyValue` | string | null | Filter by property value (requires `propertyKey`) |
| `includeRelationships` | boolean | true | Include relationships in results |
| `limit` | integer | 1000 | Max results (max 10000) |

**Response 200:**
```json
{
  "results": [
    { "id": "abc-123", "name": "Customer Portal", "type": "application-component", "documentation": "" }
  ],
  "total": 3,
  "criteria": { "type": "application-component", "namePattern": "Customer", "limit": 1000 }
}
```

### GET /model/element/{id}

Full details for a specific element including relationships and containing views.

**Response 200 (element):**
```json
{
  "id": "abc-123",
  "name": "Customer",
  "type": "business-actor",
  "documentation": "External customer",
  "properties": { "status": "active", "owner": "Sales" },
  "relationships": {
    "incoming": [
      { "id": "rel-1", "name": "", "type": "serving-relationship", "sourceId": "def-456",
        "otherEndId": "def-456", "otherEndName": "CRM System", "otherEndType": "application-component" }
    ],
    "outgoing": [
      { "id": "rel-2", "name": "", "type": "triggering-relationship", "targetId": "ghi-789",
        "otherEndId": "ghi-789", "otherEndName": "Order Process", "otherEndType": "business-process" }
    ]
  },
  "views": [
    { "id": "view-1", "name": "Business Overview" }
  ]
}
```

**Response 200 (relationship):**
```json
{
  "id": "rel-1",
  "name": "",
  "type": "serving-relationship",
  "documentation": "",
  "properties": {},
  "source": { "id": "def-456", "name": "CRM System", "type": "application-component" },
  "target": { "id": "abc-123", "name": "Customer", "type": "business-actor" }
}
```

**Response 404:** Element not found.

---

## Mutation Operations

### POST /model/apply

Apply changes asynchronously. Returns an operation ID for polling.

**Request body:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `changes` | array | (required) | Array of change operations (1-1000 items) |
| `duplicateStrategy` | string | `"error"` | Default duplicate handling: `"error"`, `"reuse"`, `"rename"` |
| `idempotencyKey` | string | null | Unique key for replay-safe requests (max 128 chars, pattern: `^[A-Za-z0-9:_-]+$`) |

**Response 200:**
```json
{
  "operationId": "op_1707000000000_abc",
  "status": "queued",
  "message": "Operation queued for processing. Poll /ops/status?opId=op_...",
  "digest": {
    "totals": { "requested": 3, "results": 0, "executed": 0, "skipped": 0 },
    "requestedByType": { "createElement": 2, "createRelationship": 1 },
    "integrityFlags": { "hasErrors": false, "hasSkips": false, "pending": true }
  },
  "tempIdMap": {},
  "tempIdMappings": []
}
```

**Response 409 (idempotency conflict):** Same key used with different payload.

### GET /ops/status?opId={id}

Poll the status of an async operation.

**Query parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `opId` | string | (required) | Operation ID from apply response |
| `cursor` | string | null | Cursor for paging results |
| `pageSize` | integer | 100 | Results per page |
| `summaryOnly` | boolean | false | Return digest only, no result rows |

**Response 200 (complete):**
```json
{
  "operationId": "op_...",
  "status": "complete",
  "result": [
    { "op": "createElement", "status": "created", "id": "new-id-1", "tempId": "t1", "type": "business-actor", "name": "Actor A" },
    { "op": "createRelationship", "status": "created", "id": "new-rel-1", "tempId": "t3" }
  ],
  "digest": {
    "totals": { "requested": 3, "results": 3, "executed": 3, "skipped": 0 },
    "integrityFlags": { "hasErrors": false, "hasSkips": false, "resultCountMatchesRequested": true, "pending": false }
  },
  "tempIdMap": { "t1": "new-id-1", "t2": "new-id-2", "t3": "new-rel-1" },
  "tempIdMappings": [
    { "tempId": "t1", "resolvedId": "new-id-1", "mappingType": "concept", "op": "createElement", "resultIndex": 0 }
  ],
  "durationMs": 45,
  "timeline": [
    { "status": "queued", "timestamp": "2025-01-15T10:00:00Z" },
    { "status": "processing", "timestamp": "2025-01-15T10:00:00Z" },
    { "status": "complete", "timestamp": "2025-01-15T10:00:00Z", "operationCount": 3 }
  ]
}
```

**Response 200 (error):**
```json
{
  "operationId": "op_...",
  "status": "error",
  "error": "Validation failed",
  "errorDetails": {
    "code": "UnresolvedTempId",
    "message": "tempId 't99' not found",
    "opIndex": 2,
    "path": "/changes/2",
    "op": "createRelationship",
    "field": "sourceId",
    "reference": "t99",
    "hint": "Ensure the tempId is defined in a preceding operation"
  }
}
```

### GET /ops/list

List recent operations with their statuses.

**Query parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | string | null | Filter by status: `queued`, `processing`, `complete`, `error` |
| `limit` | integer | 20 | Max operations to return |
| `cursor` | string | null | Cursor for pagination |
| `summaryOnly` | boolean | false | Compact metadata only |

### POST /model/save

Save the model to disk. If the model has never been saved, auto-generates a path under `~/Documents/archi-models/`.

**Request body:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `path` | string | null | Target file path (optional, auto-appends `.archimate` extension) |

**Response 200:**
```json
{
  "success": true,
  "message": "Model saved successfully",
  "modelName": "My Model",
  "modelId": "model-id",
  "path": "C:/Users/.../My Model.archimate",
  "durationMs": 120
}
```

---

## View Operations

### GET /views

List all views in the model with metadata.

**Response 200:**
```json
{
  "views": [
    { "id": "view-1", "name": "Business Overview", "type": "archimate-diagram-model",
      "viewpoint": "layered", "elementCount": 15, "connectionCount": 10 }
  ],
  "total": 12
}
```

### GET /views/{id}

View details including all elements and connections.

**Response 200:**
```json
{
  "id": "view-1",
  "name": "Business Overview",
  "type": "archimate-diagram-model",
  "viewpoint": "layered",
  "elements": [
    { "visualId": "vis-1", "conceptId": "abc-123", "name": "Customer", "type": "business-actor",
      "x": 50, "y": 50, "width": 120, "height": 55 }
  ],
  "connections": [
    { "connectionId": "conn-1", "relationshipId": "rel-1", "type": "serving-relationship",
      "sourceVisualId": "vis-1", "targetVisualId": "vis-2" }
  ]
}
```

### POST /views

Create a new view (synchronous, undoable).

**Request body:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | (required) | View name |
| `viewpoint` | string | null | Viewpoint ID (e.g., `"application_cooperation"`, `"layered"`) |
| `documentation` | string | null | View documentation |
| `folder` | string | null | Target folder ID |

### DELETE /views/{id}

Delete a view by ID (undoable).

### POST /views/{id}/export

Export a view as an image file.

**Request body:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `format` | string | `"png"` | Image format: `"png"` or `"jpeg"` |
| `scale` | number | 1 | Scale factor (e.g., 2 for 2x resolution) |
| `path` | string | auto-generated | Output file path |

**Response 200:**
```json
{
  "success": true,
  "path": "/tmp/view-export-abc12345.png",
  "format": "png",
  "scale": 2
}
```

### POST /views/{id}/duplicate

Duplicate an existing view (undoable).

### PUT /views/{id}/router

Set the connection router type for a view.

**Request body:**
| Field | Type | Description |
|-------|------|-------------|
| `router` | string | Router type: `"direct"`, `"manhattan"` |

### POST /views/{id}/layout

Apply automatic layout to a view.

**Request body:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `algorithm` | string | `"sugiyama"` | Layout algorithm: `"sugiyama"`, `"dagre"` |

### GET /views/{id}/validate

Validate view integrity (check for orphaned connections, missing concepts).

---

## Folder Operations

### GET /folders

List all model folders in a flat structure with hierarchy paths.

**Response 200:**
```json
{
  "folders": [
    { "id": "folder-1", "name": "Business", "path": "Business", "type": "BUSINESS",
      "elementCount": 45, "subfolderCount": 3 },
    { "id": "folder-2", "name": "Actors", "path": "Business/Actors", "type": null,
      "elementCount": 12, "subfolderCount": 0 }
  ],
  "total": 20
}
```

---

## Script Execution

### POST /scripts/run

Execute JArchi script code synchronously on the SWT display thread.

**Request body:**
| Field | Type | Description |
|-------|------|-------------|
| `code` | string | JavaScript code to execute (max 50KB) |

**Response 200 (success):**
```json
{
  "success": true,
  "output": [
    { "level": "log", "message": "Found 25 elements" },
    { "level": "log", "message": "Script summary: success=true, durationMs=45, warnings=0" }
  ],
  "files": [],
  "result": [{ "id": "abc-123", "name": "Customer", "type": "business-actor" }],
  "durationMs": 45
}
```

**Response 200 (error):**
```json
{
  "success": false,
  "error": "ReferenceError: undefinedVar is not defined",
  "output": [
    { "level": "error", "message": "ReferenceError: undefinedVar is not defined" },
    { "level": "log", "message": "Script summary: success=false, durationMs=12, warnings=0" }
  ],
  "files": [],
  "durationMs": 12
}
```

**Preamble helpers** (auto-available in script context):
- `getModel()` -- returns the server's bound model
- `findElements(type)` -- returns `[{id, name, type, documentation}]`
- `findViews(name)` -- returns `[{id, name, type}]`
- `findRelationships(type)` -- returns `[{id, name, type, sourceId, targetId}]`
- `model` -- pre-bound to the server's model
- `$()` -- auto-scoped to the server's model (no UI selection needed)
- `__scriptResult.value` -- set to return structured data
- `__scriptResult.files` -- set to return file paths

**Important:** `__DIR__` is automatically replaced with `__scriptsDir__` in API context. Use `__scriptsDir__` to load libraries.

---

## Error Responses

All endpoints use consistent error format:

```json
{
  "error": {
    "code": "ErrorCode",
    "message": "Human-readable error description"
  }
}
```

Common error codes:
- `ValidationError` (400) -- Invalid request body or parameters
- `NotFound` (404) -- Element, view, or operation not found
- `PayloadTooLarge` (413) -- Script code exceeds max length
- `IdempotencyConflict` (409) -- Same key used with different payload
- `QueryFailed` / `SearchFailed` / `SaveFailed` (500) -- Server-side errors

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| Port | 8765 | HTTP listen port |
| Host | 127.0.0.1 | Bind address (localhost only) |
| Rate limit | 600 req/min | Sliding window per client IP |
| Max body size | 1 MB | Maximum request body |
| Max changes/request | 1000 | Limit on changes in a single apply |
| Operation timeout | 60s | Max time for an async operation |
| CORS origins | localhost:3000 | Allowed CORS origins |
| Max script code | 50 KB | Maximum script code length |
