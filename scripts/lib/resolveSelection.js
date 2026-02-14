/**
 * @module resolveSelection
 * @description Resolves the effective selection for a script by checking
 * the menu context first (which includes inferred views and filtered items),
 * then falling back to the raw Archi selection.
 *
 * Scripts should use this instead of reading $(selection) directly so they
 * benefit from the menu's view inference and concept extraction from
 * diagram objects.
 * @version 1.1.0
 */
(function () {
    "use strict";

    if (typeof globalThis !== "undefined" && typeof globalThis.resolveSelection !== "undefined") return;

    /**
     * Get the active view for the current script invocation.
     *
     * Resolution order:
     *   1. Menu context activeView (includes inferred views)
     *   2. Explicit view in $(selection)
     *   3. Active editor view via PlatformUI
     *
     * @returns {Object|null} A jArchi view proxy, or null if no view is available
     */
    function activeView() {
        // 1. Menu context — already has full inference from selectionGating
        var ctx = globalThis.__JARCHI_MENU_CTX__;
        if (ctx && ctx.activeView && ctx.activeView.id) {
            var found = $("#" + ctx.activeView.id);
            if (found.size() > 0) return found.first();
        }

        // 2. Explicit view in selection
        var fromSelection = $(selection).filter("archimate-diagram-model");
        if (fromSelection.size() > 0) return fromSelection.first();

        // 3. Active editor fallback
        try {
            var PlatformUI = Java.type("org.eclipse.ui.PlatformUI");
            var page = PlatformUI.getWorkbench().getActiveWorkbenchWindow().getActivePage();
            var editor = page.getActiveEditor();
            if (editor) {
                var model = editor.getModel();
                if (model) {
                    var wrapped = $(model);
                    if (wrapped.is("archimate-diagram-model")) return wrapped.first();
                }
            }
        } catch (e) {
            // No workbench or no diagram editor
        }

        return null;
    }

    /**
     * Get model concepts from the current selection.
     *
     * Handles both model-tree selections (where items are already concepts)
     * and view-canvas selections (where items are diagram objects whose
     * .concept property holds the underlying model element/relationship).
     *
     * @param {string} [selector] - jArchi selector to filter by (e.g. "element", "relationship")
     * @returns {Object} jArchi collection of model concepts
     */
    function selectedConcepts(selector) {
        // Try direct model objects first (model tree selection)
        var result = selector ? $(selection).filter(selector) : $(selection).filter("element").add($(selection).filter("relationship"));
        if (result.size() > 0) return result;

        // Extract concepts from diagram objects/connections (view canvas selection)
        var seen = {};
        $(selection).each(function (item) {
            if (item.concept) {
                if (!selector || $(item.concept).is(selector)) {
                    if (!seen[item.concept.id]) {
                        seen[item.concept.id] = true;
                        result = result.add($(item.concept));
                    }
                }
            }
        });
        return result;
    }

    /**
     * Get selected items that match the given jArchi selector, or fall back to
     * finding them within the active view.
     *
     * Useful for scripts that work on "selected objects or all objects in view."
     *
     * @param {string} selector - jArchi selector (e.g. "diagram-model-object", "element")
     * @returns {{items: Object, source: string}} items = jArchi collection, source = description
     */
    function itemsOrView(selector) {
        var items = $(selection).filter(selector);
        if (items.size() > 0) {
            return { items: items, source: items.size() + " selected" };
        }

        var view = activeView();
        if (view) {
            items = $(view).find(selector);
            return { items: items, source: "view '" + (view.name || "unnamed") + "'" };
        }

        return { items: $(), source: "nothing" };
    }

    var resolveSelection = {
        activeView: activeView,
        selectedConcepts: selectedConcepts,
        itemsOrView: itemsOrView
    };

    if (typeof globalThis !== "undefined") globalThis.resolveSelection = resolveSelection;
    if (typeof module !== "undefined" && module.exports) module.exports = resolveSelection;
})();
