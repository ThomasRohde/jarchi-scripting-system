/**
 * @name relationshipMatrix
 * @description ArchiMate 3.1 allowed-relationship matrix as a programmatic lookup.
 *   Encodes the full 58x58 source/target element type matrix from the ArchiMate specification.
 * @version 1.0.0
 * @author Thomas Rohde
 * @lastModifiedDate 2026-02-15
 */
(function () {
    "use strict";
    if (typeof globalThis !== "undefined" && typeof globalThis.relationshipMatrix !== "undefined") return;

    // Relationship code-to-type mapping
    var CODE_TO_TYPE = {
        "S":  "serving-relationship",
        "F":  "flow-relationship",
        "A":  "access-relationship",
        "I":  "influence-relationship",
        "As": "association-relationship",
        "T":  "triggering-relationship",
        "R":  "realization-relationship",
        "C":  "composition-relationship",
        "Ag": "aggregation-relationship",
        "An": "assignment-relationship",
        "Sp": "specialization-relationship"
    };

    // Human-readable labels for relationship types
    var TYPE_TO_LABEL = {};
    var codes = Object.keys(CODE_TO_TYPE);
    for (var ci = 0; ci < codes.length; ci++) {
        var relType = CODE_TO_TYPE[codes[ci]];
        TYPE_TO_LABEL[relType] = relType.replace("-relationship", "").replace(/(^|\-)(\w)/g, function (m, sep, ch) {
            return (sep ? " " : "") + ch.toUpperCase();
        });
    }

    // All 58 element types in matrix column order
    var ELEMENT_TYPES = [
        "stakeholder", "driver", "assessment", "goal", "outcome",
        "principle", "requirement", "constraint", "meaning", "value",
        "resource", "capability", "course-of-action", "value-stream",
        "business-actor", "business-role", "business-collaboration",
        "business-interface", "business-process", "business-function",
        "business-interaction", "business-event", "business-service",
        "business-object", "contract", "representation", "product",
        "application-component", "application-collaboration",
        "application-interface", "application-function",
        "application-process", "application-interaction",
        "application-event", "application-service", "data-object",
        "node", "device", "system-software", "technology-collaboration",
        "technology-interface", "path", "communication-network",
        "technology-function", "technology-process",
        "technology-interaction", "technology-event",
        "technology-service", "artifact", "equipment", "facility",
        "distribution-network", "material",
        "work-package", "deliverable", "implementation-event",
        "plateau", "gap"
    ];

    // Build a set for fast type lookups
    var ELEMENT_TYPE_SET = {};
    for (var ei = 0; ei < ELEMENT_TYPES.length; ei++) {
        ELEMENT_TYPE_SET[ELEMENT_TYPES[ei]] = true;
    }

    // Flat-key matrix: MATRIX["sourceType|targetType"] = ["serving-relationship", ...]
    var MATRIX = {};

    function parseCodes(cellStr) {
        if (!cellStr || cellStr === "-") return [];
        var parts = cellStr.split(",");
        var result = [];
        for (var i = 0; i < parts.length; i++) {
            var t = CODE_TO_TYPE[parts[i]];
            if (t) result.push(t);
        }
        return result;
    }

    function addRow(sourceType, cells) {
        for (var i = 0; i < cells.length && i < ELEMENT_TYPES.length; i++) {
            MATRIX[sourceType + "|" + ELEMENT_TYPES[i]] = parseCodes(cells[i]);
        }
    }

    // =========================================================================
    // Full ArchiMate 3.1 relationship matrix (58 rows x 58 columns)
    // Source: context/Allowed relationships.md
    // =========================================================================

    // Row 1: stakeholder
    addRow("stakeholder", ["I,As,C,Ag,Sp","I,As","I,As","I,As","I,As","I,As","I,As","I,As","I,As","I,As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As"]);

    // Row 2: driver
    addRow("driver", ["I,As","I,As,C,Ag,Sp","I,As","I,As","I,As","I,As","I,As","I,As","I,As","I,As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As"]);

    // Row 3: assessment
    addRow("assessment", ["I,As","I,As","I,As,C,Ag,Sp","I,As","I,As","I,As","I,As","I,As","I,As","I,As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As"]);

    // Row 4: goal
    addRow("goal", ["I,As","I,As","I,As","I,As,C,Ag,Sp","I,As","I,As","I,As","I,As","I,As","I,As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As"]);

    // Row 5: outcome
    addRow("outcome", ["I,As","I,As","I,As","I,As,R","I,As,C,Ag,Sp","I,As","I,As","I,As","I,As","I,As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As"]);

    // Row 6: principle
    addRow("principle", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,C,Ag,Sp","I,As","I,As","I,As","I,As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As"]);

    // Row 7: requirement
    addRow("requirement", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,C,Ag,Sp","I,As,C,Ag,Sp","I,As","I,As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As"]);

    // Row 8: constraint
    addRow("constraint", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,C,Ag,Sp","I,As,C,Ag,Sp","I,As","I,As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As"]);

    // Row 9: meaning
    addRow("meaning", ["I,As","I,As","I,As","I,As","I,As","I,As","I,As","I,As","I,As,C,Ag,Sp","I,As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As"]);

    // Row 10: value
    addRow("value", ["I,As","I,As","I,As","I,As","I,As","I,As","I,As","I,As","I,As","I,As,C,Ag,Sp","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As"]);

    // Row 11: resource
    addRow("resource", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","S,F,As,T,C,Ag,Sp","S,F,As,T","S,F,As,T,R","S,F,As,T","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As"]);

    // Row 12: capability
    addRow("capability", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","S,F,As,T","S,F,As,T,C,Ag,Sp","S,F,As,T,R","S,F,As,T","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As"]);

    // Row 13: course-of-action
    addRow("course-of-action", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","S,F,As,T","S,F,As,T","S,F,As,T,C,Ag,Sp","S,F,As,T","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As"]);

    // Row 14: value-stream
    addRow("value-stream", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T,C,Ag,Sp","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As"]);

    // Row 15: business-actor
    addRow("business-actor", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As,R","As,R","As,R","As,R","S,F,As,T,C,Ag,Sp","S,F,As,T","S,F,As,T","S,F,As,T,C,Ag","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","A,As","A,As","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 16: business-role
    addRow("business-role", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As,R","As,R","As,R","As,R","S,F,As,T","S,F,As,T,C,Ag,Sp","S,F,As,T","S,F,As,T,C,Ag","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","A,As","A,As","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 17: business-collaboration
    addRow("business-collaboration", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As,R","As,R","As,R","As,R","S,F,As,T,Ag","S,F,As,T,Ag","S,F,As,T,C,Ag,Sp","S,F,As,T,C,Ag","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","A,As","A,As","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 18: business-interface
    addRow("business-interface", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As,R","As,R","As,R","As,R","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,C,Ag,Sp","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","A,As","A,As","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 19: business-process
    addRow("business-process", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As","As,R","As,R","As,R","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,C,Ag,Sp","S,F,As,T,C,Ag","S,F,As,T,C,Ag","S,F,As,T","S,F,As,T,R","A,As","A,As","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 20: business-function
    addRow("business-function", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As","As,R","As,R","As,R","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,C,Ag","S,F,As,T,C,Ag,Sp","S,F,As,T,C,Ag","S,F,As,T","S,F,As,T,R","A,As","A,As","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 21: business-interaction
    addRow("business-interaction", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As","As,R","As,R","As,R","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,C,Ag","S,F,As,T,C,Ag","S,F,As,T,C,Ag,Sp","S,F,As,T","S,F,As,T,R","A,As","A,As","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 22: business-event
    addRow("business-event", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As","As","As","As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,C,Ag,Sp","S,F,As,T","A,As","A,As","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 23: business-service
    addRow("business-service", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As","As,R","As,R","As,R","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,C,Ag,Sp","A,As","A,As","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 24: business-object
    addRow("business-object", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As,R","As,R","As,R","As,R","As","As","As","As","As","As","As","As","As","As,C,Ag,Sp","As,C,Ag,Sp","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As"]);

    // Row 25: contract
    addRow("contract", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As,R","As,R","As,R","As,R","As","As","As","As","As","As","As","As","As","As,C,Ag,Sp","As,C,Ag,Sp","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As"]);

    // Row 26: representation
    addRow("representation", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As,R","As,R","As,R","As,R","As","As","As","As","As","As","As","As","As","As,R","As,R","As,C,Ag,Sp","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As"]);

    // Row 27: product
    addRow("product", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As,R","As,R","As,R","As,R","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R,C,Ag","A,As,C,Ag","A,As,C,Ag","A,As,C,Ag","S,F,As,T,C,Ag,Sp","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R,C,Ag","A,As,C,Ag","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T","S,F,As,T,R","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R,C,Ag","A,As,C,Ag","S,F,As,T,R","S,F,As,T","S,F,As,T","A,As,C,Ag","As","As","As","As","As"]);

    // Row 28: application-component
    addRow("application-component", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As,R","As,R","As,R","As,R","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","A,As","A,As","S,F,As,T","S,F,As,T,R,C,Ag,Sp","S,F,As,T","S,F,As,T,R,C,Ag","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 29: application-collaboration
    addRow("application-collaboration", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As,R","As,R","As,R","As,R","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","A,As","A,As","S,F,As,T","S,F,As,T,R,Ag","S,F,As,T,C,Ag,Sp","S,F,As,T,R,C,Ag","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 30: application-interface
    addRow("application-interface", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As,R","As,R","As,R","As,R","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","A,As","A,As","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,C,Ag,Sp","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 31: application-function
    addRow("application-function", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As","As,R","As,R","As,R","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T","S,F,As,T,R","A,As","A,As","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,C,Ag,Sp","S,F,As,T,C,Ag","S,F,As,T,C,Ag","S,F,As,T","S,F,As,T,R","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 32: application-process
    addRow("application-process", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As","As,R","As,R","As,R","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T","S,F,As,T,R","A,As","A,As","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,C,Ag","S,F,As,T,C,Ag,Sp","S,F,As,T,C,Ag","S,F,As,T","S,F,As,T,R","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 33: application-interaction
    addRow("application-interaction", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As","As,R","As,R","As,R","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T","S,F,As,T,R","A,As","A,As","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,C,Ag","S,F,As,T,C,Ag","S,F,As,T,C,Ag,Sp","S,F,As,T","S,F,As,T,R","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 34: application-event
    addRow("application-event", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As","As","As","As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T","A,As","A,As","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,C,Ag,Sp","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 35: application-service
    addRow("application-service", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As","As,R","As,R","As,R","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","A,As","A,As","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,C,Ag,Sp","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 36: data-object
    addRow("data-object", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As,R","As,R","As,R","As,R","As","As","As","As","As","As","As","As","As","As,R","As,R","As","As","As","As","As","As","As","As","As","As","As,C,Ag,Sp","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As"]);

    // Row 37: node
    addRow("node", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As,R","As,R","As,R","As,R","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","A,As","A,As","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","S,F,As,T,C,Ag,Sp","S,F,As,T,R,C,Ag","S,F,As,T,R,C,Ag","S,F,As,T","S,F,As,T,R,C,Ag","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","S,F,As,T,R,C,Ag","S,F,As,T,C,Ag","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 38: device
    addRow("device", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As,R","As,R","As,R","As,R","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","A,As","A,As","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","S,F,As,T","S,F,As,T,C,Ag,Sp","S,F,As,T,R,C,Ag","S,F,As,T","S,F,As,T,R,C,Ag","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","S,F,As,T","S,F,As,T","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 39: system-software
    addRow("system-software", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As,R","As,R","As,R","As,R","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","A,As","A,As","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","S,F,As,T","S,F,As,T","S,F,As,T,R,C,Ag,Sp","S,F,As,T","S,F,As,T,R,C,Ag","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","S,F,As,T","S,F,As,T","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 40: technology-collaboration
    addRow("technology-collaboration", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As,R","As,R","As,R","As,R","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","A,As","A,As","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","S,F,As,T,Ag","S,F,As,T,R,Ag","S,F,As,T,R,Ag","S,F,As,T,C,Ag,Sp","S,F,As,T,R,C,Ag","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","S,F,As,T,R,Ag","S,F,As,T,Ag","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 41: technology-interface
    addRow("technology-interface", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As,R","As,R","As,R","As,R","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","A,As","A,As","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,C,Ag,Sp","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 42: path
    addRow("path", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As,R","As,R","As,R","As,R","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","A,As","A,As","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","S,F,As,T,Ag","S,F,As,T,R,Ag","S,F,As,T,R,Ag","S,F,As,T,Ag","S,F,As,T,R,Ag","S,F,As,T,C,Ag,Sp","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","S,F,As,T,R,Ag","S,F,As,T,Ag","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 43: communication-network
    addRow("communication-network", ["I,As,R","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As,R","As,R","As,R","As,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","A,As","A,As","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","S,F,As,T,R","S,F,As,T,R,Ag","S,F,As,T,R,Ag","S,F,As,T,R","S,F,As,T,R,Ag","S,F,As,T,R","S,F,As,T,C,Ag,Sp","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","S,F,As,T,R","S,F,As,T,R","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 44: technology-function
    addRow("technology-function", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As","As,R","As,R","As,R","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T","S,F,As,T,R","A,As","A,As","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T","S,F,As,T,R","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,C,Ag,Sp","S,F,As,T,C,Ag","S,F,As,T,C,Ag","S,F,As,T","S,F,As,T,R","A,As","S,F,As,T","S,F,As,T","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 45: technology-process
    addRow("technology-process", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As","As,R","As,R","As,R","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T","S,F,As,T,R","A,As","A,As","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T","S,F,As,T,R","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,C,Ag","S,F,As,T,C,Ag,Sp","S,F,As,T,C,Ag","S,F,As,T","S,F,As,T,R","A,As","S,F,As,T","S,F,As,T","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 46: technology-interaction
    addRow("technology-interaction", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As","As,R","As,R","As,R","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T","S,F,As,T,R","A,As","A,As","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T","S,F,As,T,R","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,C,Ag","S,F,As,T,C,Ag","S,F,As,T,C,Ag,Sp","S,F,As,T","S,F,As,T,R","A,As","S,F,As,T","S,F,As,T","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 47: technology-event
    addRow("technology-event", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As","As","As","As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T","A,As","A,As","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,C,Ag,Sp","S,F,As,T","A,As","S,F,As,T","S,F,As,T","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 48: technology-service
    addRow("technology-service", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As","As,R","As,R","As,R","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","A,As","A,As","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","A,As","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,C,Ag,Sp","A,As","S,F,As,T","S,F,As,T","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 49: artifact
    addRow("artifact", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As,R","As,R","As,R","As,R","As","As","As","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As","As","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As","As","As,R","As","As,R","As","As","As,R","As,R","As,R","As,R","As,R","As,R,C,Ag,Sp","As","As","As","As","As","As","As","As","As"]);

    // Row 50: equipment
    addRow("equipment", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As,R","As,R","As,R","As,R","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","A,As","A,As","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","S,F,As,T","S,F,As,T,R,C,Ag","S,F,As,T,R,C,Ag","S,F,As,T","S,F,As,T,R,C,Ag","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","S,F,As,T,R,C,Ag,Sp","S,F,As,T","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 51: facility
    addRow("facility", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As,R","As,R","As,R","As,R","S,F,As,T","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","A,As","A,As","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","S,F,As,T,C,Ag","S,F,As,T,R,C,Ag","S,F,As,T,R,C,Ag","S,F,As,T","S,F,As,T,R,C,Ag","S,F,As,T","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","S,F,As,T,R,C,Ag","S,F,As,T,C,Ag,Sp","S,F,As,T","A,As","As","As","As","As","As"]);

    // Row 52: distribution-network
    addRow("distribution-network", ["I,As,R","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As,R","As,R","As,R","As,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","A,As","A,As","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","S,F,As,T,R,Ag","S,F,As,T,R,Ag","S,F,As,T,R,Ag","S,F,As,T,R","S,F,As,T,R,Ag","S,F,As,T,R","S,F,As,T","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","S,F,As,T,R","A,As","S,F,As,T,R,Ag","S,F,As,T,R,Ag","S,F,As,T,C,Ag,Sp","A,As","As","As","As","As","As"]);

    // Row 53: material
    addRow("material", ["I,As","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As,R","As,R","As,R","As,R","As","As","As","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As","As","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As","As,R","As,R","As","As,R","As","As","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As","As","As,R,C,Ag,Sp","As","As","As","As","As"]);

    // Row 54: work-package
    addRow("work-package", ["I,As,R","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","F,As,T,C,Ag,Sp","A,As,R","F,As,T","F,As,T,R","As"]);

    // Row 55: deliverable
    addRow("deliverable", ["I,As,R","I,As","I,As","I,As,R","I,As,R","I,As,R","I,As,R","I,As,R","I,As","I,As","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As,R","As","As,C,Ag,Sp","As","As,R","As"]);

    // Row 56: implementation-event
    addRow("implementation-event", ["I,As","I,As","I,As","I,As","I,As","I,As","I,As","I,As","I,As","I,As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","F,As,T","A,As","F,As,T,C,Ag,Sp","F,As,T","As"]);

    // Row 57: plateau
    addRow("plateau", ["I,As,R","I,As","I,As","I,As,R,C,Ag","I,As,R,C,Ag","I,As,R","I,As,R,C,Ag","I,As,R,C,Ag","I,As","I,As","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","As,R,C,Ag","F,As,T","A,As","F,As,T","F,As,T,C,Ag,Sp","As"]);

    // Row 58: gap
    addRow("gap", ["As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As","As,C,Ag,Sp"]);

    // =========================================================================
    // Public API
    // =========================================================================

    var relationshipMatrix = {
        /**
         * Check if a relationship type is allowed between source and target element types.
         * @param {string} sourceType - e.g. "business-actor"
         * @param {string} targetType - e.g. "business-process"
         * @param {string} relType - e.g. "serving-relationship"
         * @returns {boolean}
         */
        isAllowed: function (sourceType, targetType, relType) {
            var key = sourceType + "|" + targetType;
            var allowed = MATRIX[key];
            if (!allowed) return false;
            for (var i = 0; i < allowed.length; i++) {
                if (allowed[i] === relType) return true;
            }
            return false;
        },

        /**
         * Get all allowed relationship types between two element types.
         * @param {string} sourceType
         * @param {string} targetType
         * @returns {string[]} Array of relationship type strings
         */
        getAllowed: function (sourceType, targetType) {
            var key = sourceType + "|" + targetType;
            return (MATRIX[key] || []).slice();
        },

        /**
         * Check if an element type is known to the matrix.
         * @param {string} elementType
         * @returns {boolean}
         */
        isKnownType: function (elementType) {
            return ELEMENT_TYPE_SET[elementType] === true;
        },

        /**
         * Get all element types known to the matrix.
         * @returns {string[]}
         */
        getElementTypes: function () {
            return ELEMENT_TYPES.slice();
        },

        /**
         * Get a human-readable label for a relationship type.
         * @param {string} relType - e.g. "serving-relationship"
         * @returns {string} e.g. "Serving"
         */
        getRelationshipLabel: function (relType) {
            return TYPE_TO_LABEL[relType] || relType;
        }
    };

    if (typeof globalThis !== "undefined") globalThis.relationshipMatrix = relationshipMatrix;
    if (typeof module !== "undefined" && module.exports) module.exports = relationshipMatrix;
})();
