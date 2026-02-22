/**
 * @module codexChat
 * @description Multi-turn chat dialog for conversing with Codex about the ArchiMate model.
 *
 * Features:
 * - Persistent conversation thread with streaming responses
 * - Three tabs: Chat, Configuration, Models
 * - Slash commands: /plan, /apply, /clear, /context, /help, /status
 * - Plan integration via codexClient.askPlan() and planExecutor.execute()
 *
 * Dependencies (must be loaded before this module):
 *   log, swtImports, codexClient, planValidator, planExecutor
 *
 * Usage:
 *   load(__DIR__ + "lib/codexChat.js");
 *   codexChat.open();
 *
 * @version 1.0.0
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

        // ── Chat display helpers ─────────────────────────────────────────

        function appendChat(prefix, text) {
            if (!w.chatDisplay || w.chatDisplay.isDisposed()) return;
            var ts = _timestamp();
            var line = "[" + ts + "] " + prefix + " " + text + "\n";
            w.chatDisplay.append(line);
            // Scroll to bottom
            w.chatDisplay.setTopIndex(w.chatDisplay.getLineCount() - 1);
        }

        function appendRaw(text) {
            if (!w.chatDisplay || w.chatDisplay.isDisposed()) return;
            w.chatDisplay.append(text);
            w.chatDisplay.setTopIndex(w.chatDisplay.getLineCount() - 1);
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
            // Update status labels
            if (w.statusLabel && !w.statusLabel.isDisposed()) {
                w.statusLabel.setText(state.connected ? "Connected" : "Disconnected");
            }
            if (w.threadLabel && !w.threadLabel.isDisposed()) {
                w.threadLabel.setText(state.threadId || "—");
            }
        }

        // ── Connect / Disconnect ─────────────────────────────────────────

        function doConnect() {
            state.busy = true;
            updateUI();
            try {
                codexClient.connect();
                state.connected = true;

                // Start a thread
                var thread = codexClient.startThread({ approvalPolicy: "never" });
                state.threadId = thread.id;
                state.turnCount = 0;
                state.modelContextSent = false;
                state.lastPlan = null;

                appendChat("[System]", "Connected to Codex. Thread: " + thread.id);
                myDialog.dialog.setMessage("Connected — ready to chat", 0);

                // Populate config and models tabs (non-fatal)
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
                        item.setText(1, String(m.reasoning_effort || m.reasoningEffort || "—"));
                    }
                }
            } catch (e) {
                // Non-fatal — leave table empty
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

            // Prepend model context on first turn
            var prompt = text;
            if (!state.modelContextSent) {
                prompt = getModelContextPrefix() + text;
                state.modelContextSent = true;
            }

            // Show thinking indicator
            var ts = _timestamp();
            appendRaw("[" + ts + "] [Codex] ");

            try {
                var result = codexClient.ask(state.threadId, prompt, {
                    onDelta: function (delta) {
                        appendRaw(delta);
                        // Pump the SWT event loop so the UI refreshes
                        try {
                            while (display.readAndDispatch()) { /* pump */ }
                        } catch (e) { /* ignore pump errors */ }
                    }
                });

                // If no streaming text came through, show the final text
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

                appendRaw("\n\n");
                state.turnCount++;
            } catch (e) {
                appendRaw("\n");
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
                var ts = _timestamp();
                appendRaw("[" + ts + "] [Plan] ");

                var planResult = codexClient.askPlan(state.threadId, args, {
                    context: context,
                    onDelta: function (delta) {
                        // Show streaming progress dots
                    }
                });

                appendRaw("\n");

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

                // Show validation warnings
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

                // Preview actions
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
                        appendChat("[Error]", "  [FAIL] " + (r + 1) + ". " + res.op + " — " + res.error);
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
                if (w.chatDisplay && !w.chatDisplay.isDisposed()) {
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
            appendChat("[System]", "Available commands:");
            appendChat("[System]", "  /plan <description>  — Generate a structured change plan");
            appendChat("[System]", "  /apply               — Execute the last generated plan");
            appendChat("[System]", "  /clear               — Start a new conversation thread");
            appendChat("[System]", "  /context             — Show model context summary");
            appendChat("[System]", "  /status              — Show connection and thread info");
            appendChat("[System]", "  /help                — Show this help message");
            appendChat("[System]", "");
            appendChat("[System]", "Type any text without / to chat with Codex about your model.");
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

                // isResizable() is called during the Java constructor before
                // the GraalJS proxy is wired, so it always returns false.
                // getShellStyle() is called later at shell creation time when
                // JS overrides are active — this is the reliable approach.
                getShellStyle: function () {
                    return SWT.CLOSE | SWT.TITLE | SWT.BORDER |
                        SWT.APPLICATION_MODAL | SWT.RESIZE | SWT.MAX;
                },

                getInitialSize: function () {
                    return new Point(900, 750);
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

                    // Chat display
                    w.chatDisplay = new Text(chatComposite,
                        SWT.READ_ONLY | SWT.MULTI | SWT.WRAP | SWT.V_SCROLL | SWT.BORDER);
                    GridDataFactory.fillDefaults().grab(true, true).applyTo(w.chatDisplay);

                    // Input area (2 columns: text field + send button)
                    var inputArea = new Composite(chatComposite, SWT.NONE);
                    GridLayoutFactory.fillDefaults().numColumns(2).spacing(5, 0).applyTo(inputArea);
                    GridDataFactory.fillDefaults().grab(true, false).applyTo(inputArea);

                    w.inputField = new Text(inputArea,
                        SWT.MULTI | SWT.BORDER | SWT.WRAP | SWT.V_SCROLL);
                    var inputGd = new GridData(SWT.FILL, SWT.FILL, true, false);
                    inputGd.heightHint = 50;
                    w.inputField.setLayoutData(inputGd);
                    w.inputField.setEnabled(false);

                    // Enter sends, Shift+Enter inserts newline
                    w.inputField.addListener(SWT.KeyDown, function (e) {
                        if (e.keyCode === SWT.CR || e.keyCode === SWT.LF) {
                            if ((e.stateMask & SWT.SHIFT) === 0) {
                                e.doit = false;
                                doSend();
                            }
                        }
                    });

                    w.sendButton = new Button(inputArea, SWT.PUSH);
                    w.sendButton.setText("Send");
                    var sendGd = new GridData(SWT.CENTER, SWT.FILL, false, false);
                    sendGd.widthHint = 70;
                    sendGd.heightHint = 50;
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

                    // Connection group
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

                    // Server config group
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
