# Codex Chat

Multi-turn chat dialog for having an ongoing conversation with Codex about your ArchiMate model. Connect to a running Codex app-server, ask questions, switch models, and use slash commands to generate and apply structured change plans.

## Requirements

- An open ArchiMate model
- Codex app-server running: `codex app-server --listen ws://127.0.0.1:19000`

## Tabs

### Chat

The main conversation area. Type messages and see streaming responses from Codex. Messages are prefixed with `[You]`, `[Codex]`, `[System]`, `[Error]`, or `[Plan]` for clarity.

- **Ctrl+Enter** sends the message
- **Enter** inserts a newline (multi-line input)
- Type `/` to see an autocomplete popup of available commands
- **Arrow Up/Down** navigates the autocomplete popup, **Enter** selects, **Esc** dismisses

On the first message, the script automatically sends your model context (elements and relationships) so Codex understands what you're working with.

### Configuration

Shows the Codex server connection details (status, URL, thread, active model, reasoning effort) and a structured tree view of the server configuration (model settings, profiles, MCP servers, features). Automatically updated on connect and after model switches.

### Models

Lists the available AI models on the server with display name, default reasoning effort, input modalities, and upgrade path. Populated automatically on connect.

## Slash Commands

| Command | Description |
|---------|-------------|
| `/plan <description>` | Generate a structured change plan from a natural-language description. Shows a preview of planned actions. |
| `/apply` | Execute the last generated plan. Creates elements, relationships, renames, and sets properties as planned. |
| `/clear` | Start a new conversation thread and clear the chat display. Resets model context so it will be re-sent on the next message. |
| `/context` | Show a summary of the current model (element, relationship, and view counts). |
| `/model` | Switch the active model and reasoning effort. Opens a two-step picker: first select a model, then select a reasoning effort level. Starts a new thread with the chosen settings. Press Esc in the effort picker to go back to the model picker. |
| `/status` | Show connection info, active model, thread ID, turn count, and pending plan status. |
| `/help` | List available slash commands. |

## Workflow Example

1. Click **Connect** to connect to the Codex server
2. Ask a question: "What application components are in this model?"
3. Follow up: "Which ones have no relationships?"
4. Switch model if needed: `/model` → pick a model → pick reasoning effort
5. Create a plan: `/plan Create a serving relationship from App Server to Database`
6. Review the preview, then apply: `/apply`
7. Start fresh: `/clear`
8. Click **Close** when done (automatically disconnects)

## Plan Workflow

The `/plan` command builds a fresh planning context from the current model state, sends it to Codex with a structured output schema, validates the response, and shows a preview. The plan is held in memory until you either `/apply` it or `/clear` the session.

Each `/plan` command rebuilds the model context, so changes from a previous `/apply` are reflected in the next plan.
