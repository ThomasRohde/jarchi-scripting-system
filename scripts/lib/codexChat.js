/**
 * @module codexChat
 * @description Multi-turn chat dialog for conversing with Codex about the ArchiMate model.
 *
 * Features:
 * - Rich HTML chat display with markdown rendering (via Browser widget)
 * - Streaming responses with live text + cursor, finalized as formatted markdown/JSON
 * - Three tabs: Chat, Configuration, Models
 * - Slash commands: /plan, /apply, /clear, /context, /help, /status
 * - Plan integration via codexClient.askPlan() and planExecutor.execute()
 * - Dual-mode fallback: plain Text widget if Browser is unavailable
 *
 * Dependencies (must be loaded before this module):
 *   log, swtImports, codexClient, planValidator, planExecutor, marked (vendor/marked/marked-sync.js)
 *
 * Usage:
 *   load(__DIR__ + "vendor/marked/marked-sync.js");
 *   load(__DIR__ + "lib/codexChat.js");
 *   codexChat.open();
 *
 * @version 2.0.0
 * @author Thomas Rohde
 */
(function () {
    "use strict";
    if (typeof globalThis !== "undefined" && typeof globalThis.codexChat !== "undefined") return;

    // ── SWT imports ──────────────────────────────────────────────────────
    var swt = (typeof swtImports !== "undefined") ? swtImports : null;
    if (!swt) throw new Error("codexChat: swtImports must be loaded first");

    var SWT = swt.SWT;
    var Composite = swt.Composite;
    var Label = swt.Label;
    var Text = swt.Text;
    var Button = swt.Button;
    var Group = swt.Group;
    var Table = swt.Table;
    var TableItem = swt.TableItem;
    var TableColumn = swt.TableColumn;
    var TabFolder = swt.TabFolder;
    var TabItem = swt.TabItem;
    var Display = swt.Display;
    var Point = swt.Point;
    var GridData = swt.GridData;
    var GridDataFactory = swt.GridDataFactory;
    var GridLayoutFactory = swt.GridLayoutFactory;
    var IDialogConstants = swt.IDialogConstants;
    var ExtendedTitleAreaDialog = swt.ExtendedTitleAreaDialog;
    var Browser = swt.Browser;

    // ── Custom button IDs ────────────────────────────────────────────────
    var CONNECT_ID = IDialogConstants.CLIENT_ID + 1;
    var DISCONNECT_ID = IDialogConstants.CLIENT_ID + 2;
    var CLOSE_ID = IDialogConstants.CANCEL_ID;

    // ── Timestamp helper ─────────────────────────────────────────────────
    var SimpleDateFormat = Java.type("java.text.SimpleDateFormat");
    var JavaDate = Java.type("java.util.Date");

    function _timestamp() {
        var fmt = new SimpleDateFormat("HH:mm:ss");
        return String(fmt.format(new JavaDate()));
    }

    // ── Main dialog function ─────────────────────────────────────────────

    function open() {
        var display = Display.getCurrent();
        var parentShell = display.getActiveShell();

        // ── State ────────────────────────────────────────────────────────
        var state = {
            connected: false,
            threadId: null,
            turnCount: 0,
            modelContextSent: false,
            lastPlan: null,
            busy: false
        };

        // ── Widget refs ──────────────────────────────────────────────────
        var w = {
            chatDisplay: null,
            chatBrowser: null,
            inputField: null,
            sendButton: null,
            connectBtn: null,
            disconnectBtn: null,
            configText: null,
            modelsTable: null,
            statusLabel: null,
            urlLabel: null,
            threadLabel: null
        };

        // ── Message data model ───────────────────────────────────────────
        var messages = [];
        var streamingMsgId = null;
        var nextMsgId = 1;

        function createMessage(role, text) {
            var msg = {
                id: "msg-" + (nextMsgId++),
                role: role,
                text: text || "",
                timestamp: _timestamp(),
                streaming: false
            };
            messages.push(msg);
            return msg;
        }

        function findMessage(id) {
            for (var i = messages.length - 1; i >= 0; i--) {
                if (messages[i].id === id) return messages[i];
            }
            return null;
        }

        // ── Utility functions ────────────────────────────────────────────

        function escapeForJs(str) {
            return String(str)
                .replace(/\\/g, "\\\\")
                .replace(/'/g, "\\'")
                .replace(/\n/g, "\\n")
                .replace(/\r/g, "\\r")
                .replace(/\t/g, "\\t");
        }

        function htmlEscape(text) {
            return String(text)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;");
        }

        function renderMarkdown(text) {
            if (typeof marked !== "undefined" && marked.parse) {
                try {
                    return marked.parse(text);
                } catch (e) {
                    return "<pre>" + htmlEscape(text) + "</pre>";
                }
            }
            return "<pre>" + htmlEscape(text) + "</pre>";
        }

        function highlightJson(json) {
            var html = "";
            var i = 0;
            while (i < json.length) {
                var c = json.charAt(i);
                if (c === '"') {
                    var s = i;
                    i++;
                    while (i < json.length) {
                        if (json.charAt(i) === '\\') { i += 2; continue; }
                        if (json.charAt(i) === '"') { i++; break; }
                        i++;
                    }
                    var tok = htmlEscape(json.substring(s, i));
                    var la = i;
                    while (la < json.length && json.charAt(la) === ' ') la++;
                    if (la < json.length && json.charAt(la) === ':') {
                        html += '<span class="json-key">' + tok + '</span>';
                    } else {
                        html += '<span class="json-string">' + tok + '</span>';
                    }
                } else if (c === '-' || (c >= '0' && c <= '9')) {
                    var ns = i;
                    while (i < json.length && '-0123456789.eE+'.indexOf(json.charAt(i)) >= 0) i++;
                    html += '<span class="json-number">' + json.substring(ns, i) + '</span>';
                } else if (json.substring(i, i + 4) === 'true') {
                    html += '<span class="json-bool">true</span>';
                    i += 4;
                } else if (json.substring(i, i + 5) === 'false') {
                    html += '<span class="json-bool">false</span>';
                    i += 5;
                } else if (json.substring(i, i + 4) === 'null') {
                    html += '<span class="json-null">null</span>';
                    i += 4;
                } else {
                    html += htmlEscape(c);
                    i++;
                }
            }
            return html;
        }

        function tryFormatJson(text) {
            var trimmed = text.trim();
            if (trimmed.charAt(0) !== '{' && trimmed.charAt(0) !== '[') return null;
            try {
                var parsed = JSON.parse(trimmed);
                var pretty = JSON.stringify(parsed, null, 2);
                return '<pre class="json-block">' + highlightJson(pretty) + '</pre>';
            } catch (e) {
                return null;
            }
        }

        // ── HTML template ────────────────────────────────────────────────

        function buildInitialHtml() {
            return [
                "<!DOCTYPE html>",
                "<html><head><meta charset='utf-8'>",
                "<style>",
                "* { box-sizing: border-box; }",
                "body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
                "  font-size: 13px; line-height: 1.5; color: #333; padding: 0; margin: 0; background: #f5f5f5; }",
                "#chat { padding: 8px; }",
                ".msg { margin: 0 0 8px 0; padding: 8px 12px; border-radius: 8px; }",
                ".msg-header { font-size: 11px; font-weight: 600; margin-bottom: 4px; opacity: 0.7; }",
                ".msg-body { word-wrap: break-word; overflow-wrap: break-word; }",
                ".msg-user { background: #dbeafe; border: 1px solid #93c5fd; }",
                ".msg-user .msg-header { color: #1e40af; }",
                ".msg-assistant { background: #ffffff; border: 1px solid #e5e7eb; }",
                ".msg-assistant .msg-header { color: #374151; }",
                ".msg-system { background: #f3f4f6; border: 1px solid #d1d5db; }",
                ".msg-system .msg-header { color: #6b7280; }",
                ".msg-system .msg-body { color: #6b7280; font-style: italic; }",
                ".msg-error { background: #fef2f2; border: 1px solid #fca5a5; }",
                ".msg-error .msg-header { color: #991b1b; }",
                ".msg-error .msg-body { color: #991b1b; }",
                ".msg-plan { background: #fffbeb; border: 1px solid #fcd34d; }",
                ".msg-plan .msg-header { color: #92400e; }",
                ".msg-plan .msg-body { color: #78350f; }",
                ".msg-body h1, .msg-body h2, .msg-body h3, .msg-body h4 { margin: 8px 0 4px 0; font-style: normal; }",
                ".msg-body h1 { font-size: 18px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }",
                ".msg-body h2 { font-size: 15px; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; }",
                ".msg-body h3 { font-size: 13px; }",
                ".msg-body p { margin: 4px 0; }",
                ".msg-body code { background: #f0f0f0; padding: 1px 4px; border-radius: 3px; font-size: 12px;",
                "  font-family: Consolas, Monaco, monospace; }",
                ".msg-body pre { background: #1e1e1e; color: #d4d4d4; padding: 10px; border-radius: 6px;",
                "  overflow-x: auto; margin: 6px 0; font-style: normal; }",
                ".msg-body pre code { background: none; padding: 0; color: inherit; }",
                ".msg-body table { border-collapse: collapse; width: 100%; margin: 8px 0; font-style: normal; }",
                ".msg-body th, .msg-body td { border: 1px solid #d0d7de; padding: 4px 8px; text-align: left; }",
                ".msg-body th { background: #f6f8fa; font-weight: 600; }",
                ".msg-body blockquote { border-left: 3px solid #d0d7de; margin: 8px 0; padding: 2px 12px; color: #656d76; }",
                ".msg-body ul, .msg-body ol { padding-left: 20px; margin: 4px 0; }",
                ".msg-body a { color: #0969da; text-decoration: none; }",
                ".msg-body hr { border: none; border-top: 1px solid #d0d7de; margin: 12px 0; }",
                ".msg-body strong { font-style: normal; }",
                ".json-block { background: #1e1e1e; color: #d4d4d4; padding: 10px; border-radius: 6px;",
                "  overflow-x: auto; margin: 6px 0; font-family: Consolas, Monaco, monospace; font-size: 12px; }",
                ".json-key { color: #9cdcfe; }",
                ".json-string { color: #ce9178; }",
                ".json-number { color: #b5cea8; }",
                ".json-bool { color: #569cd6; }",
                ".json-null { color: #569cd6; }",
                ".streaming { background: transparent; color: #333; padding: 0; margin: 4px 0;",
                "  white-space: pre-wrap; word-wrap: break-word;",
                "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; line-height: 1.5; }",
                "@keyframes pulse { 0%,100% { opacity: .3; } 50% { opacity: 1; } }",
                ".thinking { color: #9ca3af; font-style: italic; padding: 4px 0; }",
                ".thinking-dots { animation: pulse 1.4s ease-in-out infinite; }",
                "</style>",
                "</head>",
                "<body>",
                "<div id='chat'></div>",
                "<script>",
                "function addMessage(id, role, ts, bodyHtml) {",
                "  var chat = document.getElementById('chat');",
                "  var div = document.createElement('div');",
                "  div.className = 'msg msg-' + role;",
                "  div.id = id;",
                "  var labels = {user:'You',assistant:'Codex',system:'System',error:'Error',plan:'Plan'};",
                "  var roleLabel = labels[role] || role;",
                "  div.innerHTML = '<div class=\"msg-header\">' + roleLabel + ' \\u00b7 ' + ts + '</div>' +",
                "    '<div class=\"msg-body\" id=\"body-' + id + '\">' + bodyHtml + '</div>';",
                "  chat.appendChild(div);",
                "  scrollBottom();",
                "}",
                "function appendStreamText(id, text) {",
                "  var body = document.getElementById('body-' + id);",
                "  if (!body) return;",
                "  var thinking = body.querySelector('.thinking');",
                "  if (thinking) {",
                "    body.innerHTML = '<div class=\"streaming\">' + text + '</div>';",
                "    scrollBottom();",
                "    return;",
                "  }",
                "  var el = body.querySelector('.streaming');",
                "  if (!el) return;",
                "  el.appendChild(document.createTextNode(text));",
                "  scrollBottom();",
                "}",
                "function finalizeMessage(id, html) {",
                "  var body = document.getElementById('body-' + id);",
                "  if (!body) return;",
                "  body.innerHTML = html;",
                "  scrollBottom();",
                "}",
                "function clearAll() {",
                "  var chat = document.getElementById('chat');",
                "  if (chat) chat.innerHTML = '';",
                "}",
                "function scrollBottom() {",
                "  window.scrollTo(0, document.body.scrollHeight);",
                "}",
                "</script>",
                "</body></html>"
            ].join("\n");
        }

        // ── Browser DOM bridge functions ─────────────────────────────────

        function browserAddMessage(role, text) {
            var msg = createMessage(role, text);
            var bodyHtml;
            if (role === "assistant") {
                var jsonHtml = tryFormatJson(text);
                bodyHtml = jsonHtml || renderMarkdown(text);
            } else {
                bodyHtml = htmlEscape(text).replace(/\n/g, "<br>");
            }
            w.chatBrowser.execute(
                "addMessage('" + escapeForJs(msg.id) + "','" + escapeForJs(role) +
                "','" + escapeForJs(msg.timestamp) + "','" + escapeForJs(bodyHtml) + "')"
            );
            return msg;
        }

        function browserStartStreaming(role) {
            var msg = createMessage(role, "");
            msg.streaming = true;
            streamingMsgId = msg.id;
            var bodyHtml = '<div class="thinking"><span class="thinking-dots">\u2022 \u2022 \u2022</span> Thinking\u2026</div>';
            w.chatBrowser.execute(
                "addMessage('" + escapeForJs(msg.id) + "','" + escapeForJs(role) +
                "','" + escapeForJs(msg.timestamp) + "','" + escapeForJs(bodyHtml) + "')"
            );
            return msg;
        }

        function browserAppendDelta(delta) {
            if (!streamingMsgId) return;
            var msg = findMessage(streamingMsgId);
            if (msg) msg.text += delta;
            w.chatBrowser.execute(
                "appendStreamText('" + escapeForJs(streamingMsgId) + "','" + escapeForJs(delta) + "')"
            );
        }

        function browserFinalizeStreaming() {
            if (!streamingMsgId) return;
            var msg = findMessage(streamingMsgId);
            if (!msg) { streamingMsgId = null; return; }
            msg.streaming = false;
            var text = msg.text;
            var bodyHtml;
            if (text.trim()) {
                var jsonHtml = tryFormatJson(text);
                bodyHtml = jsonHtml || renderMarkdown(text);
            } else {
                bodyHtml = '<p style="color:#999;font-style:italic;">(no response)</p>';
            }
            w.chatBrowser.execute(
                "finalizeMessage('" + escapeForJs(streamingMsgId) + "','" + escapeForJs(bodyHtml) + "')"
            );
            streamingMsgId = null;
        }

        function browserClear() {
            messages = [];
            streamingMsgId = null;
            w.chatBrowser.execute("clearAll()");
        }

        // ── Chat display helpers (dual-mode) ─────────────────────────────

        var ROLE_MAP = {
            "[You]": "user",
            "[Codex]": "assistant",
            "[System]": "system",
            "[Error]": "error",
            "[Plan]": "plan"
        };

        function appendChat(prefix, text) {
            if (w.chatBrowser && !w.chatBrowser.isDisposed()) {
                var role = ROLE_MAP[prefix] || "system";
                browserAddMessage(role, text);
            } else if (w.chatDisplay && !w.chatDisplay.isDisposed()) {
                var ts = _timestamp();
                var line = "[" + ts + "] " + prefix + " " + text + "\n";
                w.chatDisplay.append(line);
                w.chatDisplay.setTopIndex(w.chatDisplay.getLineCount() - 1);
            }
        }

        function appendRaw(text) {
            if (w.chatBrowser && !w.chatBrowser.isDisposed()) {
                browserAppendDelta(text);
            } else if (w.chatDisplay && !w.chatDisplay.isDisposed()) {
                w.chatDisplay.append(text);
                w.chatDisplay.setTopIndex(w.chatDisplay.getLineCount() - 1);
            }
        }

        // ── UI state management ──────────────────────────────────────────

        function updateUI() {
            if (w.connectBtn && !w.connectBtn.isDisposed()) {
                w.connectBtn.setEnabled(!state.connected && !state.busy);
            }
            if (w.disconnectBtn && !w.disconnectBtn.isDisposed()) {
                w.disconnectBtn.setEnabled(state.connected && !state.busy);
            }
            if (w.sendButton && !w.sendButton.isDisposed()) {
                w.sendButton.setEnabled(state.connected && !state.busy);
            }
            if (w.inputField && !w.inputField.isDisposed()) {
                w.inputField.setEnabled(state.connected && !state.busy);
            }
            if (w.statusLabel && !w.statusLabel.isDisposed()) {
                w.statusLabel.setText(state.connected ? "Connected" : "Disconnected");
            }
            if (w.threadLabel && !w.threadLabel.isDisposed()) {
                w.threadLabel.setText(state.threadId || "\u2014");
            }
        }

        // ── Connect / Disconnect ─────────────────────────────────────────

        function doConnect() {
            state.busy = true;
            updateUI();
            try {
                codexClient.connect();
                state.connected = true;

                var thread = codexClient.startThread({ approvalPolicy: "never" });
                state.threadId = thread.id;
                state.turnCount = 0;
                state.modelContextSent = false;
                state.lastPlan = null;

                myDialog.dialog.setMessage("Connected \u2014 ready to chat", 0);

                // Welcome message with help
                if (w.chatBrowser && !w.chatBrowser.isDisposed()) {
                    var welcomeMd = "**Connected to Codex** \u2014 Thread: `" + thread.id + "`\n\n" +
                        "Ask questions about your ArchiMate model, or use commands:\n\n" +
                        "| Command | Description |\n" +
                        "|---------|-------------|\n" +
                        "| `/plan <description>` | Generate a structured change plan |\n" +
                        "| `/apply` | Execute the last generated plan |\n" +
                        "| `/clear` | Start a new conversation thread |\n" +
                        "| `/context` | Show model context summary |\n" +
                        "| `/status` | Show connection and thread info |\n" +
                        "| `/help` | Show this help message |\n\n" +
                        "Model context is automatically included with your first message.";
                    var msg = createMessage("system", welcomeMd);
                    var bodyHtml = '<div style="font-style:normal;">' + renderMarkdown(welcomeMd) + '</div>';
                    w.chatBrowser.execute(
                        "addMessage('" + escapeForJs(msg.id) + "','system','" +
                        escapeForJs(msg.timestamp) + "','" + escapeForJs(bodyHtml) + "')"
                    );
                } else {
                    appendChat("[System]", "Connected to Codex. Thread: " + thread.id);
                    appendChat("[System]", "Type a message to chat, or /help for commands.");
                }

                populateConfigTab();
                populateModelsTab();
            } catch (e) {
                appendChat("[Error]", "Connection failed: " + e.message);
                myDialog.dialog.setMessage("Connection failed", 3);
                state.connected = false;
            }
            state.busy = false;
            updateUI();
            if (state.connected && w.inputField && !w.inputField.isDisposed()) {
                w.inputField.setFocus();
            }
        }

        function doDisconnect() {
            try {
                codexClient.disconnect();
            } catch (e) { /* ignore */ }
            state.connected = false;
            state.threadId = null;
            state.lastPlan = null;
            appendChat("[System]", "Disconnected.");
            myDialog.dialog.setMessage("Disconnected", 0);
            updateUI();
        }

        // ── Config tab population ────────────────────────────────────────

        function populateConfigTab() {
            try {
                var config = codexClient.readConfig();
                if (w.configText && !w.configText.isDisposed()) {
                    w.configText.setText(JSON.stringify(config, null, 2));
                }
                if (w.urlLabel && !w.urlLabel.isDisposed()) {
                    w.urlLabel.setText("ws://127.0.0.1:19000");
                }
            } catch (e) {
                if (w.configText && !w.configText.isDisposed()) {
                    w.configText.setText("Failed to load configuration: " + e.message);
                }
            }
        }

        // ── Models tab population ────────────────────────────────────────

        function populateModelsTab() {
            try {
                var result = codexClient.listModels();
                if (!w.modelsTable || w.modelsTable.isDisposed()) return;
                w.modelsTable.removeAll();
                var models = result.data || result.models || [];
                if (Array.isArray(models)) {
                    for (var i = 0; i < models.length; i++) {
                        var m = models[i];
                        var item = new TableItem(w.modelsTable, SWT.NONE);
                        item.setText(0, String(m.id || m.model || "unknown"));
                        item.setText(1, String(m.reasoning_effort || m.reasoningEffort || "\u2014"));
                    }
                }
            } catch (e) {
                appendChat("[System]", "Could not load models list: " + e.message);
            }
        }

        // ── Build model context (first turn) ─────────────────────────────

        function getModelContextPrefix() {
            var context = codexClient.buildModelContext({
                maxElements: 200,
                relationships: true,
                includeDocumentation: true
            });
            return "# Current ArchiMate Model Context\n\n" + context +
                "\n\n---\n\nPlease answer the following question about the model above.\n\n";
        }

        // ── Chat handler ─────────────────────────────────────────────────

        function handleChat(text) {
            state.busy = true;
            updateUI();

            appendChat("[You]", text);

            var prompt = text;
            if (!state.modelContextSent) {
                prompt = getModelContextPrefix() + text;
                state.modelContextSent = true;
            }

            var useBrowser = w.chatBrowser && !w.chatBrowser.isDisposed();

            if (useBrowser) {
                browserStartStreaming("assistant");
            } else {
                appendRaw("[" + _timestamp() + "] [Codex] ");
            }

            try {
                var result = codexClient.ask(state.threadId, prompt, {
                    onDelta: function (delta) {
                        appendRaw(delta);
                    },
                    onPoll: function () {
                        try {
                            while (display.readAndDispatch()) { /* pump */ }
                        } catch (e) { /* ignore pump errors */ }
                    }
                });

                // If no streaming text came through, extract from items
                if (!result.text && result.items) {
                    var itemText = "";
                    for (var i = 0; i < result.items.length; i++) {
                        var entry = result.items[i];
                        if (entry.event === "completed" && entry.item) {
                            var item = entry.item;
                            if (item.content && Array.isArray(item.content)) {
                                for (var c = 0; c < item.content.length; c++) {
                                    if (item.content[c].text) {
                                        itemText += item.content[c].text;
                                    }
                                }
                            }
                        }
                    }
                    if (itemText) appendRaw(itemText);
                }

                if (useBrowser) {
                    browserFinalizeStreaming();
                } else {
                    appendRaw("\n\n");
                }

                state.turnCount++;
            } catch (e) {
                if (useBrowser) {
                    browserFinalizeStreaming();
                } else {
                    appendRaw("\n");
                }
                appendChat("[Error]", "Request failed: " + e.message);
            }

            state.busy = false;
            updateUI();
            if (w.inputField && !w.inputField.isDisposed()) {
                w.inputField.setFocus();
            }
        }

        // ── Slash command handlers ───────────────────────────────────────

        function handlePlan(args) {
            if (!args || args.trim() === "") {
                appendChat("[System]", "Usage: /plan <description of changes>");
                return;
            }

            state.busy = true;
            updateUI();
            appendChat("[You]", "/plan " + args);
            appendChat("[System]", "Building planning context...");

            try {
                var context = codexClient.buildPlanningContext({
                    maxElements: 100,
                    relationships: true,
                    includeDocumentation: true
                });
                appendChat("[System]", "Context: " + context.scope.element_count +
                    " elements, " + context.scope.relationship_count + " relationships");

                appendChat("[System]", "Requesting plan...");

                // In fallback mode, show a prefix line for streaming dots
                if (!w.chatBrowser || w.chatBrowser.isDisposed()) {
                    var ts = _timestamp();
                    appendRaw("[" + ts + "] [Plan] ");
                }

                var planResult = codexClient.askPlan(state.threadId, args, {
                    context: context,
                    onDelta: function (delta) {
                        // Show streaming progress dots
                    },
                    onPoll: function () {
                        try {
                            while (display.readAndDispatch()) { /* pump */ }
                        } catch (e) { /* ignore */ }
                    }
                });

                if (!w.chatBrowser || w.chatBrowser.isDisposed()) {
                    appendRaw("\n");
                }

                if (!planResult.plan) {
                    appendChat("[Error]", "Failed to get plan: " + (planResult.error || "unknown"));
                    state.busy = false;
                    updateUI();
                    return;
                }

                var plan = planResult.plan;
                appendChat("[Plan]", "Status: " + plan.status);
                appendChat("[Plan]", "Summary: " + plan.summary);

                if (plan.status === "needs_clarification") {
                    var questions = plan.questions || [];
                    for (var q = 0; q < questions.length; q++) {
                        appendChat("[Plan]", "  ? " + questions[q]);
                    }
                    state.busy = false;
                    updateUI();
                    return;
                }

                if (plan.status === "refusal") {
                    state.busy = false;
                    updateUI();
                    return;
                }

                if (planResult.validation && planResult.validation.warnings.length > 0) {
                    for (var vw = 0; vw < planResult.validation.warnings.length; vw++) {
                        appendChat("[Plan]", "Warning: " + planResult.validation.warnings[vw]);
                    }
                }

                if (!planResult.ok) {
                    appendChat("[Error]", "Validation failed: " + planResult.error);
                    state.busy = false;
                    updateUI();
                    return;
                }

                var preview = planExecutor.execute(plan, { preview: true });
                appendChat("[Plan]", plan.actions.length + " action(s):");
                for (var p = 0; p < preview.results.length; p++) {
                    appendChat("[Plan]", "  " + (p + 1) + ". " + preview.results[p].preview);
                }
                appendChat("[System]", "Plan ready. Type /apply to execute, or continue chatting.");

                state.lastPlan = plan;
            } catch (e) {
                appendChat("[Error]", "Plan failed: " + e.message);
            }

            state.busy = false;
            updateUI();
            if (w.inputField && !w.inputField.isDisposed()) {
                w.inputField.setFocus();
            }
        }

        function handleApply() {
            if (!state.lastPlan) {
                appendChat("[System]", "No plan to apply. Use /plan <description> first.");
                return;
            }

            state.busy = true;
            updateUI();
            appendChat("[You]", "/apply");
            appendChat("[System]", "Applying " + state.lastPlan.actions.length + " action(s)...");

            try {
                var result = planExecutor.execute(state.lastPlan, { preview: false });

                for (var r = 0; r < result.results.length; r++) {
                    var res = result.results[r];
                    if (res.ok) {
                        appendChat("[System]", "  [OK] " + (r + 1) + ". " + res.op);
                    } else if (res.skipped) {
                        appendChat("[System]", "  [SKIP] " + (r + 1) + ". " + res.op);
                    } else {
                        appendChat("[Error]", "  [FAIL] " + (r + 1) + ". " + res.op + " \u2014 " + res.error);
                    }
                }

                if (result.ok) {
                    appendChat("[System]", "Done. Applied " + result.applied + " action(s).");
                } else {
                    appendChat("[System]", "Completed with errors. Applied: " + result.applied +
                        ", Failed: " + result.failed + ", Skipped: " + result.skipped);
                }
            } catch (e) {
                appendChat("[Error]", "Apply failed: " + e.message);
            }

            state.lastPlan = null;
            state.busy = false;
            updateUI();
        }

        function handleClear() {
            appendChat("[You]", "/clear");
            try {
                var thread = codexClient.startThread({ approvalPolicy: "never" });
                state.threadId = thread.id;
                state.turnCount = 0;
                state.modelContextSent = false;
                state.lastPlan = null;
                if (w.chatBrowser && !w.chatBrowser.isDisposed()) {
                    browserClear();
                } else if (w.chatDisplay && !w.chatDisplay.isDisposed()) {
                    w.chatDisplay.setText("");
                }
                appendChat("[System]", "New thread started: " + thread.id);
                if (w.threadLabel && !w.threadLabel.isDisposed()) {
                    w.threadLabel.setText(thread.id);
                }
            } catch (e) {
                appendChat("[Error]", "Failed to start new thread: " + e.message);
            }
        }

        function handleContext() {
            appendChat("[You]", "/context");
            try {
                var elements = $("element");
                var rels = $("relationship");
                var views = $("view");
                var elCount = 0, relCount = 0, viewCount = 0;
                elements.each(function () { elCount++; });
                rels.each(function () { relCount++; });
                views.each(function () { viewCount++; });
                appendChat("[System]", "Model: " + model.name);
                appendChat("[System]", "  Elements: " + elCount);
                appendChat("[System]", "  Relationships: " + relCount);
                appendChat("[System]", "  Views: " + viewCount);
            } catch (e) {
                appendChat("[Error]", "Failed to read model context: " + e.message);
            }
        }

        function handleHelp() {
            appendChat("[You]", "/help");
            if (w.chatBrowser && !w.chatBrowser.isDisposed()) {
                var helpMd = "**Available commands:**\n\n" +
                    "| Command | Description |\n" +
                    "|---------|-------------|\n" +
                    "| `/plan <description>` | Generate a structured change plan |\n" +
                    "| `/apply` | Execute the last generated plan |\n" +
                    "| `/clear` | Start a new conversation thread |\n" +
                    "| `/context` | Show model context summary |\n" +
                    "| `/status` | Show connection and thread info |\n" +
                    "| `/help` | Show this help message |\n\n" +
                    "Type any text without `/` to chat with Codex about your model.";
                var msg = createMessage("system", helpMd);
                var bodyHtml = '<div style="font-style:normal;">' + renderMarkdown(helpMd) + '</div>';
                w.chatBrowser.execute(
                    "addMessage('" + escapeForJs(msg.id) + "','system','" +
                    escapeForJs(msg.timestamp) + "','" + escapeForJs(bodyHtml) + "')"
                );
            } else {
                appendChat("[System]", "Available commands:");
                appendChat("[System]", "  /plan <description>  \u2014 Generate a structured change plan");
                appendChat("[System]", "  /apply               \u2014 Execute the last generated plan");
                appendChat("[System]", "  /clear               \u2014 Start a new conversation thread");
                appendChat("[System]", "  /context             \u2014 Show model context summary");
                appendChat("[System]", "  /status              \u2014 Show connection and thread info");
                appendChat("[System]", "  /help                \u2014 Show this help message");
                appendChat("[System]", "");
                appendChat("[System]", "Type any text without / to chat with Codex about your model.");
            }
        }

        function handleStatus() {
            appendChat("[You]", "/status");
            appendChat("[System]", "Connected: " + state.connected);
            appendChat("[System]", "Thread: " + (state.threadId || "none"));
            appendChat("[System]", "Turn count: " + state.turnCount);
            appendChat("[System]", "Model context sent: " + state.modelContextSent);
            appendChat("[System]", "Pending plan: " + (state.lastPlan ? "yes (" + state.lastPlan.actions.length + " actions)" : "no"));
        }

        // ── Command dispatcher ───────────────────────────────────────────

        var COMMANDS = {
            plan: handlePlan,
            apply: handleApply,
            clear: handleClear,
            context: handleContext,
            help: handleHelp,
            status: handleStatus
        };

        function parseAndDispatch(text) {
            text = text.trim();
            if (!text) return;

            if (text.charAt(0) === "/") {
                var spaceIdx = text.indexOf(" ");
                var cmd, args;
                if (spaceIdx === -1) {
                    cmd = text.substring(1).toLowerCase();
                    args = "";
                } else {
                    cmd = text.substring(1, spaceIdx).toLowerCase();
                    args = text.substring(spaceIdx + 1);
                }

                var handler = COMMANDS[cmd];
                if (handler) {
                    handler(args);
                } else {
                    appendChat("[Error]", 'Unknown command "/' + cmd + '". Type /help for available commands.');
                }
            } else {
                handleChat(text);
            }
        }

        // ── Send action ──────────────────────────────────────────────────

        function doSend() {
            if (!w.inputField || w.inputField.isDisposed()) return;
            var text = String(w.inputField.getText()).trim();
            if (!text) return;
            w.inputField.setText("");
            parseAndDispatch(text);
        }

        // ── Dialog definition ────────────────────────────────────────────

        var myDialog = {
            dialog: new ExtendedTitleAreaDialog(parentShell, {
                configureShell: function (newShell) {
                    Java.super(myDialog.dialog).configureShell(newShell);
                    newShell.setText("Codex Chat");
                    newShell.setMinimumSize(600, 400);
                },

                isResizable: function () {
                    return true;
                },

                getShellStyle: function () {
                    return SWT.CLOSE | SWT.TITLE | SWT.BORDER |
                        SWT.RESIZE | SWT.MAX | SWT.MIN;
                },

                getInitialSize: function () {
                    var monitor = display.getPrimaryMonitor().getBounds();
                    return new Point(
                        Math.max(600, Math.round(monitor.width / 3)),
                        Math.max(400, Math.round(monitor.height * 2 / 3))
                    );
                },

                getInitialLocation: function (initialSize) {
                    var monitor = display.getPrimaryMonitor().getBounds();
                    return new Point(
                        monitor.x + Math.round((monitor.width - initialSize.x) / 2),
                        monitor.y + Math.round((monitor.height - initialSize.y) / 2)
                    );
                },

                createDialogArea: function (parent) {
                    var area = Java.super(myDialog.dialog).createDialogArea(parent);
                    myDialog.dialog.setTitle("Codex Chat");
                    myDialog.dialog.setMessage("Connect to Codex to start chatting about your model", 0);

                    var container = new Composite(area, SWT.NONE);
                    GridLayoutFactory.fillDefaults().margins(10, 10).applyTo(container);
                    GridDataFactory.fillDefaults().grab(true, true).applyTo(container);

                    // ── Tab folder ────────────────────────────────────────
                    var tabFolder = new TabFolder(container, SWT.TOP);
                    GridDataFactory.fillDefaults().grab(true, true).applyTo(tabFolder);

                    // ── Chat tab ──────────────────────────────────────────
                    var chatTab = new TabItem(tabFolder, SWT.NONE);
                    chatTab.setText("Chat");

                    var chatComposite = new Composite(tabFolder, SWT.NONE);
                    GridLayoutFactory.fillDefaults().margins(5, 5).spacing(5, 5).applyTo(chatComposite);
                    chatTab.setControl(chatComposite);

                    // Chat display — Browser with fallback to Text
                    try {
                        w.chatBrowser = new Browser(chatComposite, SWT.NONE);
                        GridDataFactory.fillDefaults().grab(true, true).applyTo(w.chatBrowser);
                        w.chatBrowser.setText(buildInitialHtml());
                    } catch (browserErr) {
                        w.chatBrowser = null;
                        w.chatDisplay = new Text(chatComposite,
                            SWT.READ_ONLY | SWT.MULTI | SWT.WRAP | SWT.V_SCROLL | SWT.BORDER);
                        GridDataFactory.fillDefaults().grab(true, true).applyTo(w.chatDisplay);
                    }

                    // Input area (2 columns: text field + send button)
                    var inputArea = new Composite(chatComposite, SWT.NONE);
                    GridLayoutFactory.fillDefaults().numColumns(2).spacing(5, 0).applyTo(inputArea);
                    GridDataFactory.fillDefaults().grab(true, false).applyTo(inputArea);

                    w.inputField = new Text(inputArea, SWT.SINGLE | SWT.BORDER);
                    GridDataFactory.fillDefaults().grab(true, false).align(SWT.FILL, SWT.CENTER).applyTo(w.inputField);
                    w.inputField.setMessage("Type a message or /help for commands...");
                    w.inputField.setEnabled(false);

                    w.inputField.addListener(SWT.Traverse, function (e) {
                        if (e.detail === SWT.TRAVERSE_RETURN) {
                            e.doit = false;
                            e.detail = SWT.TRAVERSE_NONE;
                            doSend();
                        }
                    });

                    w.sendButton = new Button(inputArea, SWT.PUSH);
                    w.sendButton.setText("Send");
                    var sendGd = new GridData(SWT.CENTER, SWT.CENTER, false, false);
                    sendGd.widthHint = 70;
                    w.sendButton.setLayoutData(sendGd);
                    w.sendButton.setEnabled(false);
                    w.sendButton.addListener(SWT.Selection, function () {
                        doSend();
                    });

                    // ── Configuration tab ─────────────────────────────────
                    var configTab = new TabItem(tabFolder, SWT.NONE);
                    configTab.setText("Configuration");

                    var configComposite = new Composite(tabFolder, SWT.NONE);
                    GridLayoutFactory.fillDefaults().margins(10, 10).spacing(5, 5).applyTo(configComposite);
                    configTab.setControl(configComposite);

                    var connGroup = new Group(configComposite, SWT.NONE);
                    connGroup.setText("Connection");
                    GridLayoutFactory.fillDefaults().numColumns(2).margins(10, 10).spacing(10, 5).applyTo(connGroup);
                    GridDataFactory.fillDefaults().grab(true, false).applyTo(connGroup);

                    new Label(connGroup, SWT.NONE).setText("Status:");
                    w.statusLabel = new Label(connGroup, SWT.NONE);
                    w.statusLabel.setText("Disconnected");
                    GridDataFactory.fillDefaults().grab(true, false).applyTo(w.statusLabel);

                    new Label(connGroup, SWT.NONE).setText("URL:");
                    w.urlLabel = new Label(connGroup, SWT.NONE);
                    w.urlLabel.setText("ws://127.0.0.1:19000");
                    GridDataFactory.fillDefaults().grab(true, false).applyTo(w.urlLabel);

                    new Label(connGroup, SWT.NONE).setText("Thread:");
                    w.threadLabel = new Label(connGroup, SWT.NONE);
                    w.threadLabel.setText("\u2014");
                    GridDataFactory.fillDefaults().grab(true, false).applyTo(w.threadLabel);

                    var serverGroup = new Group(configComposite, SWT.NONE);
                    serverGroup.setText("Server Configuration");
                    GridLayoutFactory.fillDefaults().margins(10, 10).applyTo(serverGroup);
                    GridDataFactory.fillDefaults().grab(true, true).applyTo(serverGroup);

                    w.configText = new Text(serverGroup,
                        SWT.READ_ONLY | SWT.MULTI | SWT.V_SCROLL | SWT.H_SCROLL | SWT.BORDER);
                    GridDataFactory.fillDefaults().grab(true, true).applyTo(w.configText);
                    w.configText.setText("(Not connected)");

                    // ── Models tab ────────────────────────────────────────
                    var modelsTab = new TabItem(tabFolder, SWT.NONE);
                    modelsTab.setText("Models");

                    var modelsComposite = new Composite(tabFolder, SWT.NONE);
                    GridLayoutFactory.fillDefaults().margins(10, 10).applyTo(modelsComposite);
                    modelsTab.setControl(modelsComposite);

                    w.modelsTable = new Table(modelsComposite,
                        SWT.BORDER | SWT.FULL_SELECTION | SWT.V_SCROLL);
                    w.modelsTable.setHeaderVisible(true);
                    w.modelsTable.setLinesVisible(true);
                    GridDataFactory.fillDefaults().grab(true, true).applyTo(w.modelsTable);

                    var col1 = new TableColumn(w.modelsTable, SWT.NONE);
                    col1.setText("Model ID");
                    col1.setWidth(400);

                    var col2 = new TableColumn(w.modelsTable, SWT.NONE);
                    col2.setText("Reasoning Effort");
                    col2.setWidth(150);

                    return area;
                },

                createButtonsForButtonBar: function (parent) {
                    w.connectBtn = myDialog.dialog.createButton(parent, CONNECT_ID, "Connect", true);
                    w.disconnectBtn = myDialog.dialog.createButton(parent, DISCONNECT_ID, "Disconnect", false);
                    w.disconnectBtn.setEnabled(false);
                    myDialog.dialog.createButton(parent, CLOSE_ID, "Close", false);
                },

                buttonPressed: function (buttonId) {
                    if (buttonId === CONNECT_ID) {
                        doConnect();
                    } else if (buttonId === DISCONNECT_ID) {
                        doDisconnect();
                    } else {
                        Java.super(myDialog.dialog).buttonPressed(buttonId);
                    }
                },

                close: function () {
                    if (state.connected) {
                        try { codexClient.disconnect(); } catch (e) { /* ignore */ }
                    }
                    return Java.super(myDialog.dialog).close();
                }
            })
        };

        myDialog.dialog.setHelpAvailable(false);
        myDialog.dialog.open();
    }

    // ── Module export ────────────────────────────────────────────────────

    var codexChat = {
        open: open
    };

    if (typeof globalThis !== "undefined") globalThis.codexChat = codexChat;
    if (typeof module !== "undefined" && module.exports) module.exports = codexChat;
})();
