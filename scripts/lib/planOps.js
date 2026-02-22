/**
 * @module planOps
 * @description Single source of truth for ArchiChangePlan operation definitions,
 * schema version constants, and structured output schema generation.
 *
 * All plan consumers (planValidator, planExecutor, codexClient) should reference
 * this module instead of hardcoding operation lists and field definitions.
 *
 * Usage:
 *   load(__DIR__ + "lib/planOps.js");
 *
 *   planOps.SCHEMA_VERSION     // "2.0"
 *   planOps.getValidOps()      // ["create_element", "rename_element", ...]
 *   planOps.buildOutputSchema() // flat nullable schema for Codex structured output
 *
 * @version 1.0.0
 * @author Thomas Rohde
 * @lastModifiedDate 2026-02-22
 */
(function () {
    "use strict";
    if (typeof globalThis !== "undefined" && typeof globalThis.planOps !== "undefined") return;

    // ── Version constants ────────────────────────────────────────────────

    var SCHEMA_VERSION = "2.0";
    var ACCEPTED_VERSIONS = ["1.0", "2.0"];

    // ── Limits ───────────────────────────────────────────────────────────

    var MAX_ACTIONS = 100;
    var MAX_SUMMARY_LENGTH = 2000;
    var MAX_NAME_LENGTH = 1000;
    var MAX_KEY_LENGTH = 200;
    var MAX_VALUE_LENGTH = 5000;
    var MAX_REF_ID_LENGTH = 100;
    var MAX_DOC_LENGTH = 10000;
    var MAX_FOLDER_PATH_LENGTH = 500;

    // ── Element type labels ──────────────────────────────────────────────

    var ELEMENT_TYPE_LABELS = [
        "Stakeholder", "Driver", "Assessment", "Goal", "Outcome",
        "Principle", "Requirement", "Constraint", "Meaning", "Value",
        "Resource", "Capability", "Course Of Action", "Value Stream",
        "Business Actor", "Business Role", "Business Collaboration",
        "Business Interface", "Business Process", "Business Function",
        "Business Interaction", "Business Event", "Business Service",
        "Business Object", "Contract", "Representation", "Product",
        "Application Component", "Application Collaboration",
        "Application Interface", "Application Function",
        "Application Process", "Application Interaction",
        "Application Event", "Application Service", "Data Object",
        "Node", "Device", "System Software", "Technology Collaboration",
        "Technology Interface", "Path", "Communication Network",
        "Technology Function", "Technology Process",
        "Technology Interaction", "Technology Event",
        "Technology Service", "Artifact", "Equipment", "Facility",
        "Distribution Network", "Material",
        "Work Package", "Deliverable", "Implementation Event",
        "Plateau", "Gap"
    ];

    // ── Relationship type labels ─────────────────────────────────────────

    var RELATIONSHIP_LABELS = [
        "Composition", "Aggregation", "Assignment", "Realization",
        "Serving", "Access", "Influence", "Triggering", "Flow",
        "Specialization", "Association"
    ];

    // ── Operation definitions ────────────────────────────────────────────
    //
    // Each op maps to { required, optional, fields }.
    // fields: { fieldName: { type, nullable, enum, maxLength, description } }

    var OP_DEFS = {
        create_element: {
            required: ["op", "type", "name"],
            optional: ["ref_id"],
            fields: {
                op: { type: "string", const: "create_element" },
                type: { type: "string", enum: ELEMENT_TYPE_LABELS, description: "ArchiMate element type" },
                name: { type: "string", maxLength: MAX_NAME_LENGTH, description: "Element name" },
                ref_id: { type: "string", maxLength: MAX_REF_ID_LENGTH, nullable: true, description: "Reference ID for use by later actions" }
            }
        },
        rename_element: {
            required: ["op", "element_id", "new_name"],
            optional: [],
            fields: {
                op: { type: "string", const: "rename_element" },
                element_id: { type: "string", description: "ID of element/relationship to rename, or a ref_id" },
                new_name: { type: "string", maxLength: MAX_NAME_LENGTH, description: "New name" }
            }
        },
        set_property: {
            required: ["op", "element_id", "key", "value"],
            optional: [],
            fields: {
                op: { type: "string", const: "set_property" },
                element_id: { type: "string", description: "ID of element/relationship, or a ref_id" },
                key: { type: "string", maxLength: MAX_KEY_LENGTH, description: "Property key" },
                value: { type: "string", maxLength: MAX_VALUE_LENGTH, description: "Property value" }
            }
        },
        create_relationship: {
            required: ["op", "source_id", "target_id", "relationship_type"],
            optional: ["name"],
            fields: {
                op: { type: "string", const: "create_relationship" },
                source_id: { type: "string", description: "Source element ID or ref_id" },
                target_id: { type: "string", description: "Target element ID or ref_id" },
                relationship_type: { type: "string", enum: RELATIONSHIP_LABELS, description: "Relationship type label" },
                name: { type: "string", maxLength: MAX_NAME_LENGTH, nullable: true, description: "Optional relationship name" }
            }
        },
        set_documentation: {
            required: ["op", "element_id", "documentation"],
            optional: [],
            fields: {
                op: { type: "string", const: "set_documentation" },
                element_id: { type: "string", description: "ID of element/relationship, or a ref_id" },
                documentation: { type: "string", maxLength: MAX_DOC_LENGTH, description: "Documentation text" }
            }
        },
        delete_element: {
            required: ["op", "element_id"],
            optional: [],
            fields: {
                op: { type: "string", const: "delete_element" },
                element_id: { type: "string", description: "ID of element to delete (cascades relationships)" }
            }
        },
        delete_relationship: {
            required: ["op", "relationship_id"],
            optional: [],
            fields: {
                op: { type: "string", const: "delete_relationship" },
                relationship_id: { type: "string", description: "ID of relationship to delete" }
            }
        },
        remove_property: {
            required: ["op", "element_id", "key"],
            optional: [],
            fields: {
                op: { type: "string", const: "remove_property" },
                element_id: { type: "string", description: "ID of element/relationship, or a ref_id" },
                key: { type: "string", maxLength: MAX_KEY_LENGTH, description: "Property key to remove" }
            }
        },
        create_view: {
            required: ["op", "name"],
            optional: ["ref_id"],
            fields: {
                op: { type: "string", const: "create_view" },
                name: { type: "string", maxLength: MAX_NAME_LENGTH, description: "View name" },
                ref_id: { type: "string", maxLength: MAX_REF_ID_LENGTH, nullable: true, description: "Reference ID for use by later add_to_view actions" }
            }
        },
        add_to_view: {
            required: ["op", "view_id", "element_id"],
            optional: ["x", "y", "width", "height"],
            fields: {
                op: { type: "string", const: "add_to_view" },
                view_id: { type: "string", description: "ID of view or ref_id from create_view" },
                element_id: { type: "string", description: "ID of element or ref_id to place on view" },
                x: { type: "integer", nullable: true, description: "X coordinate (auto-grid if omitted)" },
                y: { type: "integer", nullable: true, description: "Y coordinate (auto-grid if omitted)" },
                width: { type: "integer", nullable: true, description: "Width (default 120)" },
                height: { type: "integer", nullable: true, description: "Height (default 55)" }
            }
        },
        move_to_folder: {
            required: ["op", "element_id", "folder_path"],
            optional: [],
            fields: {
                op: { type: "string", const: "move_to_folder" },
                element_id: { type: "string", description: "ID of element/relationship, or a ref_id" },
                folder_path: { type: "string", maxLength: MAX_FOLDER_PATH_LENGTH, description: "Folder path separated by / (e.g. 'Business/Actors')" }
            }
        }
    };

    // ── Helpers ───────────────────────────────────────────────────────────

    /**
     * Get array of all valid operation names.
     * @returns {string[]}
     */
    function getValidOps() {
        return Object.keys(OP_DEFS);
    }

    /**
     * Get the definition for a specific operation.
     * @param {string} opName
     * @returns {Object|null}
     */
    function getOpDef(opName) {
        return OP_DEFS[opName] || null;
    }

    /**
     * Build a flat nullable JSON Schema for Codex structured output.
     *
     * Structured output requires all action fields to exist in every action object,
     * with non-applicable fields set to null. This merges all fields from all ops
     * into a single flat schema where every field is either required or nullable.
     *
     * @returns {Object} JSON Schema object for use as outputSchema
     */
    function buildOutputSchema() {
        // Collect all unique field names across all ops
        var allFields = {};
        var allOpNames = [];
        var ops = getValidOps();

        for (var i = 0; i < ops.length; i++) {
            var def = OP_DEFS[ops[i]];
            allOpNames.push(ops[i]);
            var fieldNames = Object.keys(def.fields);
            for (var f = 0; f < fieldNames.length; f++) {
                var fname = fieldNames[f];
                if (!allFields[fname]) {
                    allFields[fname] = def.fields[fname];
                }
            }
        }

        // Build properties — every field is nullable except "op"
        var properties = {};
        var required = [];
        var fieldKeys = Object.keys(allFields);

        for (var j = 0; j < fieldKeys.length; j++) {
            var key = fieldKeys[j];
            var fieldDef = allFields[key];
            var prop = {};

            if (key === "op") {
                prop.type = "string";
                prop.enum = allOpNames;
            } else if (fieldDef.type === "integer") {
                prop.type = ["integer", "null"];
            } else if (fieldDef.enum) {
                prop.type = ["string", "null"];
                prop.enum = fieldDef.enum;
            } else {
                prop.type = ["string", "null"];
            }

            properties[key] = prop;
            required.push(key);
        }

        return {
            type: "object",
            required: ["schema_version", "status", "summary", "actions", "questions"],
            additionalProperties: false,
            properties: {
                schema_version: { type: "string" },
                status: {
                    type: "string",
                    enum: ["ready", "needs_clarification", "refusal"]
                },
                summary: { type: "string" },
                questions: {
                    type: ["array", "null"],
                    items: { type: "string" }
                },
                actions: {
                    type: "array",
                    items: {
                        type: "object",
                        required: required,
                        additionalProperties: false,
                        properties: properties
                    }
                }
            }
        };
    }

    // ── Normalization ────────────────────────────────────────────────────

    /**
     * Normalize plan actions from flat structured output format.
     *
     * The LLM structured output schema requires every action to include ALL
     * fields from ALL ops, with irrelevant ones set to null. However, the LLM
     * sometimes fills in non-null values for fields that don't belong to the
     * action's op (e.g. "type" on an add_to_view, or "relationship_type" on a
     * create_element). This function nulls out those irrelevant fields so the
     * validator sees only the fields that matter for each op.
     *
     * @param {Object} plan - The plan object (modified in place)
     * @returns {Object} The same plan object, normalized
     */
    function normalizeActions(plan) {
        if (!plan || !Array.isArray(plan.actions)) return plan;

        for (var i = 0; i < plan.actions.length; i++) {
            var action = plan.actions[i];
            if (!action || typeof action.op !== "string") continue;

            var def = OP_DEFS[action.op];
            if (!def) continue;

            var allowedFields = Object.keys(def.fields);
            var keys = Object.keys(action);
            for (var k = 0; k < keys.length; k++) {
                var key = keys[k];
                if (allowedFields.indexOf(key) === -1 && action[key] !== null) {
                    action[key] = null;
                }
            }
        }
        return plan;
    }

    // ── Public API ───────────────────────────────────────────────────────

    var planOps = {
        SCHEMA_VERSION: SCHEMA_VERSION,
        ACCEPTED_VERSIONS: ACCEPTED_VERSIONS,
        MAX_ACTIONS: MAX_ACTIONS,
        MAX_SUMMARY_LENGTH: MAX_SUMMARY_LENGTH,
        MAX_NAME_LENGTH: MAX_NAME_LENGTH,
        MAX_KEY_LENGTH: MAX_KEY_LENGTH,
        MAX_VALUE_LENGTH: MAX_VALUE_LENGTH,
        MAX_REF_ID_LENGTH: MAX_REF_ID_LENGTH,
        MAX_DOC_LENGTH: MAX_DOC_LENGTH,
        MAX_FOLDER_PATH_LENGTH: MAX_FOLDER_PATH_LENGTH,
        ELEMENT_TYPE_LABELS: ELEMENT_TYPE_LABELS,
        RELATIONSHIP_LABELS: RELATIONSHIP_LABELS,
        OP_DEFS: OP_DEFS,
        getValidOps: getValidOps,
        getOpDef: getOpDef,
        buildOutputSchema: buildOutputSchema,
        normalizeActions: normalizeActions
    };

    if (typeof globalThis !== "undefined") globalThis.planOps = planOps;
    if (typeof module !== "undefined" && module.exports) module.exports = planOps;
})();
