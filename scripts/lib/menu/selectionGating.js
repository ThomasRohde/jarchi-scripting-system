/**
 * @module selectionGating
 * @description Captures the current Archi selection and checks it against
 * registry-defined selection rules. Uses a permissive approach: scripts are
 * allowed when the selection contains the required types. Extra items of
 * other types are simply ignored.
 * @version 2.0.0
 */
(function () {
    "use strict";

    if (typeof globalThis !== "undefined" && typeof globalThis.selectionGating !== "undefined") return;

    /**
     * Detect the kind of a jArchi object.
     * @param {Object} obj - A jArchi object
     * @returns {string} One of: "element", "relationship", "view", "folder",
     *                   "diagram-object", "diagram-connection", "unknown"
     */
    function detectKind(obj) {
        var wrapped = $(obj);
        if (wrapped.is("diagram-model-connection")) return "diagram-connection";
        if (wrapped.is("diagram-model-object")) return "diagram-object";
        if (wrapped.is("archimate-diagram-model")) return "view";
        if (wrapped.is("element")) return "element";
        if (wrapped.is("relationship")) return "relationship";
        if (wrapped.is("folder")) return "folder";
        return "unknown";
    }

    /**
     * Check if an item's kind matches a required type.
     * - "element" matches both "element" and "diagram-object" (visual elements)
     * - "relationship" matches both "relationship" and "diagram-connection"
     * - Other types require an exact match.
     */
    function kindMatchesType(itemKind, type) {
        if (type === "element") return itemKind === "element" || itemKind === "diagram-object";
        if (type === "relationship") return itemKind === "relationship" || itemKind === "diagram-connection";
        return itemKind === type;
    }

    /**
     * Count selection items that match any of the given types.
     * @param {Object} selInfo - Result from captureSelection()
     * @param {string[]} types - Required types (empty = count all items)
     * @returns {number} Number of matching items
     */
    function countMatching(selInfo, types) {
        if (!types || types.length === 0) return selInfo.count;
        var count = 0;
        for (var i = 0; i < selInfo.items.length; i++) {
            for (var t = 0; t < types.length; t++) {
                if (kindMatchesType(selInfo.items[i].kind, types[t])) {
                    count++;
                    break;
                }
            }
        }
        return count;
    }

    /**
     * Walk up the diagram containment hierarchy to find the owning view.
     * @param {Object} diagramObj - A jArchi diagram-object or diagram-connection proxy
     * @returns {Object|null} The view proxy, or null if not found
     */
    function findContainingView(diagramObj) {
        try {
            var current = diagramObj;
            for (var i = 0; i < 50; i++) {
                if ($(current).is("archimate-diagram-model")) return current;
                var parents = $(current).parent();
                if (!parents || parents.size() === 0) return null;
                current = parents.first();
            }
        } catch (e) {
            // parent traversal not supported — fall through
        }
        return null;
    }

    /**
     * Detect the view currently open in the active editor tab.
     * Works even when the selection is in the model tree — the editor
     * stays active as long as a view tab is open.
     * @returns {{id: string, name: string}|null}
     */
    function getActiveEditorView() {
        try {
            var PlatformUI = Java.type("org.eclipse.ui.PlatformUI");
            var page = PlatformUI.getWorkbench().getActiveWorkbenchWindow().getActivePage();
            var editor = page.getActiveEditor();
            if (!editor) return null;
            var model = editor.getModel();
            if (!model) return null;
            var wrapped = $(model);
            if (wrapped.is("archimate-diagram-model")) {
                var v = wrapped.first();
                return { id: v.id, name: v.name || "" };
            }
        } catch (e) {
            // No workbench, no editor, or editor has no diagram model
        }
        return null;
    }

    /**
     * Capture the current selection state from Archi.
     *
     * View detection uses three tiers (first match wins):
     *   1. Explicit view object in the selection
     *   2. Diagram objects selected on a canvas → parent view
     *   3. Active editor tab is a view (covers model-tree selections)
     *
     * @returns {Object} Selection info: {items[], count, hasView, activeView, byKind}
     */
    function captureSelection() {
        var items = [];
        var hasView = false;
        var activeView = null;
        var byKind = {};
        var firstVisualProxy = null;

        $(selection).each(function (obj) {
            var kind = detectKind(obj);
            var item = {
                id: obj.id,
                name: obj.name || "",
                kind: kind,
                type: obj.type || ""
            };
            items.push(item);

            if (!byKind[kind]) byKind[kind] = [];
            byKind[kind].push(item);

            if (kind === "view") {
                hasView = true;
                if (!activeView) {
                    activeView = { id: obj.id, name: obj.name || "" };
                }
            }

            // Keep a proxy reference for view inference
            if (!firstVisualProxy && (kind === "diagram-object" || kind === "diagram-connection")) {
                firstVisualProxy = obj;
            }
        });

        // Tier 2: diagram objects imply their containing view
        if (!hasView && firstVisualProxy) {
            hasView = true;
            var view = findContainingView(firstVisualProxy);
            if (view) {
                activeView = { id: view.id, name: view.name || "" };
            }
        }

        // Tier 3: fall back to the active editor's view
        if (!hasView) {
            var editorView = getActiveEditorView();
            if (editorView) {
                hasView = true;
                activeView = editorView;
            }
        }

        return {
            items: items,
            count: items.length,
            hasView: hasView,
            activeView: activeView,
            byKind: byKind
        };
    }

    /**
     * Check selection against a descriptor's selection rules.
     *
     * Rules schema:
     *   types: string[]       - kinds the script works with (e.g. ["element"])
     *   min: number           - minimum matching items required (default 0)
     *   require_view: boolean - whether a view must be active/selected
     *
     * Behavior:
     *   - If types is empty and min is 0: always allowed (any selection is fine)
     *   - If types is non-empty: count items matching any listed type
     *   - If min > 0: at least that many matching items must be present
     *   - Extra items of non-matching types are always ignored
     *   - Inferred context counts: diagram objects on a view satisfy "view" type
     *
     * @param {Object} selInfo - Result from captureSelection()
     * @param {Object} rules - The selection rules from a descriptor
     * @returns {Object} {allowed: boolean, reason: string}
     */
    function checkRules(selInfo, rules) {
        if (!rules) return { allowed: true, reason: "" };

        // Check require_view
        if (rules.require_view && !selInfo.hasView) {
            return { allowed: false, reason: "Requires an active view (open or selected)." };
        }

        var types = rules.types || [];
        var min = (typeof rules.min === "number") ? rules.min : 0;

        // No type/count requirements — always allowed
        if (types.length === 0 && min === 0) {
            return { allowed: true, reason: "" };
        }

        // Count items matching the required types
        var matching = countMatching(selInfo, types);

        // Infer: diagram objects on a view imply a "view" is available,
        // even when no view object is explicitly selected
        if (selInfo.hasView && !selInfo.byKind["view"]) {
            for (var t = 0; t < types.length; t++) {
                if (types[t] === "view") {
                    matching = Math.max(matching, 1);
                    break;
                }
            }
        }

        if (min > 0 && matching < min) {
            var typeLabel = types.length > 0 ? types.join(" or ") : "item";
            return {
                allowed: false,
                reason: "Requires at least " + min + " " + typeLabel +
                    (min !== 1 ? "s" : "") + " in selection (found " + matching + ")."
            };
        }

        return { allowed: true, reason: "" };
    }

    /**
     * Format selection rules as a human-readable string for display.
     * @param {Object} rules - The selection rules from a descriptor
     * @returns {string} Human-readable requirements summary
     */
    function formatRules(rules) {
        if (!rules) return "No selection requirements.";

        var parts = [];

        if (rules.require_view) {
            parts.push("Requires a view");
        }

        var types = rules.types || [];
        var min = (typeof rules.min === "number") ? rules.min : 0;

        if (min > 0 && types.length > 0) {
            parts.push(min + "+ " + types.join(" or "));
        } else if (types.length > 0) {
            parts.push("Works on: " + types.join(", "));
        }

        return parts.length > 0 ? parts.join(" | ") : "No selection requirements.";
    }

    var selectionGating = {
        captureSelection: captureSelection,
        checkRules: checkRules,
        formatRules: formatRules
    };

    if (typeof globalThis !== "undefined") globalThis.selectionGating = selectionGating;
    if (typeof module !== "undefined" && module.exports) module.exports = selectionGating;
})();
