# Model API Server

Runs an HTTP REST API server inside Archi that exposes ArchiMate model operations to external clients. All mutating operations are fully **undoable** (Ctrl+Z) via the GEF command stack. The server binds to **localhost only** with no authentication -- it is intended for local development and automation.

## Requirements

- An open ArchiMate model
- At least one view from the model must be open (required for undo/redo support via the GEF command stack)
- Port 8765 available (default; configurable in `serverConfig.js`)

## Usage

1. Open a model and at least one view in Archi
2. Run the script from the menu (confirm the danger prompt)
3. A **monitor dialog** opens showing server logs and status
4. Use `curl`, a REST client, or an MCP integration to call the API at `http://localhost:8765`
5. Click **Stop Server** in the monitor dialog to shut down gracefully

## Security

- Binds to `127.0.0.1` only -- not accessible from the network
- **No authentication** -- do not expose to external networks
- Rate limiting: 600 requests per minute (configurable)
- Max request body: 1 MB
- CORS: allowed for `localhost:3000` by default
- Security headers: `nosniff`, `DENY` frame, `no-store` cache

## API Reference

### Health & Lifecycle

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health check with uptime, model info, and operation stats |
| `GET` | `/test` | UI thread connectivity test |
| `GET` | `/model/diagnostics` | Run model diagnostics (orphan detection, etc.) |
| `POST` | `/shutdown` | Trigger graceful server shutdown |

### Model Operations

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/model/query` | Query a snapshot of the model (elements, relationships, views) |
| `GET` | `/model/stats` | Get model statistics with type breakdowns |
| `POST` | `/model/search` | Search elements and relationships by name, type, or property |
| `GET` | `/model/element/{id}` | Get full details for a specific element |
| `POST` | `/model/plan` | Generate a change plan without mutating the model |
| `POST` | `/model/apply` | Apply changes asynchronously (returns an operation ID) |
| `POST` | `/model/save` | Save the model to disk |

### Operation Tracking

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/ops/status?opId=...` | Poll the status of an async operation by ID |
| `GET` | `/ops/list` | List recent operations with their statuses |

### Views

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/views` | List all views in the model |
| `POST` | `/views` | Create a new view (synchronous, undoable) |
| `GET` | `/views/{id}` | Get view details including elements and connections |
| `DELETE` | `/views/{id}` | Delete a view |
| `POST` | `/views/{id}/export` | Export view as an image |
| `POST` | `/views/{id}/duplicate` | Duplicate a view |
| `PUT` | `/views/{id}/router` | Set the view's connection router type |
| `POST` | `/views/{id}/layout` | Apply automatic layout to a view |
| `GET` | `/views/{id}/validate` | Validate view integrity |

### Folders

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/folders` | List all model folders |

### Script Execution

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/scripts/run` | Execute JArchi script code synchronously (returns output and files) |

## Async Operations (Plan/Apply Pattern)

Mutating operations use an async pattern:

1. **Plan** -- `POST /model/plan` with your desired changes. Returns a validated change plan without modifying the model.
2. **Apply** -- `POST /model/apply` with the plan. Returns an `operationId` immediately.
3. **Poll** -- `GET /ops/status?opId=<id>` to check progress. Status progresses: `queued` -> `processing` -> `complete` or `error`.

All applied changes are executed as undoable GEF commands, so you can undo them with Ctrl+Z in Archi.

### Idempotency

`POST /model/apply` supports idempotency keys via the request body field `idempotencyKey`. If the same key is sent twice within 24 hours, the second request returns the existing operation instead of re-applying changes.

## Monitor Dialog

The monitor dialog shows:

- **Server status** -- Running/Stopped indicator with host and port
- **Log output** -- Scrolling log of all requests, operations, and errors
- **Operation count** -- Number of queued and complete operations
- **Stop Server** button -- Triggers graceful shutdown (waits up to 10 seconds for in-flight operations)

## Configuration

Server settings are defined in `lib/server/serverConfig.js`:

| Setting | Default | Description |
|---|---|---|
| Port | 8765 | HTTP listen port |
| Host | 127.0.0.1 | Bind address (localhost only) |
| Rate limit | 600 req/min | Sliding window per client IP |
| Max body size | 1 MB | Maximum request body |
| Max changes per request | 1000 | Limit on changes in a single apply |
| Operation timeout | 60 seconds | Max time for an async operation |
| CORS origins | localhost:3000 | Allowed CORS origins |

## Tips

- **Always open a view** before starting the server. The undo/redo command stack requires an open editor, and operations will fail without it.
- Use `GET /health` as a quick check that the server is responsive and the model is accessible.
- The `POST /model/query` endpoint returns a full model snapshot -- use `POST /model/search` for targeted lookups to reduce payload size.
- Script execution via `POST /scripts/run` runs synchronously on the SWT display thread. Long-running scripts will block other API requests.
- The server shuts down automatically when you close the monitor dialog.
- All model mutations go through the GEF command stack, so they appear in Archi's Edit > Undo history.
