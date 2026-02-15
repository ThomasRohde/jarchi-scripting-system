# Model API Server - Plan/Apply Change Operations

Complete reference for all change operations supported by `POST /model/apply`.

## Request Structure

```json
{
  "changes": [
    { "op": "operationType", ...fields }
  ],
  "duplicateStrategy": "error",
  "idempotencyKey": "optional-unique-key"
}
```

## TempId System

Operations can reference results from earlier operations in the same batch using `tempId`:

1. Assign a `tempId` to a create operation (e.g., `"tempId": "t1"`)
2. Reference it in subsequent operations (e.g., `"sourceId": "t1"`, `"elementId": "t1"`)
3. After completion, `tempIdMappings` in the response maps each tempId to its real ID

TempId mapping types: `concept` (element/relationship), `visual` (view object), `connection` (view connection), `view` (created view).

---

## Model Operations

### createElement

Create a new ArchiMate element.

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `op` | yes | `"createElement"` | |
| `type` | yes | string | ArchiMate element type (e.g., `"business-actor"`, `"application-component"`) |
| `name` | yes | string | Element name |
| `tempId` | no | string | Temporary ID for cross-referencing |
| `documentation` | no | string | Element documentation |
| `folder` | no | string | Target folder path or ID |

**Example:**
```json
{ "op": "createElement", "type": "business-actor", "name": "Customer", "tempId": "t1", "documentation": "External customer" }
```

**ArchiMate element types:** `business-actor`, `business-role`, `business-collaboration`, `business-interface`, `business-process`, `business-function`, `business-interaction`, `business-event`, `business-service`, `business-object`, `contract`, `representation`, `product`, `application-component`, `application-collaboration`, `application-interface`, `application-function`, `application-interaction`, `application-process`, `application-event`, `application-service`, `data-object`, `node`, `device`, `system-software`, `technology-collaboration`, `technology-interface`, `technology-function`, `technology-interaction`, `technology-process`, `technology-event`, `technology-service`, `artifact`, `communication-network`, `path`, `equipment`, `facility`, `distribution-network`, `material`, `stakeholder`, `driver`, `assessment`, `goal`, `outcome`, `principle`, `requirement`, `constraint`, `meaning`, `value`, `resource`, `capability`, `value-stream`, `course-of-action`, `implementation-event`, `work-package`, `deliverable`, `plateau`, `gap`, `grouping`, `location`, `junction`

### createOrGetElement

Create an element or return an existing match. Useful for idempotent batch operations.

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `op` | yes | `"createOrGetElement"` | |
| `create` | yes | object | Element to create: `{type, name, tempId?, documentation?, folder?, properties?}` |
| `match` | yes | object | Match criteria: `{type, name}` |
| `onDuplicate` | no | string | Override duplicate handling: `"error"`, `"reuse"`, `"rename"` |

**Example:**
```json
{
  "op": "createOrGetElement",
  "create": { "type": "business-actor", "name": "Customer", "tempId": "t1" },
  "match": { "type": "business-actor", "name": "Customer" }
}
```

### createRelationship

Create a new ArchiMate relationship between two elements.

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `op` | yes | `"createRelationship"` | |
| `type` | yes | string | Relationship type |
| `sourceId` | yes | string | Source element ID or tempId |
| `targetId` | yes | string | Target element ID or tempId |
| `name` | no | string | Relationship name |
| `tempId` | no | string | Temporary ID |

**Example:**
```json
{ "op": "createRelationship", "type": "serving-relationship", "sourceId": "t1", "targetId": "t2", "tempId": "r1" }
```

**ArchiMate relationship types:** `composition-relationship`, `aggregation-relationship`, `assignment-relationship`, `realization-relationship`, `serving-relationship`, `access-relationship`, `influence-relationship`, `triggering-relationship`, `flow-relationship`, `specialization-relationship`, `association-relationship`

### createOrGetRelationship

Create a relationship or return an existing match.

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `op` | yes | `"createOrGetRelationship"` | |
| `create` | yes | object | `{type, sourceId, targetId, tempId?, name?, documentation?, accessType?, strength?}` |
| `match` | yes | object | `{type, sourceId, targetId, accessType?, strength?}` |
| `onDuplicate` | no | string | `"error"` or `"reuse"` (no `"rename"` for relationships) |

### updateElement

Update an existing element's name, documentation, and/or properties.

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `op` | yes | `"updateElement"` | |
| `id` | yes | string | Element ID (real or tempId) |
| `name` | no | string | New name |
| `documentation` | no | string | New documentation |
| `properties` | no | object | Key-value pairs to set/update |

At least one of `name`, `documentation`, or `properties` must be provided.

**Example:**
```json
{ "op": "updateElement", "id": "abc-123", "name": "Updated Name", "properties": { "status": "active" } }
```

### updateRelationship

Update an existing relationship's name, documentation, and/or properties.

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `op` | yes | `"updateRelationship"` | |
| `id` | yes | string | Relationship ID |
| `name` | no | string | New name |
| `documentation` | no | string | New documentation |
| `properties` | no | object | Key-value pairs to set/update |

### deleteElement

Delete an element from the model.

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `op` | yes | `"deleteElement"` | |
| `id` | yes | string | Element ID |
| `cascade` | no | boolean | If true (default), also removes relationships and visual references |

### deleteRelationship

Delete a relationship from the model.

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `op` | yes | `"deleteRelationship"` | |
| `id` | yes | string | Relationship ID |

### setProperty

Set a property on an element or relationship.

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `op` | yes | `"setProperty"` | |
| `id` | yes | string | Element or relationship ID |
| `key` | yes | string | Property key |
| `value` | yes | string | Property value |

### moveToFolder

Move an element, relationship, or view to a different folder.

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `op` | yes | `"moveToFolder"` | |
| `id` | yes | string | Element, relationship, or view ID |
| `folderId` | yes | string | Target folder ID (or createFolder tempId) |

### createFolder

Create a new folder in the model.

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `op` | yes | `"createFolder"` | |
| `name` | yes | string | Folder name |
| `parentId` | * | string | Parent folder ID |
| `parentType` | * | string | Parent top-level folder type: `BUSINESS`, `APPLICATION`, `TECHNOLOGY`, `VIEWS`, etc. |
| `parentFolder` | * | string | Parent folder display name: `Business`, `Application`, `Views` |
| `documentation` | no | string | Folder documentation |
| `tempId` | no | string | Temporary ID |

*One of `parentId`, `parentType`, or `parentFolder` is required.

**Example:**
```json
{ "op": "createFolder", "name": "Customer Domain", "parentType": "BUSINESS", "tempId": "f1" }
```

---

## View Operations

### addToView

Add an element as a visual object in a view.

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `op` | yes | `"addToView"` | |
| `viewId` | yes | string | Target view ID |
| `elementId` | yes | string | Element ID or tempId |
| `tempId` | no | string | TempId for the created visual object |
| `parentVisualId` | no | string | Parent container visual ID (for nesting) |
| `x` | no | integer | X coordinate (default 100) |
| `y` | no | integer | Y coordinate (default 100) |
| `width` | no | integer | Width in pixels (-1 for default) |
| `height` | no | integer | Height in pixels (-1 for default) |
| `autoNest` | no | boolean | Auto-nest inside surrounding visuals |

**Example:**
```json
{ "op": "addToView", "viewId": "view-1", "elementId": "t1", "tempId": "v1", "x": 50, "y": 50, "width": 120, "height": 55 }
```

### addConnectionToView

Add a relationship as a visual connection between two visual objects.

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `op` | yes | `"addConnectionToView"` | |
| `viewId` | yes | string | Target view ID |
| `relationshipId` | yes | string | Relationship ID or tempId |
| `sourceVisualId` | no* | string | Source visual object ID |
| `targetVisualId` | no* | string | Target visual object ID |
| `autoResolveVisuals` | no | boolean | Auto-resolve source/target visuals from relationship endpoints |

*Required unless `autoResolveVisuals` is true.

**Example (auto-resolve):**
```json
{ "op": "addConnectionToView", "viewId": "view-1", "relationshipId": "r1", "autoResolveVisuals": true }
```

**Example (explicit):**
```json
{ "op": "addConnectionToView", "viewId": "view-1", "relationshipId": "r1", "sourceVisualId": "v1", "targetVisualId": "v2" }
```

### nestInView

Move a visual object to be a child of another visual object (for visual nesting/grouping).

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `op` | yes | `"nestInView"` | |
| `viewId` | yes | string | View ID |
| `visualId` | yes | string | Visual object ID or tempId to move |
| `parentVisualId` | yes | string | Target parent visual ID or tempId |
| `x` | no | integer | X relative to parent (default 10) |
| `y` | no | integer | Y relative to parent (default 10) |

### deleteConnectionFromView

Remove a visual connection from a view (does NOT delete the underlying relationship).

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `op` | yes | `"deleteConnectionFromView"` | |
| `viewId` | yes | string | View ID |
| `connectionId` | yes | string | Connection ID to remove |

### styleViewObject

Apply visual styling to a view object (element, note, or group).

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `op` | yes | `"styleViewObject"` | |
| `viewObjectId` | yes | string | Visual object ID |
| `fillColor` | no | string | Fill color hex (`"#FF5733"`) |
| `lineColor` | no | string | Border color hex |
| `fontColor` | no | string | Font color hex |
| `opacity` | no | integer | Fill opacity (0-255) |
| `lineWidth` | no | integer | Border width (1-10) |
| `textAlignment` | no | integer | 0=left, 1=center, 2=right |
| `textPosition` | no | integer | 0=top, 1=middle, 2=bottom |

**Example:**
```json
{ "op": "styleViewObject", "viewObjectId": "v1", "fillColor": "#E3F2FD", "fontColor": "#1565C0", "opacity": 200 }
```

### styleConnection

Apply visual styling to a connection.

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `op` | yes | `"styleConnection"` | |
| `connectionId` | yes | string | Connection ID |
| `lineColor` | no | string | Line color hex |
| `fontColor` | no | string | Font color hex |
| `lineWidth` | no | integer | Line width (1-10) |
| `textPosition` | no | integer | Label position: 0=source, 1=middle, 2=target |

### moveViewObject

Move or resize a visual object in a view.

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `op` | yes | `"moveViewObject"` | |
| `viewObjectId` | yes | string | Visual object ID |
| `x` | no | integer | New X coordinate |
| `y` | no | integer | New Y coordinate |
| `width` | no | integer | New width |
| `height` | no | integer | New height |

### createNote

Create a text annotation (note) in a view.

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `op` | yes | `"createNote"` | |
| `viewId` | yes | string | Target view ID |
| `content` | yes | string | Note text content |
| `tempId` | no | string | Temporary ID |
| `x` | no | integer | X coordinate (default 100) |
| `y` | no | integer | Y coordinate (default 100) |
| `width` | no | integer | Width (default 200) |
| `height` | no | integer | Height (default 100) |

### createGroup

Create a visual group in a view.

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `op` | yes | `"createGroup"` | |
| `viewId` | yes | string | Target view ID |
| `name` | yes | string | Group label |
| `tempId` | no | string | Temporary ID |
| `x` | no | integer | X coordinate (default 100) |
| `y` | no | integer | Y coordinate (default 100) |
| `width` | no | integer | Width (default 400) |
| `height` | no | integer | Height (default 300) |

**Example:**
```json
{ "op": "createGroup", "viewId": "view-1", "name": "Business Layer", "tempId": "g1", "x": 20, "y": 20, "width": 500, "height": 300 }
```

### createView

Create a new view in the model (via changes batch).

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `op` | yes | `"createView"` | |
| `name` | yes | string | View name |
| `tempId` | no | string | Temporary ID for referencing in subsequent addToView operations |
| `documentation` | no | string | View documentation |
| `viewpoint` | no | string | Viewpoint ID (e.g., `"application_cooperation"`, `"layered"`) |

**Example:**
```json
{ "op": "createView", "name": "Application Landscape", "tempId": "view-t1", "viewpoint": "application_cooperation" }
```

### deleteView

Delete a view by ID.

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `op` | yes | `"deleteView"` | |
| `viewId` | yes | string | View ID to delete |

---

## Complete Batch Example

Create elements, relationships, a view, and populate it — all in a single batch:

```json
{
  "changes": [
    { "op": "createElement", "type": "business-actor", "name": "Customer", "tempId": "t1" },
    { "op": "createElement", "type": "business-process", "name": "Order Process", "tempId": "t2" },
    { "op": "createElement", "type": "application-component", "name": "Order System", "tempId": "t3" },
    { "op": "createRelationship", "type": "triggering-relationship", "sourceId": "t1", "targetId": "t2", "tempId": "r1" },
    { "op": "createRelationship", "type": "serving-relationship", "sourceId": "t3", "targetId": "t2", "tempId": "r2" },
    { "op": "createView", "name": "Order Overview", "tempId": "v0", "viewpoint": "layered" },
    { "op": "createGroup", "viewId": "v0", "name": "Business Layer", "tempId": "g1", "x": 20, "y": 20, "width": 500, "height": 200 },
    { "op": "createGroup", "viewId": "v0", "name": "Application Layer", "tempId": "g2", "x": 20, "y": 240, "width": 500, "height": 150 },
    { "op": "addToView", "viewId": "v0", "elementId": "t1", "tempId": "vis1", "x": 50, "y": 50, "parentVisualId": "g1" },
    { "op": "addToView", "viewId": "v0", "elementId": "t2", "tempId": "vis2", "x": 250, "y": 50, "parentVisualId": "g1" },
    { "op": "addToView", "viewId": "v0", "elementId": "t3", "tempId": "vis3", "x": 150, "y": 50, "parentVisualId": "g2" },
    { "op": "addConnectionToView", "viewId": "v0", "relationshipId": "r1", "autoResolveVisuals": true },
    { "op": "addConnectionToView", "viewId": "v0", "relationshipId": "r2", "autoResolveVisuals": true },
    { "op": "createNote", "viewId": "v0", "content": "Generated via API", "x": 400, "y": 400, "width": 150, "height": 40 }
  ],
  "duplicateStrategy": "reuse",
  "idempotencyKey": "order-overview-setup-v1"
}
```

This single batch creates 3 elements, 2 relationships, 1 view with 2 groups, places all elements in their groups, draws connections, and adds an annotation — all as a single undoable action.

---

## Duplicate Strategy Details

| Strategy | Behavior |
|----------|----------|
| `"error"` | Fail the operation if a same-type/same-name element already exists (default) |
| `"reuse"` | Return the existing element ID instead of creating a new one |
| `"rename"` | Create with auto-suffixed name (e.g., "Actor (2)") |

Precedence: per-operation `onDuplicate` > request-level `duplicateStrategy` > default `"error"`.

## Idempotency Details

- Include `"idempotencyKey"` in the request body (max 128 chars, alphanumeric + `:_-`)
- First request with a key: processes normally, stores the result
- Replay within 24 hours with same key and same payload: returns cached result with `idempotency.replayed: true`
- Same key but different payload: returns `409 IdempotencyConflict`
- Keys expire after 24 hours

## Operation Result Statuses

Individual operation results have a `status` field:
- `"created"` -- element/relationship/view was created
- `"reused"` -- existing element matched and returned (via `"reuse"` strategy)
- `"renamed"` -- created with auto-suffixed name (via `"rename"` strategy)
- `"skipped"` -- operation was skipped (with `skipReason`)
- `"updated"` -- element/relationship was updated
- `"deleted"` -- element/relationship was deleted
- `"moved"` -- element was moved to folder
- `"added"` -- visual object or connection added to view
- `"nested"` -- visual object nested inside parent
- `"styled"` -- visual styling applied
