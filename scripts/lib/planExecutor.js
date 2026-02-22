/**
 * @module planExecutor
 * @description Deterministic executor for ArchiChangePlan actions.
 *
 * Applies validated plan actions to the live ArchiMate model in array order.
 * Supports preview mode (human-readable descriptions without model changes)
 * and apply mode (actual model mutations).
 *
 * Tracks ref_id mappings from create_element actions so that subsequent
 * actions (create_relationship, rename_element, set_property) can reference
 * newly created elements by ref_id.
 *
 * Usage:
 *   load(__DIR__ + "lib/relationshipMatrix.js");
 *   load(__DIR__ + "lib/planValidator.js");
 *   load(__DIR__ + "lib/planExecutor.js");
 *
 *   var preview = planExecutor.execute(plan, { preview: true });
 *   var result  = planExecutor.execute(plan, { preview: false });
 *
 * @version 1.1.0
 * @author Thomas Rohde
 * @lastModifiedDate 2026-02-22
 */
(function () {
    "use strict";
    if (typeof globalThis !== "undefined" && typeof globalThis.planExecutor !== "undefined") return;

    // ── Element resolution ───────────────────────────────────────────────

    /**
     * Resolve an element by ID, checking the ref_id map first for newly created elements.
     */
    function _resolveElement(id, refIdMap) {
        // Check ref_id map first (for elements created in this plan)
        if (refIdMap && refIdMap[id]) {
            return refIdMap[id];
        }
        return $("#" + id).first();
    }

    // ── Action descriptions (preview mode) ───────────────────────────────

    function _describeAction(action, refIdMap) {
        switch (action.op) {
            case "create_element": {
                var refNote = action.ref_id ? ' (ref: ' + action.ref_id + ')' : '';
                return 'Create ' + action.type + ' "' + action.name + '"' + refNote;
            }
            case "rename_element": {
                var el = _resolveElement(action.element_id, refIdMap);
                var oldName = el ? el.name : "(ref: " + action.element_id + ")";
                return 'Rename "' + oldName + '" \u2192 "' + action.new_name + '"';
            }
            case "set_property": {
                var el2 = _resolveElement(action.element_id, refIdMap);
                var elName = el2 ? el2.name : "(ref: " + action.element_id + ")";
                return 'Set property "' + action.key + '" = "' + action.value + '" on "' + elName + '"';
            }
            case "create_relationship": {
                var src = _resolveElement(action.source_id, refIdMap);
                var tgt = _resolveElement(action.target_id, refIdMap);
                var srcName = src ? src.name : "(ref: " + action.source_id + ")";
                var tgtName = tgt ? tgt.name : "(ref: " + action.target_id + ")";
                var relName = (action.name && action.name !== null) ? ' "' + action.name + '"' : "";
                return "Create " + action.relationship_type + relName +
                    ': "' + srcName + '" \u2192 "' + tgtName + '"';
            }
            default:
                return "Unknown operation: " + action.op;
        }
    }

    // ── Action application (apply mode) ──────────────────────────────────

    function _applyAction(action, result, refIdMap) {
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
                // Register ref_id mapping
                if (action.ref_id && refIdMap) {
                    refIdMap[action.ref_id] = newEl;
                }
                break;
            }
            case "rename_element": {
                var el = _resolveElement(action.element_id, refIdMap);
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
                var el2 = _resolveElement(action.element_id, refIdMap);
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
                var source = _resolveElement(action.source_id, refIdMap);
                var target = _resolveElement(action.target_id, refIdMap);
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
            default:
                result.ok = false;
                result.error = 'Unknown operation "' + action.op + '"';
        }
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
         * @returns {{ ok: boolean, applied: number, failed: number, skipped: number, results: Array }}
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
                results: []
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
                    result.ok = true;
                    result.preview = _describeAction(action, refIdMap);
                    output.applied++;
                } else {
                    try {
                        _applyAction(action, result, refIdMap);
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

            return output;
        }
    };

    if (typeof globalThis !== "undefined") globalThis.planExecutor = planExecutor;
    if (typeof module !== "undefined" && module.exports) module.exports = planExecutor;
})();
