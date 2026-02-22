# Codex Plan Apply

Sends a natural-language change request to a Codex app-server, receives a schema-validated structured plan, previews the planned actions, and applies them to the model on user confirmation.

## Requirements

- An open ArchiMate model
- Codex app-server running: `codex app-server --listen ws://127.0.0.1:19000`

## Usage

1. Run the script — a prompt dialog asks for your change request
2. Describe the changes in plain English (e.g., "Create an application component called API Gateway and connect it to the Database with a serving relationship")
3. The script connects to Codex, sends model context (up to 100 elements), and requests a structured plan
4. The plan is validated against the ArchiChangePlan schema and the live model
5. A preview of all planned actions is shown in the console
6. A confirmation dialog asks whether to apply the changes
7. On confirmation, changes are applied to the model

## Supported Operations

| Operation | Description |
|-----------|-------------|
| `create_element` | Create a new ArchiMate element of any type |
| `rename_element` | Rename an existing element or relationship |
| `set_property` | Set a property key-value pair on an element or relationship |
| `create_relationship` | Create a relationship between two elements |
| `set_documentation` | Set documentation text on an element or relationship |
| `delete_element` | Delete an element (cascades: removes attached relationships) |
| `delete_relationship` | Delete a relationship |
| `remove_property` | Remove a property from an element or relationship |
| `create_view` | Create a new ArchiMate diagram view |
| `add_to_view` | Place an element on a view (auto-grid if coordinates omitted) |
| `move_to_folder` | Move an element to a folder by `/`-separated path |

## Post-Processing

After all `add_to_view` actions are applied, the executor automatically adds visual connections for any relationships that exist between elements placed on each view. You do not need to create connections manually.

## Plan Statuses

| Status | Meaning |
|--------|---------|
| `ready` | Plan has concrete actions ready to apply |
| `needs_clarification` | Codex needs more information — questions are displayed |
| `refusal` | The request was declined with an explanation |

## Validation

Plans go through two validation levels:

1. **Schema validation** — checks structure, required fields, types, and value constraints
2. **Semantic validation** — checks element existence, ref_id consistency, relationship validity against the ArchiMate specification matrix, use-after-delete detection, and view/folder resolution

Warnings (e.g., spec-invalid relationships, cascade deletions) are shown but don't block execution. Errors (e.g., missing elements, duplicate ref_ids) prevent the plan from being applied.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Failed to extract JSON" | The AI response wasn't valid JSON — try rephrasing your request more concisely |
| "Schema validation failed" | The plan structure is invalid — this is usually an AI output issue; retry |
| "Element not found" | The plan references an element ID that doesn't exist in the model |
| "Folder not found" | The folder path doesn't match the model's folder structure |
| Connection errors | Ensure the Codex app-server is running on the expected port |
