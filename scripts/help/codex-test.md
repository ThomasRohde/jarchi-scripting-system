# Codex Test

Connects to a running Codex app-server, sends model context with a prompt, and logs the AI-generated summary. Useful for verifying the Codex connection and testing model context generation.

## Requirements

- An open ArchiMate model
- Codex app-server running: `codex app-server --listen ws://127.0.0.1:19000`

## What It Does

1. Connects to the Codex app-server via WebSocket
2. Builds a model context string from the first 50 elements and their relationships
3. Starts a new conversation thread with `approvalPolicy: "never"`
4. Sends a prompt asking Codex to summarize the architecture in 3-5 bullet points
5. Logs the streaming response to the console
6. Disconnects

## Output

The script logs to the JArchi console:
- Connection status and server capabilities
- Model context size (character count)
- Thread ID
- The full AI response text
- Turn status and item count

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Connection failed | Ensure `codex app-server --listen ws://127.0.0.1:19000` is running |
| Timeout | The default turn timeout is 5 minutes; large models may need more time |
| Empty response | Check that the model has elements — an empty model produces no context |
