# Codex Chat

Multi-turn chat dialog for having an ongoing conversation with Codex about your ArchiMate model. Connect to a running Codex app-server, ask questions, and use slash commands to generate and apply structured change plans.

## Requirements

- An open ArchiMate model
- Codex app-server running: `codex app-server --listen ws://127.0.0.1:19000`

## Tabs

### Chat

The main conversation area. Type messages and see streaming responses from Codex. Messages are prefixed with `[You]`, `[Codex]`, `[System]`, `[Error]`, or `[Plan]` for clarity.

- **Enter** sends the message
- **Shift+Enter** inserts a newline

On the first message, the script automatically sends your model context (elements and relationships) so Codex understands what you're working with.

### Configuration

Shows the Codex server connection details and full server configuration JSON. Populated automatically on connect.

### Models

Lists the available AI models on the server with their reasoning effort settings. Populated automatically on connect.

## Slash Commands

| Command | Description |
|---------|-------------|
| `/plan <description>` | Generate a structured change plan from a natural-language description. Shows a preview of planned actions. |
| `/apply` | Execute the last generated plan. Creates elements, relationships, renames, and sets properties as planned. |
| `/clear` | Start a new conversation thread and clear the chat display. Resets model context so it will be re-sent on the next message. |
| `/context` | Show a summary of the current model (element, relationship, and view counts). |
| `/status` | Show connection info, thread ID, turn count, and pending plan status. |
| `/help` | List available slash commands. |

## Workflow Example

1. Click **Connect** to connect to the Codex server
2. Ask a question: "What application components are in this model?"
3. Follow up: "Which ones have no relationships?"
4. Create a plan: `/plan Create a serving relationship from App Server to Database`
5. Review the preview, then apply: `/apply`
6. Start fresh: `/clear`
7. Click **Close** when done (automatically disconnects)

## Plan Workflow

The `/plan` command builds a fresh planning context from the current model state, sends it to Codex with a structured output schema, validates the response, and shows a preview. The plan is held in memory until you either `/apply` it or `/clear` the session.

Each `/plan` command rebuilds the model context, so changes from a previous `/apply` are reflected in the next plan.
