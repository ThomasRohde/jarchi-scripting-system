/**
 * @module codexClient
 * @description WebSocket client for the Codex app-server JSON-RPC protocol.
 *
 * Connects to a running Codex app-server via WebSocket and provides a
 * synchronous API for starting conversations, sending prompts, and
 * receiving responses. The server must be started manually:
 *   codex app-server --listen ws://127.0.0.1:19000
 *
 * Uses raw java.net.Socket with manual WebSocket handshake and framing
 * to avoid GraalJS cross-thread issues with callback-based APIs.
 *
 * Usage:
 *   load(__DIR__ + "lib/codexClient.js");
 *
 *   codexClient.connect();
 *   var thread = codexClient.startThread({ approvalPolicy: "never" });
 *   var result = codexClient.ask(thread.id, "Explain this model");
 *   log.info(result.text);
 *   codexClient.disconnect();
 *
 * @version 1.1.0
 * @author Thomas Rohde
 */
(function () {
    "use strict";
    if (typeof globalThis !== "undefined" && typeof globalThis.codexClient !== "undefined") return;

    // ── Java types ──────────────────────────────────────────────────────
    var Socket = Java.type("java.net.Socket");
    var InetSocketAddress = Java.type("java.net.InetSocketAddress");
    var DataInputStream = Java.type("java.io.DataInputStream");
    var BufferedInputStream = Java.type("java.io.BufferedInputStream");
    var ByteArrayOutputStream = Java.type("java.io.ByteArrayOutputStream");
    var JavaString = Java.type("java.lang.String");
    var JavaSystem = Java.type("java.lang.System");
    var StandardCharsets = Java.type("java.nio.charset.StandardCharsets");
    var Base64 = Java.type("java.util.Base64");
    var Random = Java.type("java.util.Random");
    var ByteArray = Java.type("byte[]");
    var JStringBuilder = Java.type("java.lang.StringBuilder");
    var JThread = Java.type("java.lang.Thread");

    // ── Defaults ────────────────────────────────────────────────────────
    var DEFAULTS = {
        url: "ws://127.0.0.1:19000",
        clientName: "jarchi-codex-client",
        clientVersion: "1.0.0",
        timeout: 30000,       // 30s for connection + requests
        turnTimeout: 300000,  // 5 min for full turn
        maxFrameSize: 10 * 1024 * 1024 // 10MB safety limit
    };

    // ── Internal state ──────────────────────────────────────────────────
    var socket = null;
    var din = null;   // DataInputStream
    var out = null;   // OutputStream
    var rng = new Random();
    var nextId = 1;
    var connected = false;
    var bufferedNotifications = [];

    // ── URL parser ──────────────────────────────────────────────────────

    function _parseWsUrl(url) {
        var match = url.match(/^ws:\/\/([^:/]+):(\d+)(\/.*)?$/);
        if (!match) throw new Error("codexClient: invalid WebSocket URL: " + url);
        return { host: match[1], port: parseInt(match[2], 10), path: match[3] || "/" };
    }

    // ── Low-level I/O ───────────────────────────────────────────────────

    /** Read one line from the socket (for HTTP handshake). Strips \r\n. */
    function _readLine() {
        var sb = new JStringBuilder();
        while (true) {
            var b = din.read();
            if (b === -1) throw new Error("codexClient: connection closed during handshake");
            if (b === 0x0D) continue; // skip \r
            if (b === 0x0A) return String(sb.toString()); // \n terminates
            sb.append(String.fromCharCode(b));
        }
    }

    /** Read one WebSocket frame. Returns { fin, opcode, payload (ByteArray) }. */
    function _readFrame() {
        var b0 = din.readUnsignedByte();
        var b1 = din.readUnsignedByte();

        var fin = (b0 & 0x80) !== 0;
        var opcode = b0 & 0x0F;
        var masked = (b1 & 0x80) !== 0;
        var length = b1 & 0x7F;

        if (length === 126) {
            length = din.readUnsignedShort();
        } else if (length === 127) {
            // Read 8-byte length; practical messages are well under 2^31
            length = Number(din.readLong());
        }

        if (length > DEFAULTS.maxFrameSize) {
            throw new Error("codexClient: frame too large (" + length + " bytes)");
        }

        var maskKey = null;
        if (masked) {
            maskKey = new ByteArray(4);
            din.readFully(maskKey);
        }

        var payload = new ByteArray(length);
        if (length > 0) din.readFully(payload);

        if (masked && maskKey) {
            for (var i = 0; i < length; i++) {
                payload[i] = (payload[i] & 0xFF) ^ (maskKey[i % 4] & 0xFF);
            }
        }

        return { fin: fin, opcode: opcode, payload: payload };
    }

    /** Write one WebSocket frame (client-masked). */
    function _writeFrame(opcode, payload) {
        var baos = new ByteArrayOutputStream();
        var len = payload.length;

        // Byte 0: FIN + opcode
        baos.write(0x80 | opcode);

        // Length + MASK bit (client frames MUST be masked)
        if (len < 126) {
            baos.write(0x80 | len);
        } else if (len < 65536) {
            baos.write(0x80 | 126);
            baos.write((len >>> 8) & 0xFF);
            baos.write(len & 0xFF);
        } else {
            baos.write(0x80 | 127);
            // 8-byte big-endian length; top 4 bytes zero for practical sizes
            baos.write(0); baos.write(0); baos.write(0); baos.write(0);
            baos.write((len >>> 24) & 0xFF);
            baos.write((len >>> 16) & 0xFF);
            baos.write((len >>> 8) & 0xFF);
            baos.write(len & 0xFF);
        }

        // 4-byte mask key
        var mask = new ByteArray(4);
        rng.nextBytes(mask);
        baos.write(mask, 0, 4);

        // Masked payload
        for (var i = 0; i < len; i++) {
            baos.write((payload[i] & 0xFF) ^ (mask[i % 4] & 0xFF));
        }

        var frame = baos.toByteArray();
        out.write(frame, 0, frame.length);
        out.flush();
    }

    // ── WebSocket read / write ──────────────────────────────────────────

    /**
     * Read one complete WebSocket text message (handles fragmentation,
     * ping/pong, and close frames). Fully synchronous on the script thread.
     */
    function _wsRead(timeoutMs) {
        socket.setSoTimeout(timeoutMs);
        var fragments = new ByteArrayOutputStream();

        while (true) {
            var frame = _readFrame();

            // Close frame
            if (frame.opcode === 0x08) {
                throw new Error("codexClient: server closed the connection");
            }
            // Ping → reply with pong
            if (frame.opcode === 0x09) {
                _writeFrame(0x0A, frame.payload);
                continue;
            }
            // Pong → ignore
            if (frame.opcode === 0x0A) continue;

            // Data frame (text=0x01 or continuation=0x00)
            if (frame.payload.length > 0) {
                fragments.write(frame.payload, 0, frame.payload.length);
            }

            if (frame.fin) {
                return String(new JavaString(fragments.toByteArray(), StandardCharsets.UTF_8));
            }
        }
    }

    /** Send a JS object as a JSON WebSocket text frame. */
    function wsSend(obj) {
        if (!socket) throw new Error("codexClient: not connected");
        var text = JSON.stringify(obj);
        var bytes = new JavaString(text).getBytes(StandardCharsets.UTF_8);
        _writeFrame(0x01, bytes);
    }

    // ── Message parsing ─────────────────────────────────────────────────

    /**
     * Read and parse one JSON-RPC message from the WebSocket.
     * Throws on timeout, close, or transport error.
     */
    function pollParsed(timeoutMs) {
        try {
            var raw = _wsRead(timeoutMs);
            return JSON.parse(raw);
        } catch (e) {
            var errStr = String(e);
            if (errStr.indexOf("timed out") >= 0 || errStr.indexOf("SocketTimeout") >= 0) {
                throw new Error("codexClient: timed out waiting for response (" + timeoutMs + "ms)");
            }
            throw e;
        }
    }

    /**
     * Non-blocking poll for a single WebSocket message.
     * Returns parsed JSON if data is available in the socket buffer, null otherwise.
     * Does NOT block — returns immediately if no data.
     */
    function _pollOnce() {
        if (!socket) return null;
        try {
            if (din.available() === 0) return null;
        } catch (e) {
            return null;
        }
        // Data available — read with generous timeout (should complete near-instantly)
        var raw = _wsRead(5000);
        return JSON.parse(raw);
    }

    // ── JSON-RPC layer ──────────────────────────────────────────────────

    /**
     * Send a JSON-RPC request and block until the matching response arrives.
     * Interleaved notifications are stashed in bufferedNotifications.
     * Server-initiated requests (approval prompts) are auto-accepted inline.
     */
    function _sendRequest(method, params, timeoutMs) {
        var id = nextId++;
        var req = { method: method, id: id };
        if (params !== undefined) req.params = params;
        wsSend(req);

        timeoutMs = timeoutMs || DEFAULTS.timeout;
        var deadline = JavaSystem.currentTimeMillis() + timeoutMs;

        while (true) {
            var remaining = deadline - JavaSystem.currentTimeMillis();
            if (remaining <= 0) throw new Error("codexClient: request '" + method + "' timed out");
            var msg = pollParsed(remaining);

            // Response to our request
            if (msg.id === id) {
                if (msg.error) {
                    throw new Error("codexClient: RPC error [" + (msg.error.code || "") + "] " + (msg.error.message || JSON.stringify(msg.error)));
                }
                return msg.result;
            }

            // Server-initiated request (has both method and id) — auto-accept
            if (msg.method && msg.id !== undefined) {
                _autoAccept(msg);
                continue;
            }

            // Notification — stash for later
            if (msg.method) {
                bufferedNotifications.push(msg);
                continue;
            }
        }
    }

    /**
     * Send a JSON-RPC notification (no id, no response expected).
     */
    function _sendNotification(method, params) {
        var notif = { method: method };
        if (params !== undefined) notif.params = params;
        wsSend(notif);
    }

    /**
     * Auto-accept a server-initiated approval request.
     */
    function _autoAccept(msg) {
        wsSend({
            id: msg.id,
            result: { decision: "accept" }
        });
    }

    // ── Turn collection ─────────────────────────────────────────────────

    /**
     * Collect the full turn response by processing notifications
     * until turn/completed arrives.
     *
     * @param {string} turnId - The turn ID to watch for
     * @param {number} timeout - Timeout in ms
     * @param {Function} [onDelta] - Optional callback for streaming text deltas
     * @returns {{ text: string, turnId: string, status: string, items: Array }}
     */
    function _collectTurnResponse(turnId, timeout, onDelta) {
        var textParts = [];
        var items = [];
        var status = "unknown";
        var deadline = JavaSystem.currentTimeMillis() + timeout;

        // Drain buffered notifications from the request phase first
        var buffered = bufferedNotifications.splice(0);
        for (var b = 0; b < buffered.length; b++) {
            var handled = _processTurnNotification(buffered[b], turnId, textParts, items, onDelta);
            if (handled === "done") {
                status = _extractStatus(buffered[b]);
                return { text: textParts.join(""), turnId: turnId, status: status, items: items };
            }
        }

        // Poll for new messages
        while (true) {
            var remaining = deadline - JavaSystem.currentTimeMillis();
            if (remaining <= 0) throw new Error("codexClient: turn timed out after " + timeout + "ms");
            var msg = pollParsed(remaining);

            // Server-initiated request — auto-accept inline
            if (msg.method && msg.id !== undefined) {
                _autoAccept(msg);
                continue;
            }

            var result = _processTurnNotification(msg, turnId, textParts, items, onDelta);
            if (result === "done") {
                status = _extractStatus(msg);
                return { text: textParts.join(""), turnId: turnId, status: status, items: items };
            }
        }
    }

    /**
     * Process a single turn notification. Returns "done" when turn/completed.
     */
    function _processTurnNotification(msg, turnId, textParts, items, onDelta) {
        if (!msg.method || !msg.params) return;

        switch (msg.method) {
            case "item/agentMessage/delta":
                if (msg.params.delta) {
                    textParts.push(msg.params.delta);
                    if (onDelta) onDelta(msg.params.delta);
                }
                break;

            case "item/started":
                if (msg.params.item) items.push({ event: "started", item: msg.params.item });
                break;

            case "item/completed":
                if (msg.params.item) items.push({ event: "completed", item: msg.params.item });
                break;

            case "turn/completed":
                return "done";
        }
    }

    /**
     * Extract status from a turn/completed notification.
     */
    function _extractStatus(msg) {
        if (msg.params && msg.params.turn && msg.params.turn.status) {
            return msg.params.turn.status;
        }
        return "completed";
    }

    // ── Non-blocking turn execution ─────────────────────────────────────

    /**
     * Send a prompt and collect the response using non-blocking polling.
     * Calls onPoll() between socket reads so the caller can pump their event loop.
     * The UI remains responsive during the entire LLM thinking + streaming phase.
     *
     * @param {string} threadId
     * @param {string} text
     * @param {Object} options - Must include onPoll
     * @param {Function} options.onPoll - Called between reads for event loop pumping
     * @param {Function} [options.onDelta] - Streaming text callback
     * @param {number} [options.timeout] - Turn timeout (default 5min)
     * @param {Object} [options.outputSchema] - Structured output schema
     * @returns {{ text: string, turnId: string, status: string, items: Array }}
     */
    function _askStreaming(threadId, text, options) {
        var timeout = options.timeout || DEFAULTS.turnTimeout;
        var onDelta = options.onDelta;
        var onPoll = options.onPoll;

        var turnParams = {
            threadId: threadId,
            input: [{ type: "text", text: text }]
        };
        if (options.outputSchema) turnParams.outputSchema = options.outputSchema;

        // Send turn/start request (non-blocking send)
        var reqId = nextId++;
        wsSend({ method: "turn/start", id: reqId, params: turnParams });

        var deadline = JavaSystem.currentTimeMillis() + timeout;
        var turnId = null;
        var textParts = [];
        var items = [];

        // Phase 1: Wait for turn/start response while keeping UI alive
        while (true) {
            if (JavaSystem.currentTimeMillis() >= deadline) {
                throw new Error("codexClient: turn/start timed out");
            }

            var msg = _pollOnce();
            if (msg === null) {
                if (onPoll) onPoll();
                JThread.sleep(1);
                continue;
            }

            // Our response
            if (msg.id === reqId) {
                if (msg.error) {
                    throw new Error("codexClient: RPC error [" +
                        (msg.error.code || "") + "] " + (msg.error.message || JSON.stringify(msg.error)));
                }
                turnId = msg.result.turn.id;
                break;
            }

            // Auto-accept server-initiated requests
            if (msg.method && msg.id !== undefined) {
                _autoAccept(msg);
                continue;
            }

            // Stash notifications
            if (msg.method) {
                bufferedNotifications.push(msg);
            }
            if (onPoll) onPoll();
        }

        // Phase 2: Collect turn response
        // Drain buffered notifications first
        var buffered = bufferedNotifications.splice(0);
        for (var b = 0; b < buffered.length; b++) {
            var handled = _processTurnNotification(buffered[b], turnId, textParts, items, onDelta);
            if (handled === "done") {
                return { text: textParts.join(""), turnId: turnId, status: _extractStatus(buffered[b]), items: items };
            }
        }

        // Poll for new messages
        while (true) {
            if (JavaSystem.currentTimeMillis() >= deadline) {
                throw new Error("codexClient: turn timed out after " + timeout + "ms");
            }

            var msg2 = _pollOnce();
            if (msg2 === null) {
                if (onPoll) onPoll();
                JThread.sleep(1);
                continue;
            }

            // Auto-accept
            if (msg2.method && msg2.id !== undefined) {
                _autoAccept(msg2);
                if (onPoll) onPoll();
                continue;
            }

            var result = _processTurnNotification(msg2, turnId, textParts, items, onDelta);
            if (result === "done") {
                return { text: textParts.join(""), turnId: turnId, status: _extractStatus(msg2), items: items };
            }
            if (onPoll) onPoll();
        }
    }

    // ── Public API ──────────────────────────────────────────────────────

    /**
     * Connect to the Codex app-server and perform the initialization handshake.
     *
     * @param {string} [url] - WebSocket URL (default ws://127.0.0.1:19000)
     * @param {Object} [options]
     * @param {number} [options.timeout] - Connection timeout in ms
     * @returns {Object} Server capabilities from the initialize response
     */
    function connect(url, options) {
        if (connected) throw new Error("codexClient: already connected — call disconnect() first");

        url = url || DEFAULTS.url;
        options = options || {};
        var timeout = options.timeout || DEFAULTS.timeout;
        var parsed = _parseWsUrl(url);

        nextId = 1;
        bufferedNotifications = [];

        // TCP connect
        socket = new Socket();
        try {
            socket.connect(new InetSocketAddress(parsed.host, parsed.port), timeout);
        } catch (e) {
            socket = null;
            throw new Error("codexClient: failed to connect to " + url + " — " + e);
        }

        din = new DataInputStream(new BufferedInputStream(socket.getInputStream()));
        out = socket.getOutputStream();

        // WebSocket upgrade handshake
        var keyBytes = new ByteArray(16);
        rng.nextBytes(keyBytes);
        var key = String(Base64.getEncoder().encodeToString(keyBytes));

        var handshake = "GET " + parsed.path + " HTTP/1.1\r\n" +
                        "Host: " + parsed.host + ":" + parsed.port + "\r\n" +
                        "Upgrade: websocket\r\n" +
                        "Connection: Upgrade\r\n" +
                        "Sec-WebSocket-Key: " + key + "\r\n" +
                        "Sec-WebSocket-Version: 13\r\n" +
                        "\r\n";

        var handshakeBytes = new JavaString(handshake).getBytes(StandardCharsets.US_ASCII);
        out.write(handshakeBytes, 0, handshakeBytes.length);
        out.flush();

        // Read HTTP upgrade response
        socket.setSoTimeout(timeout);
        var statusLine = _readLine();
        // Drain remaining headers
        while (true) {
            var headerLine = _readLine();
            if (headerLine === "") break;
        }

        if (statusLine.indexOf("101") === -1) {
            try { socket.close(); } catch (e2) {}
            socket = null; din = null; out = null;
            throw new Error("codexClient: WebSocket handshake failed: " + statusLine);
        }

        connected = true;

        // JSON-RPC initialize handshake
        var initResult = _sendRequest("initialize", {
            clientInfo: {
                name: DEFAULTS.clientName,
                title: "JArchi Codex Client",
                version: DEFAULTS.clientVersion
            }
        }, timeout);

        _sendNotification("initialized");

        return initResult;
    }

    /**
     * Disconnect from the Codex app-server.
     */
    function disconnect() {
        if (!socket) return;
        try {
            // Send WebSocket close frame (status 1000 = normal closure)
            var closePayload = new ByteArray(2);
            closePayload[0] = 0x03;  // 1000 >>> 8
            closePayload[1] = -24;   // 1000 & 0xFF as signed byte (0xE8)
            _writeFrame(0x08, closePayload);
        } catch (e) { /* ignore */ }
        try { din.close(); } catch (e) { /* ignore */ }
        try { out.close(); } catch (e) { /* ignore */ }
        try { socket.close(); } catch (e) { /* ignore */ }
        socket = null; din = null; out = null;
        connected = false;
        bufferedNotifications = [];
    }

    /**
     * Start a new conversation thread.
     *
     * @param {Object} [options]
     * @param {string} [options.model] - Model to use
     * @param {string} [options.reasoningEffort] - Reasoning effort level
     * @param {string} [options.cwd] - Working directory
     * @param {string} [options.approvalPolicy] - "never", "unlessTrusted", etc.
     * @returns {Object} Thread object with id
     */
    function startThread(options) {
        options = options || {};
        var params = {};
        if (options.model) params.model = options.model;
        if (options.reasoningEffort) params.reasoningEffort = options.reasoningEffort;
        if (options.cwd) params.cwd = options.cwd;
        if (options.approvalPolicy) params.approvalPolicy = options.approvalPolicy;

        var result = _sendRequest("thread/start", params);
        return result.thread;
    }

    /**
     * Resume an existing thread.
     *
     * @param {string} threadId - The thread ID to resume
     * @returns {Object} Thread object
     */
    function resumeThread(threadId) {
        var result = _sendRequest("thread/resume", { threadId: threadId });
        return result.thread;
    }

    /**
     * Send a prompt and collect the full response.
     *
     * If options.onPoll is provided, uses non-blocking polling so the caller
     * can pump their event loop (UI stays responsive during LLM thinking).
     * Without onPoll, uses the original blocking approach.
     *
     * @param {string} threadId - Thread to send to
     * @param {string} text - User prompt text
     * @param {Object} [options]
     * @param {number} [options.timeout] - Turn timeout in ms (default 5min)
     * @param {Function} [options.onDelta] - Callback for streaming text deltas
     * @param {Function} [options.onPoll] - Called between reads for event loop pumping
     * @returns {{ text: string, turnId: string, status: string, items: Array }}
     */
    function ask(threadId, text, options) {
        options = options || {};

        // Non-blocking path when onPoll is provided
        if (options.onPoll) {
            return _askStreaming(threadId, text, options);
        }

        // Original blocking path
        var timeout = options.timeout || DEFAULTS.turnTimeout;

        var turnParams = {
            threadId: threadId,
            input: [{ type: "text", text: text }]
        };

        if (options.outputSchema) {
            turnParams.outputSchema = options.outputSchema;
        }

        var result = _sendRequest("turn/start", turnParams);

        var turnId = result.turn.id;
        return _collectTurnResponse(turnId, timeout, options.onDelta);
    }

    /**
     * List conversation threads.
     *
     * @param {Object} [options]
     * @param {string} [options.cursor] - Pagination cursor
     * @param {number} [options.limit] - Page size
     * @returns {{ threads: Array, nextCursor: string|null }}
     */
    function listThreads(options) {
        options = options || {};
        var params = {};
        if (options.cursor) params.cursor = options.cursor;
        if (options.limit) params.limit = options.limit;

        var result = _sendRequest("thread/list", params);
        return { threads: result.data, nextCursor: result.nextCursor };
    }

    /**
     * Interrupt a running turn.
     *
     * @param {string} threadId
     * @param {string} turnId
     */
    function interrupt(threadId, turnId) {
        _sendRequest("turn/interrupt", { threadId: threadId, turnId: turnId });
    }

    /**
     * Check whether the client is currently connected.
     * @returns {boolean}
     */
    function isConnected() {
        return connected && socket !== null;
    }

    /**
     * Read the server configuration.
     * @returns {Object} Server configuration object
     */
    function readConfig() {
        return _sendRequest("config/read", {});
    }

    /**
     * List available models on the server.
     * @returns {Object} Model list with data array
     */
    function listModels() {
        return _sendRequest("model/list", {});
    }

    // ── Model context builder ───────────────────────────────────────────

    /**
     * Serialize ArchiMate model data into a prompt-ready text string.
     *
     * @param {Object} [options]
     * @param {*} [options.elements] - jArchi collection or array (default: all)
     * @param {boolean} [options.relationships] - Include relationships (default true)
     * @param {Array} [options.views] - Views to describe (default none)
     * @param {boolean} [options.includeProperties] - Include properties (default false)
     * @param {boolean} [options.includeDocumentation] - Include docs (default true)
     * @param {number} [options.maxElements] - Limit element count (default 200)
     * @returns {string} Markdown-formatted context string
     */
    function buildModelContext(options) {
        options = options || {};
        var includeRels = options.relationships !== false;
        var includeDocs = options.includeDocumentation !== false;
        var includeProps = options.includeProperties === true;
        var maxElements = options.maxElements || 200;

        var lines = [];

        // ── Elements ────────────────────────────────────────────────────
        var elements = options.elements || $("element");
        var elementList = [];
        elements.each(function (el) {
            if (elementList.length >= maxElements) return;
            elementList.push(el);
        });

        lines.push("## Elements (" + elementList.length + ")");
        for (var i = 0; i < elementList.length; i++) {
            var el = elementList[i];
            var typeName = _formatType(el.type);
            var line = "- " + typeName + ': "' + el.name + '"';
            if (includeDocs && el.documentation) {
                var doc = el.documentation.replace(/\n/g, " ");
                if (doc.length > 120) doc = doc.substring(0, 117) + "...";
                line += " — " + doc;
            }
            lines.push(line);

            if (includeProps) {
                var props = el.prop();
                if (props && props.length) {
                    for (var p = 0; p < props.length; p++) {
                        lines.push("  - " + props[p] + ": " + el.prop(props[p]));
                    }
                }
            }
        }

        // ── Relationships ───────────────────────────────────────────────
        if (includeRels) {
            var rels = $("relationship");
            var relList = [];
            rels.each(function (r) { relList.push(r); });

            lines.push("");
            lines.push("## Relationships (" + relList.length + ")");
            for (var j = 0; j < relList.length; j++) {
                var r = relList[j];
                var relType = _formatRelType(r.type);
                var src = r.source ? r.source.name : "?";
                var tgt = r.target ? r.target.name : "?";
                lines.push('- "' + src + '" --[' + relType + ']--> "' + tgt + '"');
            }
        }

        // ── Views ───────────────────────────────────────────────────────
        if (options.views && options.views.length) {
            lines.push("");
            for (var v = 0; v < options.views.length; v++) {
                var view = options.views[v];
                lines.push('## View: "' + view.name + '"');

                var children = $(view).children();
                var names = [];
                children.each(function (child) {
                    if (child.concept) names.push(child.concept.name);
                    else if (child.name) names.push(child.name);
                });
                if (names.length) {
                    lines.push("Contains: " + names.join(", "));
                }
            }
        }

        return lines.join("\n");
    }

    /**
     * Format an ArchiMate element type for display.
     * Converts "application-component" to "Application Component".
     */
    function _formatType(type) {
        if (!type) return "Unknown";
        return type.split("-").map(function (w) {
            return w.charAt(0).toUpperCase() + w.slice(1);
        }).join(" ");
    }

    /**
     * Format a relationship type for display.
     * Converts "serving-relationship" to "serving".
     */
    function _formatRelType(type) {
        if (!type) return "?";
        return type.replace("-relationship", "");
    }

    // ── Structured output schema ────────────────────────────────────────

    /**
     * The ArchiChangePlan JSON Schema, used as outputSchema for structured generation.
     * Generated from planOps.buildOutputSchema() — single source of truth.
     */
    var _OUTPUT_SCHEMA = planOps.buildOutputSchema();

    // ── Planning context builder ─────────────────────────────────────────

    /**
     * Build a structured JSON context object for plan-based interactions.
     * Unlike buildModelContext() which returns markdown, this returns a JSON
     * object suitable for structured prompts.
     *
     * @param {Object} [options]
     * @param {*} [options.elements] - jArchi collection or array (default: all)
     * @param {boolean} [options.relationships] - Include relationships (default true)
     * @param {boolean} [options.includeDocumentation] - Include docs (default false)
     * @param {boolean} [options.includeProperties] - Include properties (default false)
     * @param {number} [options.maxElements] - Limit element count (default 200)
     * @param {string[]} [options.allowedOps] - Allowed operations (default all)
     * @returns {Object} Planning context JSON object
     */
    function buildPlanningContext(options) {
        options = options || {};
        var includeRels = options.relationships !== false;
        var includeDocs = options.includeDocumentation === true;
        var includeProps = options.includeProperties === true;
        var maxElements = options.maxElements || 200;

        var allowedOps = options.allowedOps || planOps.getValidOps();
        var allowedRelTypes = planOps.RELATIONSHIP_LABELS;

        // ── Collect elements ─────────────────────────────────────────────
        var elementSource = options.elements || $("element");
        var elementList = [];
        var elementIds = {};

        elementSource.each(function (el) {
            if (elementList.length >= maxElements) return;
            var entry = {
                id: el.id,
                name: el.name,
                type: _formatType(el.type)
            };
            if (includeDocs && el.documentation) {
                entry.documentation = el.documentation;
            }
            if (includeProps) {
                var propNames = el.prop();
                if (propNames && propNames.length) {
                    entry.properties = {};
                    for (var p = 0; p < propNames.length; p++) {
                        entry.properties[propNames[p]] = el.prop(propNames[p]);
                    }
                }
            }
            elementList.push(entry);
            elementIds[el.id] = true;
        });

        // ── Collect relationships ────────────────────────────────────────
        var relList = [];
        if (includeRels) {
            var rels = $("relationship");
            rels.each(function (r) {
                // Only include relationships between in-scope elements
                if (r.source && r.target && elementIds[r.source.id] && elementIds[r.target.id]) {
                    relList.push({
                        id: r.id,
                        type: _formatRelType(r.type),
                        source_id: r.source.id,
                        target_id: r.target.id,
                        name: r.name || ""
                    });
                }
            });
        }

        var scopeMode = options.elements ? "selected" : "all";

        // ── Collect views ───────────────────────────────────────────────
        var viewList = [];
        $("archimate-diagram-model").each(function (v) {
            viewList.push({ id: v.id, name: v.name });
        });

        // ── Collect folder paths ────────────────────────────────────────
        var folderPaths = [];
        function _collectFolders(parent, prefix) {
            $(parent).children("folder").each(function (f) {
                var path = prefix ? prefix + "/" + f.name : f.name;
                folderPaths.push(path);
                _collectFolders(f, path);
            });
        }
        // Walk top-level folders
        $("folder").each(function (f) {
            var p = $(f).parent();
            // Top-level folders have no folder parent
            if (!p || p.size() === 0 || !p.first() || !p.first().type || p.first().type.indexOf("folder") < 0) {
                folderPaths.push(f.name);
                _collectFolders(f, f.name);
            }
        });

        return {
            schema_version: planOps.SCHEMA_VERSION,
            scope: {
                mode: scopeMode,
                element_count: elementList.length,
                relationship_count: relList.length,
                view_count: viewList.length
            },
            allowed_ops: allowedOps,
            allowed_relationship_types: allowedRelTypes,
            elements: elementList,
            relationships: relList,
            views: viewList,
            folders: folderPaths
        };
    }

    // ── Relationship guide builder ──────────────────────────────────────

    /**
     * Build a compact reference of valid relationships for the element types
     * present in the planning context. Uses relationshipMatrix to look up
     * which relationship types are allowed for each source→target type pair.
     *
     * @param {Object} context - Planning context from buildPlanningContext()
     * @returns {string} Markdown-formatted relationship guide
     */
    function _buildRelationshipGuide(context) {
        if (!context || !context.elements || !context.elements.length) return "";
        if (typeof relationshipMatrix === "undefined") return "";

        // Collect unique element type labels from context
        var typeLabelSet = {};
        for (var i = 0; i < context.elements.length; i++) {
            typeLabelSet[context.elements[i].type] = true;
        }
        var typeLabels = Object.keys(typeLabelSet).sort();
        if (typeLabels.length === 0) return "";

        // Convert "Application Component" → "application-component"
        function labelToKey(label) {
            return label.toLowerCase().replace(/ /g, "-");
        }

        var lines = [];
        lines.push("## Allowed Relationships Reference");
        lines.push("CRITICAL: Only create relationships listed below for each source→target type combination.");
        lines.push("If a source→target pair is not listed, no relationship can be created between them.\n");

        for (var s = 0; s < typeLabels.length; s++) {
            var sourceKey = labelToKey(typeLabels[s]);
            if (!relationshipMatrix.isKnownType(sourceKey)) continue;

            var entries = [];
            for (var t = 0; t < typeLabels.length; t++) {
                var targetKey = labelToKey(typeLabels[t]);
                if (!relationshipMatrix.isKnownType(targetKey)) continue;

                var allowed = relationshipMatrix.getAllowed(sourceKey, targetKey);
                if (allowed.length === 0) continue;

                var labels = [];
                for (var r = 0; r < allowed.length; r++) {
                    labels.push(relationshipMatrix.getRelationshipLabel(allowed[r]));
                }
                entries.push("  -> " + typeLabels[t] + ": " + labels.join(", "));
            }

            if (entries.length > 0) {
                lines.push(typeLabels[s] + ":");
                for (var e = 0; e < entries.length; e++) {
                    lines.push(entries[e]);
                }
            }
        }

        return lines.join("\n");
    }

    // ── Plan prompt builder ──────────────────────────────────────────────

    function _buildPlanPrompt(request, context) {
        var relGuide = _buildRelationshipGuide(context);

        return "You are an ArchiMate model assistant. Your task is to produce a structured change plan.\n\n" +
            "## Rules\n" +
            "1. Return ONLY a valid JSON object matching the ArchiChangePlan schema.\n" +
            "2. For existing elements, use their IDs from the context below — never invent IDs for existing elements.\n" +
            "3. For new elements, use create_element with a ref_id (e.g. \"ref-1\", \"ref-2\"). " +
               "Subsequent actions can reference these ref_ids in element_id, source_id, or target_id fields.\n" +
            "4. For new views, use create_view with a ref_id. " +
               "Subsequent add_to_view actions can reference this ref_id in the view_id field.\n" +
            "5. Allowed operations: " + context.allowed_ops.join(", ") + "\n" +
            "6. Allowed relationship types: " + context.allowed_relationship_types.join(", ") + "\n" +
            "7. If the request is unclear, set status to \"needs_clarification\" with questions.\n" +
            "8. If the request cannot or should not be fulfilled, set status to \"refusal\".\n" +
            "9. If you can fulfill it, set status to \"ready\" with concrete actions.\n" +
            "10. schema_version must be \"" + planOps.SCHEMA_VERSION + "\".\n" +
            "11. Do not wrap the JSON in markdown code fences.\n" +
            "12. Order actions: create_element/create_view before any action that references their ref_id. " +
                "Place delete actions last.\n" +
            "13. element_id accepts element IDs, relationship IDs, element ref_ids, OR view ref_ids for: " +
                "set_documentation, set_property, rename_element, remove_property, move_to_folder.\n" +
            "14. delete_element cascades — it automatically removes all attached relationships.\n" +
            "15. add_to_view coordinates (x, y, width, height) are optional — omit them for auto-grid layout.\n" +
            "16. Connections between elements on a view are auto-added — do NOT create them manually.\n" +
            "17. move_to_folder uses /-separated paths matching the folder structure (e.g. \"Business/Actors\").\n" +
            "18. Limit plans to at most 150 actions. For large requests, focus on the most important " +
                "elements and relationships. Note in the summary what was omitted or simplified, " +
                "so the user can request follow-up plans for specific areas.\n" +
            "19. CRITICAL: Before creating any relationship, verify the source type → target type → " +
                "relationship type combination is valid per the 'Allowed Relationships Reference' below. " +
                "Invalid relationships will be rejected. Not all relationship types work between all " +
                "element types — consult the reference for each specific pair.\n\n" +
            (relGuide ? relGuide + "\n\n" : "") +
            "## Model Context\n" +
            JSON.stringify(context, null, 2) + "\n\n" +
            "## User Request\n" +
            request;
    }

    // ── JSON extraction ──────────────────────────────────────────────────

    /**
     * Extract a JSON object from text that may contain surrounding prose.
     * Tries: direct parse → first {...} block → markdown code fence → null.
     */
    function _extractJsonFromText(text) {
        if (!text || typeof text !== "string") return null;

        text = text.trim();

        // Try 1: direct parse
        try {
            var obj = JSON.parse(text);
            if (obj && typeof obj === "object") return obj;
        } catch (e) { /* fall through */ }

        // Try 2: find first {...} block (greedy)
        var start = text.indexOf("{");
        var end = text.lastIndexOf("}");
        if (start >= 0 && end > start) {
            try {
                var obj2 = JSON.parse(text.substring(start, end + 1));
                if (obj2 && typeof obj2 === "object") return obj2;
            } catch (e2) { /* fall through */ }
        }

        // Try 3: markdown code fence
        var fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (fenceMatch) {
            try {
                var obj3 = JSON.parse(fenceMatch[1].trim());
                if (obj3 && typeof obj3 === "object") return obj3;
            } catch (e3) { /* fall through */ }
        }

        return null;
    }

    // ── Item content extraction ─────────────────────────────────────────

    /**
     * Check if an item is from the assistant (not user input).
     * Codex uses item.type (e.g. "agentMessage", "userMessage"), not item.role.
     */
    function _isAssistantItem(item) {
        if (!item) return false;
        // Codex protocol: check item.type
        if (item.type === "agentMessage") return true;
        if (item.type === "userMessage") return false;
        // Fallback: check role field
        if (item.role === "assistant") return true;
        if (item.role === "user") return false;
        // Unknown type — include it (could be reasoning, plan, etc.)
        return true;
    }

    /**
     * Extract text content from completed assistant items.
     * Codex may deliver structured output in item/completed notifications
     * rather than through streaming deltas.
     */
    function _extractTextFromItems(items) {
        if (!items || !items.length) return null;
        for (var i = 0; i < items.length; i++) {
            var entry = items[i];
            if (entry.event !== "completed" || !entry.item) continue;
            var item = entry.item;
            if (!_isAssistantItem(item)) continue;

            if (item.content && Array.isArray(item.content)) {
                for (var c = 0; c < item.content.length; c++) {
                    var block = item.content[c];
                    if (block.type === "text" && block.text) return block.text;
                    if (block.type === "output_text" && block.text) return block.text;
                }
            }

            if (item.text) return item.text;
            if (item.output && typeof item.output === "string") return item.output;
        }
        return null;
    }

    /**
     * Try to extract a JSON plan object directly from assistant item data.
     */
    function _extractJsonFromItems(items) {
        if (!items || !items.length) return null;
        for (var i = 0; i < items.length; i++) {
            var entry = items[i];
            if (entry.event !== "completed" || !entry.item) continue;
            var item = entry.item;
            if (!_isAssistantItem(item)) continue;

            if (item.content && Array.isArray(item.content)) {
                for (var c = 0; c < item.content.length; c++) {
                    var block = item.content[c];
                    var text = block.text || block.output;
                    if (text) {
                        var obj = _extractJsonFromText(text);
                        if (obj) return obj;
                    }
                    if (block.type === "json" && block.data) return block.data;
                }
            }

            if (item.text) {
                var obj2 = _extractJsonFromText(item.text);
                if (obj2) return obj2;
            }
        }
        return null;
    }

    // ── askPlan ──────────────────────────────────────────────────────────

    /**
     * Send a planning request and return a validated ArchiChangePlan.
     *
     * Orchestrates: build context → build prompt → ask with outputSchema →
     * extract JSON → validate → return result.
     *
     * @param {string} threadId - Thread to send to
     * @param {string} request - User intent / instruction text
     * @param {Object} [options]
     * @param {Object} [options.context] - Pre-built planning context (from buildPlanningContext)
     * @param {Object} [options.scope] - Scope map for semantic validation (id → true)
     * @param {number} [options.timeout] - Turn timeout in ms
     * @param {Function} [options.onDelta] - Streaming callback
     * @returns {{ ok: boolean, raw: string, plan: Object|null, validation: Object|null, error: string|null }}
     */
    function askPlan(threadId, request, options) {
        options = options || {};

        var context = options.context || buildPlanningContext();
        var prompt = _buildPlanPrompt(request, context);

        var askResult = ask(threadId, prompt, {
            outputSchema: _OUTPUT_SCHEMA,
            timeout: options.timeout,
            onDelta: options.onDelta,
            onPoll: options.onPoll
        });

        // Collect text from all possible sources
        var rawText = askResult.text || "";

        // If no text from deltas, try extracting from completed items
        if (!rawText) {
            rawText = _extractTextFromItems(askResult.items) || "";
        }

        var result = {
            ok: false,
            raw: rawText,
            plan: null,
            validation: null,
            error: null,
            items: askResult.items,
            turnStatus: askResult.status
        };

        // Extract JSON from response text or from items
        var plan = _extractJsonFromText(rawText);

        // If still no plan, try extracting JSON directly from item content
        if (!plan && askResult.items) {
            plan = _extractJsonFromItems(askResult.items);
        }

        if (!plan) {
            result.error = "Failed to extract JSON from response";
            return result;
        }

        // Normalize flat structured output: null out fields that don't belong to each op
        planOps.normalizeActions(plan);
        result.plan = plan;

        // Validate
        var validation = planValidator.validate(plan, { scope: options.scope });
        result.validation = validation;

        if (!validation.schemaValid) {
            result.error = "Schema validation failed: " + validation.errors.join("; ");
            return result;
        }
        if (!validation.semanticValid) {
            result.error = "Semantic validation failed: " + validation.errors.join("; ");
            return result;
        }

        result.ok = true;
        return result;
    }

    // ── Module export ───────────────────────────────────────────────────

    var codexClient = {
        connect: connect,
        disconnect: disconnect,
        startThread: startThread,
        resumeThread: resumeThread,
        ask: ask,
        askPlan: askPlan,
        listThreads: listThreads,
        interrupt: interrupt,
        isConnected: isConnected,
        readConfig: readConfig,
        listModels: listModels,
        buildModelContext: buildModelContext,
        buildPlanningContext: buildPlanningContext
    };

    if (typeof globalThis !== "undefined") globalThis.codexClient = codexClient;
    if (typeof module !== "undefined" && module.exports) module.exports = codexClient;
})();
