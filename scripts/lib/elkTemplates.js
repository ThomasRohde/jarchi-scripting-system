/**
 * @module elkTemplates
 * @description Template data layer for ELK layout settings. Provides 8 built-in
 * templates optimized for common ArchiMate viewpoint patterns, plus JSON file
 * persistence for user-created and modified templates.
 * @version 1.0.0
 * @author Thomas Rohde
 * @lastModifiedDate 2026-02-14
 */
(function () {
    "use strict";

    if (typeof globalThis !== "undefined" && typeof globalThis.elkTemplates !== "undefined") return;

    var Files = Java.type("java.nio.file.Files");
    var Paths = Java.type("java.nio.file.Paths");
    var JString = Java.type("java.lang.String");
    var StandardOpenOption = Java.type("java.nio.file.StandardOpenOption");

    // =========================================================================
    // Template schema — the 18 core fields stored per template
    // =========================================================================

    var TEMPLATE_FIELDS = [
        "algorithm", "direction",
        "nodeNodeSpacing", "edgeEdgeSpacing", "edgeNodeSpacing",
        "componentSpacing", "betweenLayerSpacing", "edgeNodeBetweenLayers", "padding",
        "edgeRouting", "mergeEdges", "separateComponents", "connectionStyle",
        "portConstraints", "portAlignment", "portAssignment", "portSpacing",
        "hierarchy"
    ];

    // =========================================================================
    // Built-in templates — optimized for ArchiMate viewpoint patterns
    // =========================================================================

    var BUILT_IN_TEMPLATES = [
        {
            name: "Default (Top-Down)",
            algorithm: "layered", direction: "DOWN",
            nodeNodeSpacing: 60, edgeEdgeSpacing: 15, edgeNodeSpacing: 20,
            componentSpacing: 50, betweenLayerSpacing: 80, edgeNodeBetweenLayers: 25, padding: 30,
            edgeRouting: "ORTHOGONAL", mergeEdges: false, separateComponents: true, connectionStyle: "orthogonal",
            portConstraints: "FIXED_SIDE", portAlignment: "CENTER", portAssignment: "direction", portSpacing: 12,
            hierarchy: "flat"
        },
        {
            name: "Flow (Left-to-Right)",
            algorithm: "layered", direction: "RIGHT",
            nodeNodeSpacing: 50, edgeEdgeSpacing: 15, edgeNodeSpacing: 20,
            componentSpacing: 60, betweenLayerSpacing: 90, edgeNodeBetweenLayers: 25, padding: 30,
            edgeRouting: "ORTHOGONAL", mergeEdges: false, separateComponents: true, connectionStyle: "orthogonal",
            portConstraints: "FIXED_SIDE", portAlignment: "CENTER", portAssignment: "direction", portSpacing: 12,
            hierarchy: "flat"
        },
        {
            name: "Cooperation (Network)",
            algorithm: "stress", direction: "DOWN",
            nodeNodeSpacing: 70, edgeEdgeSpacing: 15, edgeNodeSpacing: 20,
            componentSpacing: 60, betweenLayerSpacing: 80, edgeNodeBetweenLayers: 25, padding: 30,
            edgeRouting: "ORTHOGONAL", mergeEdges: false, separateComponents: true, connectionStyle: "orthogonal",
            portConstraints: "FIXED_SIDE", portAlignment: "CENTER", portAssignment: "direction", portSpacing: 12,
            hierarchy: "flat"
        },
        {
            name: "Organization (Tree)",
            algorithm: "mrtree", direction: "DOWN",
            nodeNodeSpacing: 70, edgeEdgeSpacing: 15, edgeNodeSpacing: 20,
            componentSpacing: 50, betweenLayerSpacing: 80, edgeNodeBetweenLayers: 25, padding: 30,
            edgeRouting: "ORTHOGONAL", mergeEdges: false, separateComponents: true, connectionStyle: "orthogonal",
            portConstraints: "FIXED_SIDE", portAlignment: "CENTER", portAssignment: "direction", portSpacing: 12,
            hierarchy: "flat"
        },
        {
            name: "Deployment (Grouped)",
            algorithm: "layered", direction: "DOWN",
            nodeNodeSpacing: 50, edgeEdgeSpacing: 15, edgeNodeSpacing: 20,
            componentSpacing: 50, betweenLayerSpacing: 80, edgeNodeBetweenLayers: 25, padding: 40,
            edgeRouting: "ORTHOGONAL", mergeEdges: false, separateComponents: true, connectionStyle: "orthogonal",
            portConstraints: "FIXED_SIDE", portAlignment: "CENTER", portAssignment: "direction", portSpacing: 12,
            hierarchy: "hierarchical"
        },
        {
            name: "Capability Map",
            algorithm: "layered", direction: "DOWN",
            nodeNodeSpacing: 70, edgeEdgeSpacing: 15, edgeNodeSpacing: 20,
            componentSpacing: 60, betweenLayerSpacing: 100, edgeNodeBetweenLayers: 30, padding: 50,
            edgeRouting: "ORTHOGONAL", mergeEdges: false, separateComponents: true, connectionStyle: "orthogonal",
            portConstraints: "FIXED_SIDE", portAlignment: "CENTER", portAssignment: "direction", portSpacing: 12,
            hierarchy: "hierarchical"
        },
        {
            name: "Compact",
            algorithm: "layered", direction: "DOWN",
            nodeNodeSpacing: 35, edgeEdgeSpacing: 8, edgeNodeSpacing: 10,
            componentSpacing: 25, betweenLayerSpacing: 45, edgeNodeBetweenLayers: 15, padding: 15,
            edgeRouting: "ORTHOGONAL", mergeEdges: true, separateComponents: true, connectionStyle: "orthogonal",
            portConstraints: "FIXED_SIDE", portAlignment: "CENTER", portAssignment: "direction", portSpacing: 8,
            hierarchy: "flat"
        },
        {
            name: "Landscape",
            algorithm: "layered", direction: "RIGHT",
            nodeNodeSpacing: 55, edgeEdgeSpacing: 15, edgeNodeSpacing: 20,
            componentSpacing: 80, betweenLayerSpacing: 80, edgeNodeBetweenLayers: 25, padding: 30,
            edgeRouting: "ORTHOGONAL", mergeEdges: false, separateComponents: true, connectionStyle: "orthogonal",
            portConstraints: "FIXED_SIDE", portAlignment: "CENTER", portAssignment: "direction", portSpacing: 12,
            hierarchy: "flat"
        }
    ];

    // =========================================================================
    // Helpers
    // =========================================================================

    /**
     * Deep copy an array of template objects.
     * @param {Array} templates
     * @returns {Array}
     */
    function deepCopy(templates) {
        return JSON.parse(JSON.stringify(templates));
    }

    /**
     * Resolve the storage file path.
     * Uses __DIR__ which points to the scripts/ directory when loaded from the main .ajs file.
     * @returns {Object} Java Path object
     */
    function getStoragePath() {
        return Paths.get(__DIR__ + "data/elk-templates.json");
    }

    // =========================================================================
    // Public API
    // =========================================================================

    /**
     * Load templates from the JSON file on disk.
     * Returns built-in defaults if the file does not exist or is unreadable.
     * @returns {Array} Array of template objects
     */
    function loadTemplates() {
        try {
            var path = getStoragePath();
            if (Files.exists(path)) {
                var content = new JString(Files.readAllBytes(path), "UTF-8");
                var parsed = JSON.parse(content);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch (e) {
            // Fall through to defaults
        }
        return deepCopy(BUILT_IN_TEMPLATES);
    }

    /**
     * Save templates to the JSON file on disk.
     * Creates the data/ directory if it does not exist.
     * @param {Array} templates - Array of template objects
     */
    function saveTemplates(templates) {
        var path = getStoragePath();
        var dir = path.getParent();
        if (!Files.exists(dir)) {
            Files.createDirectories(dir);
        }
        var json = JSON.stringify(templates, null, 2);
        var bytes = new JString(json).getBytes("UTF-8");
        Files.write(path, bytes, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
    }

    /**
     * Reset templates to built-in defaults, saving to disk.
     * @returns {Array} Fresh copy of built-in templates
     */
    function resetToDefaults() {
        var templates = deepCopy(BUILT_IN_TEMPLATES);
        saveTemplates(templates);
        return templates;
    }

    /**
     * Create a template object from a name and a core options object.
     * Only copies the 18 template fields.
     * @param {string} name - Template name
     * @param {Object} coreOpts - Object with the 18 core option fields
     * @returns {Object} Template object
     */
    function createTemplate(name, coreOpts) {
        var template = { name: name };
        for (var i = 0; i < TEMPLATE_FIELDS.length; i++) {
            var field = TEMPLATE_FIELDS[i];
            if (coreOpts.hasOwnProperty(field)) {
                template[field] = coreOpts[field];
            }
        }
        return template;
    }

    /**
     * Get the list of core template field names.
     * @returns {Array<string>}
     */
    function getTemplateFields() {
        return TEMPLATE_FIELDS.slice();
    }

    // =========================================================================
    // Export
    // =========================================================================

    var elkTemplates = {
        loadTemplates: loadTemplates,
        saveTemplates: saveTemplates,
        resetToDefaults: resetToDefaults,
        createTemplate: createTemplate,
        getTemplateFields: getTemplateFields
    };

    if (typeof globalThis !== "undefined") globalThis.elkTemplates = elkTemplates;
    if (typeof module !== "undefined" && module.exports) module.exports = elkTemplates;

})();
