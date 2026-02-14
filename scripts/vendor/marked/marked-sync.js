/**
 * marked-sync.js - Synchronous Markdown parser wrapper for JArchi/GraalJS
 *
 * Loads the marked UMD bundle and exposes it as globalThis.marked
 * for use in JArchi's GraalJS environment.
 *
 * Usage:
 *   load(__DIR__ + "vendor/marked/marked-sync.js");
 *   var html = marked.parse("# Hello World");
 *
 * @module vendor/marked/marked-sync
 */
(function () {
    "use strict";

    // Guard against double-loading
    if (typeof globalThis !== "undefined" && typeof globalThis.marked !== "undefined") {
        return;
    }

    // Determine base directory for sibling files
    var markedDir = typeof __DIR__ !== "undefined" ? __DIR__ : "";

    // Read the marked UMD file using Java IO
    var Files = Java.type("java.nio.file.Files");
    var JPath = Java.type("java.nio.file.Paths");
    var JString = Java.type("java.lang.String");
    var markedFilePath = JPath.get(markedDir + "marked.min.js");
    var markedCode = new JString(Files.readAllBytes(markedFilePath), "UTF-8");

    // Execute in a function scope with module/exports shims
    var shimModule = { exports: {} };
    var markedFn = new Function(
        "module", "exports", "global", "window", "self",
        String(markedCode)
    );
    markedFn(
        shimModule, shimModule.exports, globalThis, globalThis, globalThis
    );

    // Extract marked from the shim exports
    var markedLib = shimModule.exports.marked
        || shimModule.exports["default"]
        || shimModule.exports;

    if (!markedLib || typeof markedLib.parse !== "function") {
        throw new Error(
            "Failed to load marked. Ensure marked.min.js is in the same directory."
        );
    }

    // Export
    if (typeof globalThis !== "undefined") {
        globalThis.marked = markedLib;
    }

    if (typeof module !== "undefined" && module.exports) {
        module.exports = markedLib;
    }
})();
