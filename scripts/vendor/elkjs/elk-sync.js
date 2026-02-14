/**
 * elk-sync.js - Synchronous ELK layout wrapper for JArchi/GraalJS
 *
 * Provides elkLayout() which runs the ELK graph layout algorithm
 * synchronously, suitable for JArchi's GraalJS environment where
 * Web Workers and async patterns are not available.
 *
 * Usage:
 *   load(__DIR__ + "vendor/elkjs/elk-sync.js");
 *
 *   var graph = {
 *     id: "root",
 *     layoutOptions: { "elk.algorithm": "layered" },
 *     children: [
 *       { id: "n1", width: 100, height: 50 },
 *       { id: "n2", width: 100, height: 50 }
 *     ],
 *     edges: [
 *       { id: "e1", sources: ["n1"], targets: ["n2"] }
 *     ]
 *   };
 *
 *   var laid = elkLayout(graph);
 *   // laid.children[0].x, .y, etc. now contain computed positions
 *
 * @module vendor/elkjs/elk-sync
 * @version 0.9.3
 */
(function () {
  "use strict";

  // Guard against double-loading
  if (
    typeof globalThis !== "undefined" &&
    typeof globalThis.elkLayout !== "undefined"
  ) {
    return;
  }

  // --- Determine base directory for sibling files ---
  // __DIR__ is set by the caller's load() context, but inside this IIFE
  // we need the directory of THIS file to find elk-worker.min.js.
  // JArchi's load() sets __DIR__ to the directory of the loaded file.
  var elkDir = typeof __DIR__ !== "undefined" ? __DIR__ : "";

  // --- Shim environment for elk-worker.min.js ---
  // In JArchi's GraalJS, `module` and `exports` are read-only polyglot
  // bindings on globalThis — we cannot assign to them. Instead, we read the
  // worker file with Java IO and execute it inside a Function scope where
  // module/exports are injected as parameters, shadowing the read-only globals.
  //
  // The GWT-compiled worker also needs:
  //   - global/window for $wnd resolution (GWT global reference)
  //   - setTimeout/clearTimeout for FakeWorker dispatch
  // These aren't read-only, so we set them on globalThis too (needed because
  // the worker accesses them via $wnd.setTimeout, not bare setTimeout).
  //
  // IMPORTANT: We must NOT provide `self` — the worker's export logic checks
  // `typeof document === 'undefined' && typeof self !== 'undefined'` to detect
  // a web worker environment. If self is defined, it enters web worker mode
  // (sets self.onmessage) instead of CommonJS mode (module.exports = Worker).
  // By leaving self undefined, the code falls through to the CommonJS branch.

  var syncSetTimeout = function (fn) { fn(); };
  var syncClearTimeout = function () {};

  // Set globals the GWT worker accesses via $wnd.*
  // Do NOT set globalThis.self — see comment above
  if (typeof globalThis.global === "undefined") {
    globalThis.global = globalThis;
  }
  globalThis.setTimeout = syncSetTimeout;
  globalThis.clearTimeout = syncClearTimeout;

  // Read the worker file using Java IO
  var Files = Java.type("java.nio.file.Files");
  var JPath = Java.type("java.nio.file.Paths");
  var JString = Java.type("java.lang.String");
  var workerFilePath = JPath.get(elkDir + "elk-worker.min.js");
  var workerCode = new JString(Files.readAllBytes(workerFilePath), "UTF-8");

  // Execute in a function scope. Parameters shadow read-only polyglot bindings
  // (module, exports) and provide globals that may not resolve inside
  // new Function() in GraalJS's polyglot context.
  // We pass `global` and `window` (both as globalThis) for $wnd resolution,
  // but deliberately omit `self` so the export logic uses CommonJS mode.
  var shimModule = { exports: {} };
  var workerFn = new Function(
    "module", "exports", "setTimeout", "clearTimeout",
    "global", "window",
    String(workerCode)
  );
  workerFn(
    shimModule, shimModule.exports, syncSetTimeout, syncClearTimeout,
    globalThis, globalThis
  );

  // Capture the exported FakeWorker
  var ElkFakeWorker = shimModule.exports.Worker
    || (shimModule.exports["default"]);

  if (!ElkFakeWorker) {
    throw new Error(
      "Failed to load ELK worker. Ensure elk-worker.min.js is in the same directory."
    );
  }

  // --- Default algorithms ---
  var DEFAULT_ALGORITHMS = [
    "layered",
    "stress",
    "mrtree",
    "radial",
    "force",
    "disco",
    "sporeOverlap",
    "sporeCompaction",
    "rectpacking",
  ];

  /**
   * Perform synchronous ELK graph layout.
   *
   * The graph object is modified in-place with computed layout positions
   * (x, y coordinates on nodes, bend points on edges, etc.) and also returned.
   *
   * @param {Object} graph - ELK JSON graph (id, children, edges, layoutOptions, etc.)
   * @param {Object} [layoutOptions] - Top-level layout options override.
   *   If omitted, options from graph.layoutOptions are used.
   *   Common options:
   *     "elk.algorithm": "layered" | "stress" | "mrtree" | "radial" | "force"
   *     "elk.direction": "DOWN" | "RIGHT" | "UP" | "LEFT"
   *     "elk.spacing.nodeNode": "50"
   *     "elk.layered.spacing.nodeNodeBetweenLayers": "80"
   * @param {Object} [options] - Additional options
   * @param {boolean} [options.logging=false] - Enable layout logging
   * @param {boolean} [options.measureExecutionTime=false] - Measure time
   * @returns {Object} The graph object with layout positions applied
   * @throws {Error} If layout computation fails
   *
   * @example
   * // Simple layered layout
   * var result = elkLayout({
   *   id: "root",
   *   layoutOptions: { "elk.algorithm": "layered" },
   *   children: [
   *     { id: "n1", width: 100, height: 50 },
   *     { id: "n2", width: 100, height: 50 }
   *   ],
   *   edges: [
   *     { id: "e1", sources: ["n1"], targets: ["n2"] }
   *   ]
   * });
   *
   * @example
   * // Override layout options
   * var result = elkLayout(graph, {
   *   "elk.algorithm": "stress",
   *   "elk.spacing.nodeNode": "80"
   * });
   */
  function elkLayout(graph, layoutOptions, options) {
    if (!graph) {
      throw new Error("elkLayout: missing required 'graph' parameter");
    }

    // FakeWorker's closure already captured our synchronous setTimeout
    // from the new Function() scope, so no global shimming needed here.
    var result = null;
    var error = null;

    var worker = new ElkFakeWorker();
    worker.onmessage = function (e) {
      var data = e.data;
      if (data.error) {
        error = data.error;
      } else if (data.data !== undefined) {
        result = data.data;
      }
    };

    // Register algorithms
    worker.postMessage({
      id: 0,
      cmd: "register",
      algorithms: DEFAULT_ALGORITHMS,
    });

    if (error) {
      throw error;
    }

    // Perform layout
    worker.postMessage({
      id: 1,
      cmd: "layout",
      graph: graph,
      layoutOptions: layoutOptions || {},
      options: options || {},
    });

    if (error) {
      var msg =
        typeof error === "object" ? JSON.stringify(error) : String(error);
      throw new Error("ELK layout failed: " + msg);
    }

    return result;
  }

  // --- Export ---
  if (typeof globalThis !== "undefined") {
    globalThis.elkLayout = elkLayout;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = elkLayout;
  }
})();
