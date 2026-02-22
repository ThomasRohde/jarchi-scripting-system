/**
 * @module planValidator
 * @description Validates ArchiChangePlan objects against schema and live model semantics.
 *
 * Performs two levels of validation:
 * 1. Schema validation — structural checks (required fields, types, enums, lengths)
 * 2. Semantic validation — checks against the live ArchiMate model (element existence,
 *    relationship validity via relationshipMatrix, ref_id forward references)
 *
 * Usage:
 *   load(__DIR__ + "lib/planOps.js");
 *   load(__DIR__ + "lib/relationshipMatrix.js");
 *   load(__DIR__ + "lib/planValidator.js");
 *
 *   var result = planValidator.validate(plan, { scope: scopeMap });
 *   if (!result.schemaValid) log.error("Schema errors: " + result.errors.join(", "));
 *
 * @version 2.0.0
 * @author Thomas Rohde
 * @lastModifiedDate 2026-02-22
 */
(function () {
    "use strict";
    if (typeof globalThis !== "undefined" && typeof globalThis.planValidator !== "undefined") return;

    // ── Constants (from planOps) ─────────────────────────────────────────

    var VALID_STATUSES = ["ready", "needs_clarification", "refusal"];
    var VALID_OPS = planOps.getValidOps();
    var MAX_ACTIONS = planOps.MAX_ACTIONS;
    var MAX_SUMMARY_LENGTH = planOps.MAX_SUMMARY_LENGTH;
    var MAX_NAME_LENGTH = planOps.MAX_NAME_LENGTH;
    var MAX_KEY_LENGTH = planOps.MAX_KEY_LENGTH;
    var MAX_VALUE_LENGTH = planOps.MAX_VALUE_LENGTH;
    var MAX_REF_ID_LENGTH = planOps.MAX_REF_ID_LENGTH;
    var MAX_DOC_LENGTH = planOps.MAX_DOC_LENGTH;
    var MAX_FOLDER_PATH_LENGTH = planOps.MAX_FOLDER_PATH_LENGTH;

    var RELATIONSHIP_LABELS = planOps.RELATIONSHIP_LABELS;

    // ── Relationship label-to-type mapping ────────────────────────────────

    var REL_TYPES = [
        "composition-relationship", "aggregation-relationship",
        "assignment-relationship", "realization-relationship",
        "serving-relationship", "access-relationship",
        "influence-relationship", "triggering-relationship",
        "flow-relationship", "specialization-relationship",
        "association-relationship"
    ];

    var LABEL_TO_TYPE = {};
    var TYPE_TO_LABEL = {};
    for (var i = 0; i < REL_TYPES.length; i++) {
        var label = relationshipMatrix.getRelationshipLabel(REL_TYPES[i]);
        LABEL_TO_TYPE[label] = REL_TYPES[i];
        TYPE_TO_LABEL[REL_TYPES[i]] = label;
    }

    // ── Element type label-to-type mapping ────────────────────────────────

    var ALL_ELEMENT_TYPES = relationshipMatrix.getElementTypes();
    var ELEMENT_LABEL_TO_TYPE = {};
    var ELEMENT_TYPE_TO_LABEL = {};
    var ELEMENT_LABELS = [];

    function _elementTypeToLabel(type) {
        if (!type) return "";
        return type.split("-").map(function (w) {
            return w.charAt(0).toUpperCase() + w.slice(1);
        }).join(" ");
    }

    /**
     * Normalize a type label: insert spaces before uppercase letters in PascalCase.
     * "BusinessActor" → "Business Actor", "ApplicationComponent" → "Application Component"
     */
    function _normalizeTypeLabel(label) {
        if (!label) return label;
        return label.replace(/([a-z])([A-Z])/g, "$1 $2");
    }

    for (var ei = 0; ei < ALL_ELEMENT_TYPES.length; ei++) {
        var elType = ALL_ELEMENT_TYPES[ei];
        var elLabel = _elementTypeToLabel(elType);
        ELEMENT_LABEL_TO_TYPE[elLabel] = elType;
        ELEMENT_TYPE_TO_LABEL[elType] = elLabel;
        ELEMENT_LABELS.push(elLabel);
    }

    /**
     * Resolve an element type label, accepting both "Business Actor" and "BusinessActor".
     */
    function _resolveElementType(label) {
        if (!label) return null;
        if (ELEMENT_LABEL_TO_TYPE[label]) return ELEMENT_LABEL_TO_TYPE[label];
        // Try normalizing PascalCase → "Title Case"
        var normalized = _normalizeTypeLabel(label);
        return ELEMENT_LABEL_TO_TYPE[normalized] || null;
    }

    // ── Top-level fields ─────────────────────────────────────────────────

    var TOP_LEVEL_REQUIRED = ["schema_version", "status", "summary", "actions"];
    var TOP_LEVEL_ALLOWED = ["schema_version", "status", "summary", "actions", "questions"];

    // ── Schema validation ────────────────────────────────────────────────

    function _validateSchema(plan) {
        var errors = [];

        if (plan === null || typeof plan !== "object" || Array.isArray(plan)) {
            errors.push("Plan must be a JSON object");
            return errors;
        }

        for (var r = 0; r < TOP_LEVEL_REQUIRED.length; r++) {
            if (!(TOP_LEVEL_REQUIRED[r] in plan)) {
                errors.push('Missing required field "' + TOP_LEVEL_REQUIRED[r] + '"');
            }
        }

        var keys = Object.keys(plan);
        for (var k = 0; k < keys.length; k++) {
            if (plan[keys[k]] === null) continue;
            if (TOP_LEVEL_ALLOWED.indexOf(keys[k]) === -1) {
                errors.push('Unknown top-level field "' + keys[k] + '"');
            }
        }

        if (typeof plan.schema_version !== "string" ||
            planOps.ACCEPTED_VERSIONS.indexOf(plan.schema_version) === -1) {
            errors.push('schema_version must be one of: ' + planOps.ACCEPTED_VERSIONS.join(", ") +
                '; got: ' + JSON.stringify(plan.schema_version));
        }

        if (typeof plan.status !== "string" || VALID_STATUSES.indexOf(plan.status) === -1) {
            errors.push('status must be one of: ' + VALID_STATUSES.join(", ") + '; got: ' + JSON.stringify(plan.status));
        }

        if (typeof plan.summary !== "string" || plan.summary.length === 0) {
            errors.push("summary must be a non-empty string");
        } else if (plan.summary.length > MAX_SUMMARY_LENGTH) {
            errors.push("summary exceeds " + MAX_SUMMARY_LENGTH + " characters");
        }

        if ("questions" in plan && plan.questions !== null) {
            if (!Array.isArray(plan.questions)) {
                errors.push("questions must be an array");
            } else {
                for (var q = 0; q < plan.questions.length; q++) {
                    if (typeof plan.questions[q] !== "string" || plan.questions[q].length === 0) {
                        errors.push("questions[" + q + "] must be a non-empty string");
                    }
                }
            }
        }

        if (!Array.isArray(plan.actions)) {
            errors.push("actions must be an array");
            return errors;
        }

        if (plan.actions.length > MAX_ACTIONS) {
            errors.push("actions exceeds maximum of " + MAX_ACTIONS + " items");
        }

        for (var a = 0; a < plan.actions.length; a++) {
            var actionErrors = _validateAction(plan.actions[a], a);
            for (var ae = 0; ae < actionErrors.length; ae++) {
                errors.push(actionErrors[ae]);
            }
        }

        return errors;
    }

    function _validateAction(action, index) {
        var prefix = "actions[" + index + "]: ";
        var errors = [];

        if (action === null || typeof action !== "object" || Array.isArray(action)) {
            errors.push(prefix + "must be an object");
            return errors;
        }

        if (typeof action.op !== "string") {
            errors.push(prefix + "missing or invalid 'op' field");
            return errors;
        }

        if (VALID_OPS.indexOf(action.op) === -1) {
            errors.push(prefix + 'unknown op "' + action.op + '"');
            return errors;
        }

        switch (action.op) {
            case "create_element":
                errors = errors.concat(_validateCreateElement(action, prefix));
                break;
            case "rename_element":
                errors = errors.concat(_validateRenameElement(action, prefix));
                break;
            case "set_property":
                errors = errors.concat(_validateSetProperty(action, prefix));
                break;
            case "create_relationship":
                errors = errors.concat(_validateCreateRelationship(action, prefix));
                break;
            case "set_documentation":
                errors = errors.concat(_validateSetDocumentation(action, prefix));
                break;
            case "delete_element":
                errors = errors.concat(_validateDeleteElement(action, prefix));
                break;
            case "delete_relationship":
                errors = errors.concat(_validateDeleteRelationship(action, prefix));
                break;
            case "remove_property":
                errors = errors.concat(_validateRemoveProperty(action, prefix));
                break;
            case "create_view":
                errors = errors.concat(_validateCreateView(action, prefix));
                break;
            case "add_to_view":
                errors = errors.concat(_validateAddToView(action, prefix));
                break;
            case "move_to_folder":
                errors = errors.concat(_validateMoveToFolder(action, prefix));
                break;
        }

        return errors;
    }

    // ── Original 4 op validators ─────────────────────────────────────────

    function _validateCreateElement(action, prefix) {
        var errors = [];
        var allowed = ["op", "type", "name", "ref_id"];

        _checkExtraProps(action, allowed, prefix, errors);
        _checkRequiredString(action, "name", prefix, errors, 1, MAX_NAME_LENGTH);

        if (typeof action.type !== "string" || !_resolveElementType(action.type)) {
            errors.push(prefix + '"type" must be a valid ArchiMate element type; got: ' + JSON.stringify(action.type));
        }

        if ("ref_id" in action && action.ref_id !== null) {
            if (typeof action.ref_id !== "string") {
                errors.push(prefix + '"ref_id" must be a string');
            } else if (action.ref_id.length === 0) {
                errors.push(prefix + '"ref_id" must be non-empty');
            } else if (action.ref_id.length > MAX_REF_ID_LENGTH) {
                errors.push(prefix + '"ref_id" exceeds ' + MAX_REF_ID_LENGTH + " characters");
            }
        }

        return errors;
    }

    function _validateRenameElement(action, prefix) {
        var errors = [];
        var allowed = ["op", "element_id", "new_name"];

        _checkExtraProps(action, allowed, prefix, errors);
        _checkRequiredString(action, "element_id", prefix, errors, 1);
        _checkRequiredString(action, "new_name", prefix, errors, 1, MAX_NAME_LENGTH);

        return errors;
    }

    function _validateSetProperty(action, prefix) {
        var errors = [];
        var allowed = ["op", "element_id", "key", "value"];

        _checkExtraProps(action, allowed, prefix, errors);
        _checkRequiredString(action, "element_id", prefix, errors, 1);
        _checkRequiredString(action, "key", prefix, errors, 1, MAX_KEY_LENGTH);

        if (!("value" in action) || typeof action.value !== "string") {
            errors.push(prefix + '"value" must be a string');
        } else if (action.value.length > MAX_VALUE_LENGTH) {
            errors.push(prefix + '"value" exceeds ' + MAX_VALUE_LENGTH + " characters");
        }

        return errors;
    }

    function _validateCreateRelationship(action, prefix) {
        var errors = [];
        var allowed = ["op", "source_id", "target_id", "relationship_type", "name"];

        _checkExtraProps(action, allowed, prefix, errors);
        _checkRequiredString(action, "source_id", prefix, errors, 1);
        _checkRequiredString(action, "target_id", prefix, errors, 1);

        if (typeof action.relationship_type !== "string" ||
            RELATIONSHIP_LABELS.indexOf(action.relationship_type) === -1) {
            errors.push(prefix + '"relationship_type" must be one of: ' +
                RELATIONSHIP_LABELS.join(", ") + '; got: ' + JSON.stringify(action.relationship_type));
        }

        if ("name" in action && action.name !== null) {
            if (typeof action.name !== "string") {
                errors.push(prefix + '"name" must be a string');
            } else if (action.name.length > MAX_NAME_LENGTH) {
                errors.push(prefix + '"name" exceeds ' + MAX_NAME_LENGTH + " characters");
            }
        }

        return errors;
    }

    // ── New v2 op validators ─────────────────────────────────────────────

    function _validateSetDocumentation(action, prefix) {
        var errors = [];
        var allowed = ["op", "element_id", "documentation"];

        _checkExtraProps(action, allowed, prefix, errors);
        _checkRequiredString(action, "element_id", prefix, errors, 1);

        if (!("documentation" in action) || typeof action.documentation !== "string") {
            errors.push(prefix + '"documentation" must be a string');
        } else if (action.documentation.length > MAX_DOC_LENGTH) {
            errors.push(prefix + '"documentation" exceeds ' + MAX_DOC_LENGTH + " characters");
        }

        return errors;
    }

    function _validateDeleteElement(action, prefix) {
        var errors = [];
        var allowed = ["op", "element_id"];

        _checkExtraProps(action, allowed, prefix, errors);
        _checkRequiredString(action, "element_id", prefix, errors, 1);

        return errors;
    }

    function _validateDeleteRelationship(action, prefix) {
        var errors = [];
        var allowed = ["op", "relationship_id"];

        _checkExtraProps(action, allowed, prefix, errors);
        _checkRequiredString(action, "relationship_id", prefix, errors, 1);

        return errors;
    }

    function _validateRemoveProperty(action, prefix) {
        var errors = [];
        var allowed = ["op", "element_id", "key"];

        _checkExtraProps(action, allowed, prefix, errors);
        _checkRequiredString(action, "element_id", prefix, errors, 1);
        _checkRequiredString(action, "key", prefix, errors, 1, MAX_KEY_LENGTH);

        return errors;
    }

    function _validateCreateView(action, prefix) {
        var errors = [];
        var allowed = ["op", "name", "ref_id"];

        _checkExtraProps(action, allowed, prefix, errors);
        _checkRequiredString(action, "name", prefix, errors, 1, MAX_NAME_LENGTH);

        if ("ref_id" in action && action.ref_id !== null) {
            if (typeof action.ref_id !== "string") {
                errors.push(prefix + '"ref_id" must be a string');
            } else if (action.ref_id.length === 0) {
                errors.push(prefix + '"ref_id" must be non-empty');
            } else if (action.ref_id.length > MAX_REF_ID_LENGTH) {
                errors.push(prefix + '"ref_id" exceeds ' + MAX_REF_ID_LENGTH + " characters");
            }
        }

        return errors;
    }

    function _validateAddToView(action, prefix) {
        var errors = [];
        var allowed = ["op", "view_id", "element_id", "x", "y", "width", "height"];

        _checkExtraProps(action, allowed, prefix, errors);
        _checkRequiredString(action, "view_id", prefix, errors, 1);
        _checkRequiredString(action, "element_id", prefix, errors, 1);

        // Optional numeric fields
        if ("x" in action && action.x !== null && typeof action.x !== "number") {
            errors.push(prefix + '"x" must be a number');
        }
        if ("y" in action && action.y !== null && typeof action.y !== "number") {
            errors.push(prefix + '"y" must be a number');
        }
        if ("width" in action && action.width !== null) {
            if (typeof action.width !== "number") {
                errors.push(prefix + '"width" must be a number');
            } else if (action.width < 10) {
                errors.push(prefix + '"width" must be at least 10');
            }
        }
        if ("height" in action && action.height !== null) {
            if (typeof action.height !== "number") {
                errors.push(prefix + '"height" must be a number');
            } else if (action.height < 10) {
                errors.push(prefix + '"height" must be at least 10');
            }
        }

        return errors;
    }

    function _validateMoveToFolder(action, prefix) {
        var errors = [];
        var allowed = ["op", "element_id", "folder_path"];

        _checkExtraProps(action, allowed, prefix, errors);
        _checkRequiredString(action, "element_id", prefix, errors, 1);
        _checkRequiredString(action, "folder_path", prefix, errors, 1, MAX_FOLDER_PATH_LENGTH);

        return errors;
    }

    // ── Helper: check for extra properties ───────────────────────────────

    function _checkExtraProps(obj, allowed, prefix, errors) {
        var keys = Object.keys(obj);
        for (var i = 0; i < keys.length; i++) {
            // Skip null-valued fields (structured output includes all fields as null)
            if (obj[keys[i]] === null) continue;
            if (allowed.indexOf(keys[i]) === -1) {
                errors.push(prefix + 'unknown field "' + keys[i] + '"');
            }
        }
    }

    function _checkRequiredString(obj, field, prefix, errors, minLen, maxLen) {
        if (!(field in obj) || typeof obj[field] !== "string") {
            errors.push(prefix + '"' + field + '" must be a string');
        } else {
            if (minLen && obj[field].length < minLen) {
                errors.push(prefix + '"' + field + '" must be non-empty');
            }
            if (maxLen && obj[field].length > maxLen) {
                errors.push(prefix + '"' + field + '" exceeds ' + maxLen + " characters");
            }
        }
    }

    // ── Semantic validation ──────────────────────────────────────────────

    function _validateSemantics(plan, options) {
        var errors = [];
        var warnings = [];
        var scope = (options && options.scope) || null;

        // Track ref_ids declared by create_element actions
        var declaredRefIds = {};
        // Track ref_ids declared by create_view actions
        var declaredViewRefIds = {};
        // Track duplicates
        var renameTargets = {};
        var propTargets = {};
        // Track deleted element IDs (to catch use-after-delete)
        var deletedIds = {};

        for (var i = 0; i < plan.actions.length; i++) {
            var action = plan.actions[i];
            var prefix = "actions[" + i + "]: ";

            switch (action.op) {
                case "create_element": {
                    // Validate element type
                    var resolvedType = _resolveElementType(action.type);
                    if (action.type && !resolvedType) {
                        errors.push(prefix + 'unknown element type "' + action.type + '"');
                    }
                    // Track ref_id for forward references
                    if (action.ref_id) {
                        if (declaredRefIds[action.ref_id] || declaredViewRefIds[action.ref_id]) {
                            errors.push(prefix + 'duplicate ref_id "' + action.ref_id + '"');
                        }
                        declaredRefIds[action.ref_id] = { index: i, type: resolvedType };
                    }
                    break;
                }

                case "rename_element": {
                    _semanticResolveId(action.element_id, prefix, scope, declaredRefIds, deletedIds, errors);
                    if (renameTargets[action.element_id]) {
                        warnings.push(prefix + 'element "' + action.element_id + '" renamed multiple times');
                    }
                    renameTargets[action.element_id] = true;
                    break;
                }

                case "set_property": {
                    _semanticResolveId(action.element_id, prefix, scope, declaredRefIds, deletedIds, errors);
                    var propKey = action.element_id + "|" + action.key;
                    if (propTargets[propKey]) {
                        warnings.push(prefix + 'property "' + action.key + '" set multiple times on same element');
                    }
                    propTargets[propKey] = true;
                    break;
                }

                case "create_relationship": {
                    var sourceInfo = _semanticResolveId(action.source_id, prefix + "source: ", scope, declaredRefIds, deletedIds, errors);
                    var targetInfo = _semanticResolveId(action.target_id, prefix + "target: ", scope, declaredRefIds, deletedIds, errors);

                    // Validate relationship is allowed between source and target types
                    if (sourceInfo && targetInfo && sourceInfo.type && targetInfo.type) {
                        var relType = LABEL_TO_TYPE[action.relationship_type];
                        if (relType && !relationshipMatrix.isAllowed(sourceInfo.type, targetInfo.type, relType)) {
                            var allowed = relationshipMatrix.getAllowed(sourceInfo.type, targetInfo.type);
                            var allowedLabels = [];
                            for (var al = 0; al < allowed.length; al++) {
                                var lbl = TYPE_TO_LABEL[allowed[al]];
                                if (lbl) allowedLabels.push(lbl);
                            }
                            warnings.push(prefix + action.relationship_type +
                                ' not allowed by ArchiMate spec between ' + sourceInfo.type + ' and ' + targetInfo.type +
                                (allowedLabels.length > 0
                                    ? '. Allowed: ' + allowedLabels.join(", ")
                                    : '. No relationships allowed between these types'));
                        }
                    }
                    break;
                }

                case "set_documentation": {
                    _semanticResolveId(action.element_id, prefix, scope, declaredRefIds, deletedIds, errors);
                    break;
                }

                case "delete_element": {
                    // Verify the target exists and is an element (not a relationship)
                    var delEl = _semanticResolveId(action.element_id, prefix, scope, declaredRefIds, deletedIds, errors);
                    if (delEl) {
                        var modelEl = $("#" + action.element_id).first();
                        if (modelEl && modelEl.type && modelEl.type.indexOf("-relationship") >= 0) {
                            errors.push(prefix + '"' + action.element_id + '" is a relationship, use delete_relationship instead');
                        } else {
                            // Check how many relationships will be cascaded
                            if (modelEl) {
                                var relCount = $(modelEl).rels().size();
                                if (relCount > 0) {
                                    warnings.push(prefix + 'deleting "' + (modelEl.name || action.element_id) +
                                        '" will cascade-delete ' + relCount + ' relationship(s)');
                                }
                            }
                        }
                        deletedIds[action.element_id] = true;
                    }
                    break;
                }

                case "delete_relationship": {
                    // Verify the target exists and is a relationship
                    var delRel = $("#" + action.relationship_id).first();
                    if (!delRel) {
                        errors.push(prefix + 'relationship "' + action.relationship_id + '" not found in model');
                    } else if (!delRel.type || delRel.type.indexOf("-relationship") < 0) {
                        errors.push(prefix + '"' + action.relationship_id + '" is not a relationship, use delete_element instead');
                    }
                    deletedIds[action.relationship_id] = true;
                    break;
                }

                case "remove_property": {
                    _semanticResolveId(action.element_id, prefix, scope, declaredRefIds, deletedIds, errors);
                    break;
                }

                case "create_view": {
                    if (action.ref_id) {
                        if (declaredRefIds[action.ref_id] || declaredViewRefIds[action.ref_id]) {
                            errors.push(prefix + 'duplicate ref_id "' + action.ref_id + '"');
                        }
                        declaredViewRefIds[action.ref_id] = { index: i };
                    }
                    break;
                }

                case "add_to_view": {
                    // Resolve view_id from view ref_ids or model
                    _semanticResolveViewId(action.view_id, prefix, declaredViewRefIds, errors);
                    // Resolve element_id from element ref_ids or model
                    _semanticResolveId(action.element_id, prefix + "element: ", scope, declaredRefIds, deletedIds, errors);
                    break;
                }

                case "move_to_folder": {
                    _semanticResolveId(action.element_id, prefix, scope, declaredRefIds, deletedIds, errors);
                    // Warn if folder path likely doesn't exist (can't fully validate without model traversal)
                    if (action.folder_path && action.folder_path.indexOf("/") === -1) {
                        // Single-segment path is fine — it's a top-level folder
                    }
                    break;
                }
            }
        }

        return { errors: errors, warnings: warnings };
    }

    /**
     * Resolve an element ID — either from model, from a ref_id, or report error.
     * Returns { type: string } or null.
     */
    function _semanticResolveId(elementId, prefix, scope, declaredRefIds, deletedIds, errors) {
        // Check if referencing a deleted element
        if (deletedIds && deletedIds[elementId]) {
            errors.push(prefix + 'element "' + elementId + '" was deleted by a prior action');
            return null;
        }

        // Check if it's a ref_id from a prior create_element
        if (declaredRefIds[elementId]) {
            return { type: declaredRefIds[elementId].type };
        }

        // Check model
        var el = $("#" + elementId).first();
        if (!el) {
            errors.push(prefix + 'element "' + elementId + '" not found in model (and no matching ref_id)');
            return null;
        }
        if (scope && !scope[elementId]) {
            errors.push(prefix + 'element "' + elementId + '" not in scope');
            return null;
        }
        return { type: el.type };
    }

    /**
     * Resolve a view ID — either from view ref_ids or from the model.
     * Returns true if resolved, false otherwise.
     */
    function _semanticResolveViewId(viewId, prefix, declaredViewRefIds, errors) {
        // Check if it's a ref_id from a prior create_view
        if (declaredViewRefIds[viewId]) {
            return true;
        }

        // Check model for existing view
        var view = $("#" + viewId).first();
        if (!view) {
            errors.push(prefix + 'view "' + viewId + '" not found in model (and no matching ref_id)');
            return false;
        }
        // Verify it's actually a view
        if (view.type && view.type.indexOf("diagram") < 0 && view.type !== "archimate-diagram-model") {
            errors.push(prefix + '"' + viewId + '" is not a view');
            return false;
        }
        return true;
    }

    // ── Public API ───────────────────────────────────────────────────────

    var planValidator = {
        /**
         * Validate an ArchiChangePlan object.
         *
         * @param {Object} plan - The parsed plan object
         * @param {Object} [options]
         * @param {Object} [options.scope] - Map of element ID -> true (restrict to these elements)
         * @returns {{ schemaValid: boolean, semanticValid: boolean, errors: string[], warnings: string[] }}
         */
        validate: function (plan, options) {
            var schemaErrors = _validateSchema(plan);
            var result = {
                schemaValid: schemaErrors.length === 0,
                semanticValid: true,
                errors: schemaErrors.slice(),
                warnings: []
            };

            if (result.schemaValid && plan.actions && plan.actions.length > 0) {
                var semantic = _validateSemantics(plan, options);
                result.errors = result.errors.concat(semantic.errors);
                result.warnings = semantic.warnings;
                result.semanticValid = semantic.errors.length === 0;
            }

            return result;
        },

        /**
         * Convert a human-readable relationship label to a jArchi relationship type.
         * @param {string} label - e.g. "Serving"
         * @returns {string|null} e.g. "serving-relationship", or null if unknown
         */
        labelToType: function (label) {
            return LABEL_TO_TYPE[label] || null;
        },

        /**
         * Convert a jArchi relationship type to a human-readable label.
         * @param {string} type - e.g. "serving-relationship"
         * @returns {string|null} e.g. "Serving", or null if unknown
         */
        typeToLabel: function (type) {
            return TYPE_TO_LABEL[type] || null;
        },

        /**
         * Convert a human-readable element type label to a jArchi element type.
         * @param {string} label - e.g. "Application Component"
         * @returns {string|null} e.g. "application-component", or null if unknown
         */
        elementLabelToType: function (label) {
            return _resolveElementType(label);
        },

        /**
         * Convert a jArchi element type to a human-readable label.
         * @param {string} type - e.g. "application-component"
         * @returns {string|null} e.g. "Application Component", or null if unknown
         */
        elementTypeToLabel: function (type) {
            return ELEMENT_TYPE_TO_LABEL[type] || null;
        },

        /**
         * Get all valid element type labels.
         * @returns {string[]}
         */
        getElementLabels: function () {
            return ELEMENT_LABELS.slice();
        }
    };

    if (typeof globalThis !== "undefined") globalThis.planValidator = planValidator;
    if (typeof module !== "undefined" && module.exports) module.exports = planValidator;
})();
