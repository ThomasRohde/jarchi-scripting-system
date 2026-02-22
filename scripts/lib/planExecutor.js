/**
 * @module planExecutor
 * @description Deterministic executor for ArchiChangePlan actions.
 *
 * Applies validated plan actions to the live ArchiMate model in array order.
 * Supports preview mode (human-readable descriptions without model changes)
 * and apply mode (actual model mutations).
 *
 * Tracks ref_id mappings from create_element and create_view actions so that
 * subsequent actions can reference newly created elements/views by ref_id.
 *
 * Post-processing: after all add_to_view actions, auto-connects relationships
 * between elements placed on each view.
 *
 * Usage:
 *   load(__DIR__ + "lib/planOps.js");
 *   load(__DIR__ + "lib/relationshipMatrix.js");
 *   load(__DIR__ + "lib/planValidator.js");
 *   load(__DIR__ + "lib/planExecutor.js");
 *
 *   var preview = planExecutor.execute(plan, { preview: true });
 *   var result  = planExecutor.execute(plan, { preview: false });
 *
 * @version 2.0.0
 * @author Thomas Rohde
 * @lastModifiedDate 2026-02-22
 */
(function () {
    "use strict";
    if (typeof globalThis !== "undefined" && typeof globalThis.planExecutor !== "undefined") return;

    // ── Auto-grid constants ──────────────────────────────────────────────

    var GRID_H_SPACING = 160;   // Horizontal spacing between elements
    var GRID_V_SPACING = 80;    // Vertical spacing between rows
    var GRID_COLUMNS = 4;       // Elements per row
    var GRID_START_X = 30;      // Starting X offset
    var GRID_START_Y = 30;      // Starting Y offset
    var DEFAULT_WIDTH = 120;    // Default element width on view
    var DEFAULT_HEIGHT = 55;    // Default element height on view

    // ── Element resolution ───────────────────────────────────────────────

    /**
     * Resolve an element by ID, checking the ref_id map first for newly created elements,
     * then the view ref_id map (views can be targets for rename, set_property, etc.).
     */
    function _resolveElement(id, refIdMap, viewRefIdMap) {
        if (refIdMap && refIdMap[id]) {
            return refIdMap[id];
        }
        if (viewRefIdMap && viewRefIdMap[id]) {
            return viewRefIdMap[id];
        }
        return $("#" + id).first();
    }

    /**
     * Resolve a view by ID, checking the view ref_id map first.
     */
    function _resolveView(id, viewRefIdMap) {
        if (viewRefIdMap && viewRefIdMap[id]) {
            return viewRefIdMap[id];
        }
        return $("#" + id).first();
    }

    /**
     * Resolve a folder by /-separated path, walking through the folder hierarchy.
     * Returns the folder object or null if not found.
     */
    function _resolveFolder(folderPath) {
        if (!folderPath) return null;

        var parts = folderPath.split("/");
        var folders = $("folder");
        var current = null;

        // Find root folder matching first segment
        folders.each(function (f) {
            if (f.name === parts[0]) {
                // Check if this is a top-level folder (parent is the model root)
                var parent = $(f).parent();
                if (!parent || parent.size() === 0 || !parent.first() || !parent.first().type || parent.first().type.indexOf("folder") < 0) {
                    current = f;
                }
            }
        });

        if (!current) return null;

        // Walk remaining path segments
        for (var i = 1; i < parts.length; i++) {
            var found = null;
            $(current).children("folder").each(function (child) {
                if (child.name === parts[i]) {
                    found = child;
                }
            });
            if (!found) return null;
            current = found;
        }

        return current;
    }

    // ── Action descriptions (preview mode) ───────────────────────────────

    function _describeAction(action, refIdMap, viewRefIdMap) {
        switch (action.op) {
            case "create_element": {
                var refNote = action.ref_id ? ' (ref: ' + action.ref_id + ')' : '';
                return 'Create ' + action.type + ' "' + action.name + '"' + refNote;
            }
            case "rename_element": {
                var el = _resolveElement(action.element_id, refIdMap, viewRefIdMap);
                var oldName = el ? el.name : "(ref: " + action.element_id + ")";
                return 'Rename "' + oldName + '" \u2192 "' + action.new_name + '"';
            }
            case "set_property": {
                var el2 = _resolveElement(action.element_id, refIdMap, viewRefIdMap);
                var elName = el2 ? el2.name : "(ref: " + action.element_id + ")";
                return 'Set property "' + action.key + '" = "' + action.value + '" on "' + elName + '"';
            }
            case "create_relationship": {
                var src = _resolveElement(action.source_id, refIdMap, viewRefIdMap);
                var tgt = _resolveElement(action.target_id, refIdMap, viewRefIdMap);
                var srcName = src ? src.name : "(ref: " + action.source_id + ")";
                var tgtName = tgt ? tgt.name : "(ref: " + action.target_id + ")";
                var relName = (action.name && action.name !== null) ? ' "' + action.name + '"' : "";
                return "Create " + action.relationship_type + relName +
                    ': "' + srcName + '" \u2192 "' + tgtName + '"';
            }
            case "set_documentation": {
                var el3 = _resolveElement(action.element_id, refIdMap, viewRefIdMap);
                var elName3 = el3 ? el3.name : "(ref: " + action.element_id + ")";
                var docPreview = action.documentation.length > 60
                    ? action.documentation.substring(0, 57) + "..."
                    : action.documentation;
                return 'Set documentation on "' + elName3 + '": "' + docPreview + '"';
            }
            case "delete_element": {
                var el4 = _resolveElement(action.element_id, refIdMap, viewRefIdMap);
                var elName4 = el4 ? el4.name : action.element_id;
                return 'Delete element "' + elName4 + '" (cascades relationships)';
            }
            case "delete_relationship": {
                var rel = $("#" + action.relationship_id).first();
                if (rel) {
                    var rSrc = rel.source ? rel.source.name : "?";
                    var rTgt = rel.target ? rel.target.name : "?";
                    return 'Delete relationship: "' + rSrc + '" \u2192 "' + rTgt + '"';
                }
                return 'Delete relationship ' + action.relationship_id;
            }
            case "remove_property": {
                var el5 = _resolveElement(action.element_id, refIdMap, viewRefIdMap);
                var elName5 = el5 ? el5.name : "(ref: " + action.element_id + ")";
                return 'Remove property "' + action.key + '" from "' + elName5 + '"';
            }
            case "create_view": {
                var viewRef = action.ref_id ? ' (ref: ' + action.ref_id + ')' : '';
                return 'Create view "' + action.name + '"' + viewRef;
            }
            case "add_to_view": {
                var view = _resolveView(action.view_id, viewRefIdMap);
                var viewName = view ? view.name : "(ref: " + action.view_id + ")";
                var addEl = _resolveElement(action.element_id, refIdMap, viewRefIdMap);
                var addElName = addEl ? addEl.name : "(ref: " + action.element_id + ")";
                var coords = "";
                if (action.x !== null && action.x !== undefined && action.y !== null && action.y !== undefined) {
                    coords = " at (" + action.x + ", " + action.y + ")";
                } else {
                    coords = " (auto-grid)";
                }
                return 'Add "' + addElName + '" to view "' + viewName + '"' + coords;
            }
            case "move_to_folder": {
                var el6 = _resolveElement(action.element_id, refIdMap, viewRefIdMap);
                var elName6 = el6 ? el6.name : "(ref: " + action.element_id + ")";
                return 'Move "' + elName6 + '" to folder "' + action.folder_path + '"';
            }
            default:
                return "Unknown operation: " + action.op;
        }
    }

    // ── Action application (apply mode) ──────────────────────────────────

    function _applyAction(action, result, refIdMap, viewRefIdMap, gridState, viewsTouched) {
        switch (action.op) {
            case "create_element": {
                var elType = planValidator.elementLabelToType(action.type);
                if (!elType) {
                    result.ok = false;
                    result.error = 'Unknown element type "' + action.type + '"';
                    return;
                }
                var newEl = model.createElement(elType, action.name);
                result.ok = true;
                result.elementId = newEl.id;
                result.elementType = elType;
                result.elementName = action.name;
                if (action.ref_id && refIdMap) {
                    refIdMap[action.ref_id] = newEl;
                }
                break;
            }
            case "rename_element": {
                var el = _resolveElement(action.element_id, refIdMap, viewRefIdMap);
                if (!el) {
                    result.ok = false;
                    result.error = 'Element "' + action.element_id + '" not found';
                    return;
                }
                var oldName = el.name;
                el.name = action.new_name;
                result.ok = true;
                result.oldName = oldName;
                result.newName = action.new_name;
                break;
            }
            case "set_property": {
                var el2 = _resolveElement(action.element_id, refIdMap, viewRefIdMap);
                if (!el2) {
                    result.ok = false;
                    result.error = 'Element "' + action.element_id + '" not found';
                    return;
                }
                var oldValue = el2.prop(action.key);
                el2.prop(action.key, action.value);
                result.ok = true;
                result.oldValue = oldValue || null;
                result.newValue = action.value;
                break;
            }
            case "create_relationship": {
                var source = _resolveElement(action.source_id, refIdMap, viewRefIdMap);
                var target = _resolveElement(action.target_id, refIdMap, viewRefIdMap);
                if (!source) {
                    result.ok = false;
                    result.error = 'Source element "' + action.source_id + '" not found';
                    return;
                }
                if (!target) {
                    result.ok = false;
                    result.error = 'Target element "' + action.target_id + '" not found';
                    return;
                }
                var relType = planValidator.labelToType(action.relationship_type);
                if (!relType) {
                    result.ok = false;
                    result.error = 'Unknown relationship type "' + action.relationship_type + '"';
                    return;
                }
                var relName = (action.name && action.name !== null) ? action.name : "";
                var rel = model.createRelationship(relType, relName, source, target);
                result.ok = true;
                result.relationshipId = rel.id;
                break;
            }
            case "set_documentation": {
                var el3 = _resolveElement(action.element_id, refIdMap, viewRefIdMap);
                if (!el3) {
                    result.ok = false;
                    result.error = 'Element "' + action.element_id + '" not found';
                    return;
                }
                el3.documentation = action.documentation;
                result.ok = true;
                break;
            }
            case "delete_element": {
                var el4 = _resolveElement(action.element_id, refIdMap, viewRefIdMap);
                if (!el4) {
                    result.ok = false;
                    result.error = 'Element "' + action.element_id + '" not found';
                    return;
                }
                // Cascade: delete all relationships first
                var relCount = 0;
                $(el4).rels().each(function (r) {
                    r.delete();
                    relCount++;
                });
                el4.delete();
                result.ok = true;
                result.cascadedRelationships = relCount;
                break;
            }
            case "delete_relationship": {
                var delRel = $("#" + action.relationship_id).first();
                if (!delRel) {
                    result.ok = false;
                    result.error = 'Relationship "' + action.relationship_id + '" not found';
                    return;
                }
                delRel.delete();
                result.ok = true;
                break;
            }
            case "remove_property": {
                var el5 = _resolveElement(action.element_id, refIdMap, viewRefIdMap);
                if (!el5) {
                    result.ok = false;
                    result.error = 'Element "' + action.element_id + '" not found';
                    return;
                }
                el5.prop(action.key, null);
                result.ok = true;
                break;
            }
            case "create_view": {
                var newView = model.createArchimateView(action.name);
                result.ok = true;
                result.viewId = newView.id;
                result.viewName = action.name;
                if (action.ref_id && viewRefIdMap) {
                    viewRefIdMap[action.ref_id] = newView;
                }
                break;
            }
            case "add_to_view": {
                var view = _resolveView(action.view_id, viewRefIdMap);
                if (!view) {
                    result.ok = false;
                    result.error = 'View "' + action.view_id + '" not found';
                    return;
                }
                var addEl = _resolveElement(action.element_id, refIdMap, viewRefIdMap);
                if (!addEl) {
                    result.ok = false;
                    result.error = 'Element "' + action.element_id + '" not found';
                    return;
                }

                var x, y, w, h;
                w = (action.width !== null && action.width !== undefined) ? action.width : DEFAULT_WIDTH;
                h = (action.height !== null && action.height !== undefined) ? action.height : DEFAULT_HEIGHT;

                if (action.x !== null && action.x !== undefined &&
                    action.y !== null && action.y !== undefined) {
                    x = action.x;
                    y = action.y;
                } else {
                    // Auto-grid: compute position based on grid state for this view
                    var viewId = view.id;
                    if (!gridState[viewId]) {
                        gridState[viewId] = { count: 0 };
                    }
                    var idx = gridState[viewId].count;
                    var col = idx % GRID_COLUMNS;
                    var row = Math.floor(idx / GRID_COLUMNS);
                    x = GRID_START_X + col * GRID_H_SPACING;
                    y = GRID_START_Y + row * GRID_V_SPACING;
                    gridState[viewId].count++;
                }

                view.add(addEl, x, y, w, h);
                result.ok = true;
                result.viewId = view.id;

                // Track this view for auto-connect post-processing
                if (viewsTouched) {
                    viewsTouched[view.id] = view;
                }
                break;
            }
            case "move_to_folder": {
                var el6 = _resolveElement(action.element_id, refIdMap, viewRefIdMap);
                if (!el6) {
                    result.ok = false;
                    result.error = 'Element "' + action.element_id + '" not found';
                    return;
                }
                var folder = _resolveFolder(action.folder_path);
                if (!folder) {
                    result.ok = false;
                    result.error = 'Folder "' + action.folder_path + '" not found';
                    return;
                }
                folder.add(el6);
                result.ok = true;
                break;
            }
            default:
                result.ok = false;
                result.error = 'Unknown operation "' + action.op + '"';
        }
    }

    // ── Auto-connect post-processing ─────────────────────────────────────

    /**
     * For each view touched by add_to_view actions, find relationships between
     * elements on the view and add visual connections for them.
     */
    function _autoConnectViews(viewsTouched) {
        var viewIds = Object.keys(viewsTouched);
        var totalConnections = 0;

        for (var v = 0; v < viewIds.length; v++) {
            var view = viewsTouched[viewIds[v]];

            // Build a map of concept ID → diagram object for elements on this view
            var conceptToObj = {};
            $(view).children().each(function (child) {
                if (child.concept) {
                    conceptToObj[child.concept.id] = child;
                }
            });

            // Find existing connections on the view to avoid duplicates
            var existingConnections = {};
            $(view).find("relationship").each(function (conn) {
                if (conn.concept) {
                    existingConnections[conn.concept.id] = true;
                }
            });

            // For each pair of elements on the view, check for relationships
            var conceptIds = Object.keys(conceptToObj);
            for (var i = 0; i < conceptIds.length; i++) {
                var concept = conceptToObj[conceptIds[i]].concept;
                $(concept).rels().each(function (rel) {
                    // Skip if connection already exists on view
                    if (existingConnections[rel.id]) return;

                    var sourceId = rel.source ? rel.source.id : null;
                    var targetId = rel.target ? rel.target.id : null;

                    // Both source and target must be on the view
                    if (sourceId && targetId && conceptToObj[sourceId] && conceptToObj[targetId]) {
                        var sourceObj = conceptToObj[sourceId];
                        var targetObj = conceptToObj[targetId];
                        view.add(rel, sourceObj, targetObj);
                        existingConnections[rel.id] = true;
                        totalConnections++;
                    }
                });
            }
        }

        return totalConnections;
    }

    // ── Public API ───────────────────────────────────────────────────────

    var planExecutor = {
        /**
         * Execute (or preview) an ArchiChangePlan.
         *
         * @param {Object} plan - Validated ArchiChangePlan object
         * @param {Object} [options]
         * @param {boolean} [options.preview=true] - If true, describe actions without applying
         * @param {boolean} [options.stopOnError=true] - If true, stop on first error
         * @returns {{ ok: boolean, applied: number, failed: number, skipped: number, results: Array, autoConnected: number }}
         */
        execute: function (plan, options) {
            options = options || {};
            var preview = options.preview !== false;
            var stopOnError = options.stopOnError !== false;

            var output = {
                ok: true,
                applied: 0,
                failed: 0,
                skipped: 0,
                results: [],
                autoConnected: 0
            };

            // Non-ready plans: return immediately
            if (plan.status !== "ready") {
                output.ok = false;
                output.message = plan.status === "needs_clarification"
                    ? "Plan needs clarification. Questions: " + (plan.questions || []).join("; ")
                    : "Plan was refused: " + plan.summary;
                return output;
            }

            if (!plan.actions || plan.actions.length === 0) {
                output.message = "No actions in plan.";
                return output;
            }

            // ref_id → element proxy mapping (populated during apply by create_element)
            var refIdMap = {};
            // view ref_id → view proxy mapping (populated during apply by create_view)
            var viewRefIdMap = {};
            // Auto-grid state per view
            var gridState = {};
            // Views touched by add_to_view (for auto-connect post-processing)
            var viewsTouched = {};
            var stopped = false;

            for (var i = 0; i < plan.actions.length; i++) {
                var action = plan.actions[i];
                var result = { index: i, op: action.op };

                if (stopped) {
                    result.ok = false;
                    result.skipped = true;
                    output.skipped++;
                    output.results.push(result);
                    continue;
                }

                if (preview) {
                    // Track ref_ids with placeholder objects so later actions
                    // can resolve human-readable names in preview descriptions
                    if (action.op === "create_element" && action.ref_id) {
                        refIdMap[action.ref_id] = { name: action.name, id: action.ref_id, type: action.type };
                    }
                    if (action.op === "create_view" && action.ref_id) {
                        viewRefIdMap[action.ref_id] = { name: action.name, id: action.ref_id };
                    }
                    result.ok = true;
                    result.preview = _describeAction(action, refIdMap, viewRefIdMap);
                    output.applied++;
                } else {
                    try {
                        _applyAction(action, result, refIdMap, viewRefIdMap, gridState, viewsTouched);
                    } catch (e) {
                        result.ok = false;
                        result.error = String(e);
                    }

                    if (result.ok) {
                        output.applied++;
                    } else {
                        output.failed++;
                        output.ok = false;
                        if (stopOnError) {
                            stopped = true;
                        }
                    }
                }

                output.results.push(result);
            }

            // Auto-connect post-processing (apply mode only)
            if (!preview && Object.keys(viewsTouched).length > 0) {
                try {
                    output.autoConnected = _autoConnectViews(viewsTouched);
                } catch (e) {
                    // Non-fatal: log but don't fail the plan
                    output.autoConnectError = String(e);
                }
            }

            return output;
        }
    };

    if (typeof globalThis !== "undefined") globalThis.planExecutor = planExecutor;
    if (typeof module !== "undefined" && module.exports) module.exports = planExecutor;
})();
