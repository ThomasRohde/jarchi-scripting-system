/**
 * @module registryScanner
 * @description Scans the registry directory for JSON files, parses them,
 * validates required fields, fills defaults for optional fields, and
 * returns an array of normalized ScriptDescriptor objects.
 * @version 1.0.0
 */
(function () {
    "use strict";

    if (typeof globalThis !== "undefined" && typeof globalThis.registryScanner !== "undefined") return;

    var Files = Java.type("java.nio.file.Files");
    var Paths = Java.type("java.nio.file.Paths");
    var JString = Java.type("java.lang.String");

    /**
     * Scan the registry directory for JSON files and parse them into descriptors.
     * @param {string} registryDir - Path to the registry directory
     * @returns {Object} {descriptors: ScriptDescriptor[], errors: string[]}
     */
    function scan(registryDir) {
        var descriptors = [];
        var errors = [];
        var seenIds = {};

        var dirPath = Paths.get(registryDir);
        if (!Files.exists(dirPath) || !Files.isDirectory(dirPath)) {
            errors.push("Registry directory not found: " + registryDir);
            return { descriptors: descriptors, errors: errors };
        }

        // Enumerate *.json files
        var stream = null;
        try {
            stream = Files.newDirectoryStream(dirPath, "*.json");
            var iterator = stream.iterator();

            while (iterator.hasNext()) {
                var filePath = iterator.next();
                var fileName = String(filePath.getFileName());

                try {
                    var content = new JString(Files.readAllBytes(filePath), "UTF-8");
                    var entry = JSON.parse(String(content));

                    // Validate required fields
                    var validationErrors = validate(entry, fileName, registryDir);
                    if (validationErrors.length > 0) {
                        for (var e = 0; e < validationErrors.length; e++) {
                            errors.push(fileName + ": " + validationErrors[e]);
                        }
                        continue;
                    }

                    // Check for duplicate id
                    if (seenIds[entry.id]) {
                        errors.push(fileName + ": Duplicate id '" + entry.id + "' (first seen in " + seenIds[entry.id] + ")");
                        continue;
                    }
                    seenIds[entry.id] = fileName;

                    // Normalize and fill defaults
                    var descriptor = normalize(entry, registryDir);
                    descriptors.push(descriptor);

                } catch (parseError) {
                    errors.push(fileName + ": " + String(parseError));
                }
            }
        } finally {
            if (stream) {
                stream.close();
            }
        }

        return { descriptors: descriptors, errors: errors };
    }

    /**
     * Validate required fields in a registry entry.
     * @param {Object} entry - Parsed JSON entry
     * @param {string} fileName - Source file name (for error messages)
     * @param {string} registryDir - Registry directory path
     * @returns {string[]} Array of validation error messages
     */
    function validate(entry, fileName, registryDir) {
        var errors = [];

        if (!entry.id || typeof entry.id !== "string" || entry.id.trim().length === 0) {
            errors.push("Missing or empty 'id' field");
        }

        if (!entry.title || typeof entry.title !== "string" || entry.title.trim().length === 0) {
            errors.push("Missing or empty 'title' field");
        }

        if (!entry.category || !Array.isArray(entry.category) || entry.category.length === 0) {
            errors.push("Missing or empty 'category' array");
        }

        if (!entry.script || !entry.script.path || typeof entry.script.path !== "string" || entry.script.path.trim().length === 0) {
            errors.push("Missing or empty 'script.path' field");
        } else {
            // Check that the script file exists (relative to scriptsRoot)
            var scriptsRoot = menuConfig.getScriptsRoot();
            var scriptPath = Paths.get(scriptsRoot + entry.script.path);
            if (!Files.exists(scriptPath)) {
                errors.push("Script file not found: " + entry.script.path);
            }
        }

        return errors;
    }

    /**
     * Normalize a registry entry into a ScriptDescriptor with defaults.
     * @param {Object} entry - Validated registry entry
     * @param {string} registryDir - Registry directory path
     * @returns {Object} Normalized ScriptDescriptor
     */
    function normalize(entry, registryDir) {
        var run = entry.run || {};
        var sel = entry.selection || {};
        var help = entry.help || {};

        return {
            id: entry.id,
            title: entry.title,
            category: entry.category,
            order: (typeof entry.order === "number") ? entry.order : 100,

            script: {
                path: entry.script.path
            },

            description: entry.description || "",
            tags: entry.tags || [],

            help: {
                markdown_path: help.markdown_path || ""
            },

            run: {
                danger_level: run.danger_level || "low",
                confirm_message: run.confirm_message || ""
            },

            selection: {
                types: sel.types || [],
                min: (typeof sel.min === "number") ? sel.min : 0,
                require_view: !!sel.require_view
            }
        };
    }

    var registryScanner = {
        scan: scan
    };

    if (typeof globalThis !== "undefined") globalThis.registryScanner = registryScanner;
    if (typeof module !== "undefined" && module.exports) module.exports = registryScanner;
})();
