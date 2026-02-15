/**
 * @name modelPolicies
 * @description Standards loading and validation engine for naming, property,
 *   and documentation rules. Loads configurable standards from JSON config
 *   with safe built-in defaults. Supports check-only and apply-fix modes.
 * @version 1.0.0
 * @author Thomas Rohde
 * @lastModifiedDate 2026-02-15
 */
(function () {
    "use strict";
    if (typeof globalThis !== "undefined" && typeof globalThis.modelPolicies !== "undefined") return;

    // =================================================================
    // Element-to-layer mapping (58 ArchiMate element types)
    // =================================================================

    var ELEMENT_TO_LAYER = {
        "stakeholder": "motivation", "driver": "motivation", "assessment": "motivation",
        "goal": "motivation", "outcome": "motivation", "principle": "motivation",
        "requirement": "motivation", "constraint": "motivation", "meaning": "motivation",
        "value": "motivation",
        "resource": "strategy", "capability": "strategy", "course-of-action": "strategy",
        "value-stream": "strategy",
        "business-actor": "business", "business-role": "business",
        "business-collaboration": "business", "business-interface": "business",
        "business-process": "business", "business-function": "business",
        "business-interaction": "business", "business-event": "business",
        "business-service": "business", "business-object": "business",
        "contract": "business", "representation": "business", "product": "business",
        "application-component": "application", "application-collaboration": "application",
        "application-interface": "application", "application-function": "application",
        "application-process": "application", "application-interaction": "application",
        "application-event": "application", "application-service": "application",
        "data-object": "application",
        "node": "technology", "device": "technology", "system-software": "technology",
        "technology-collaboration": "technology", "technology-interface": "technology",
        "path": "technology", "communication-network": "technology",
        "technology-function": "technology", "technology-process": "technology",
        "technology-interaction": "technology", "technology-event": "technology",
        "technology-service": "technology", "artifact": "technology",
        "equipment": "physical", "facility": "physical",
        "distribution-network": "physical", "material": "physical",
        "work-package": "implementation", "deliverable": "implementation",
        "implementation-event": "implementation", "plateau": "implementation",
        "gap": "implementation"
    };

    var LAYER_LABELS = {
        "motivation": "Motivation",
        "strategy": "Strategy",
        "business": "Business",
        "application": "Application",
        "technology": "Technology",
        "physical": "Physical",
        "implementation": "Implementation"
    };

    // =================================================================
    // Default Standards (safe zero-config)
    // =================================================================

    function getDefaultStandards() {
        return {
            version: "1.0.0",
            naming: {
                global: {
                    minLength: 2,
                    maxLength: 120,
                    trimWhitespace: true,
                    noMultipleSpaces: true,
                    noControlChars: true
                },
                byType: {},
                byLayer: {}
            },
            properties: {
                global: [],
                byType: {},
                byLayer: {}
            },
            documentation: {
                requiredForTypes: [],
                requiredForLayers: [],
                minLength: 0
            }
        };
    }

    // =================================================================
    // Standards Loading
    // =================================================================

    function loadStandards(configPath) {
        var Files = Java.type("java.nio.file.Files");
        var Paths = Java.type("java.nio.file.Paths");
        var JString = Java.type("java.lang.String");

        var path = Paths.get(configPath);
        if (Files.exists(path)) {
            try {
                var content = new JString(Files.readAllBytes(path), "UTF-8");
                var parsed = JSON.parse(String(content));
                return mergeStandards(getDefaultStandards(), parsed);
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    function mergeStandards(defaults, custom) {
        var result = JSON.parse(JSON.stringify(defaults));
        if (custom.version) result.version = custom.version;

        if (custom.naming) {
            if (custom.naming.global) {
                var gKeys = Object.keys(custom.naming.global);
                for (var i = 0; i < gKeys.length; i++) {
                    result.naming.global[gKeys[i]] = custom.naming.global[gKeys[i]];
                }
            }
            if (custom.naming.byType) result.naming.byType = custom.naming.byType;
            if (custom.naming.byLayer) result.naming.byLayer = custom.naming.byLayer;
        }

        if (custom.properties) {
            if (custom.properties.global) result.properties.global = custom.properties.global;
            if (custom.properties.byType) result.properties.byType = custom.properties.byType;
            if (custom.properties.byLayer) result.properties.byLayer = custom.properties.byLayer;
        }

        if (custom.documentation) {
            if (custom.documentation.requiredForTypes) result.documentation.requiredForTypes = custom.documentation.requiredForTypes;
            if (custom.documentation.requiredForLayers) result.documentation.requiredForLayers = custom.documentation.requiredForLayers;
            if (custom.documentation.minLength !== undefined) result.documentation.minLength = custom.documentation.minLength;
        }

        return result;
    }

    // =================================================================
    // Naming Validation
    // =================================================================

    function validateNaming(element, standards) {
        var violations = [];
        var name = element.name || "";
        var elType = element.type;
        var layer = ELEMENT_TO_LAYER[elType] || null;
        var rules = standards.naming.global;

        var typeRules = standards.naming.byType[elType] || {};
        var layerRules = layer ? (standards.naming.byLayer[layer] || {}) : {};

        // Effective limits (type > layer > global)
        var effectiveMinLength = typeRules.minLength !== undefined ? typeRules.minLength :
            (layerRules.minLength !== undefined ? layerRules.minLength : rules.minLength);
        var effectiveMaxLength = typeRules.maxLength !== undefined ? typeRules.maxLength :
            (layerRules.maxLength !== undefined ? layerRules.maxLength : rules.maxLength);

        var layerLabel = layer ? (LAYER_LABELS[layer] || layer) : "(unknown)";

        // Empty name
        if (!name || name.trim().length === 0) {
            violations.push({
                severity: "error",
                ruleId: "naming.empty",
                elementId: element.id,
                elementName: name,
                elementType: elType,
                elementLayer: layerLabel,
                message: "Element has no name",
                currentValue: name,
                fix: null
            });
            return violations;
        }

        // Too short
        if (name.trim().length < effectiveMinLength) {
            violations.push({
                severity: "warning",
                ruleId: "naming.tooShort",
                elementId: element.id,
                elementName: name,
                elementType: elType,
                elementLayer: layerLabel,
                message: "Name too short (min " + effectiveMinLength + " chars)",
                currentValue: name,
                fix: null
            });
        }

        // Too long
        if (name.length > effectiveMaxLength) {
            violations.push({
                severity: "warning",
                ruleId: "naming.tooLong",
                elementId: element.id,
                elementName: name,
                elementType: elType,
                elementLayer: layerLabel,
                message: "Name too long (max " + effectiveMaxLength + " chars, actual " + name.length + ")",
                currentValue: name,
                fix: null
            });
        }

        // Leading/trailing whitespace
        if (rules.trimWhitespace && name !== name.trim()) {
            violations.push({
                severity: "warning",
                ruleId: "naming.whitespace",
                elementId: element.id,
                elementName: name,
                elementType: elType,
                elementLayer: layerLabel,
                message: "Name has leading or trailing whitespace",
                currentValue: name,
                fix: { type: "rename", proposedValue: name.trim(), key: null }
            });
        }

        // Multiple consecutive spaces
        if (rules.noMultipleSpaces && /  +/.test(name)) {
            var fixed = name.replace(/ {2,}/g, " ");
            if (rules.trimWhitespace) fixed = fixed.trim();
            violations.push({
                severity: "warning",
                ruleId: "naming.multipleSpaces",
                elementId: element.id,
                elementName: name,
                elementType: elType,
                elementLayer: layerLabel,
                message: "Name contains multiple consecutive spaces",
                currentValue: name,
                fix: { type: "rename", proposedValue: fixed, key: null }
            });
        }

        // Control characters
        if (rules.noControlChars && /[\x00-\x1f\x7f]/.test(name)) {
            var cleaned = name.replace(/[\x00-\x1f\x7f]/g, "");
            if (rules.trimWhitespace) cleaned = cleaned.trim();
            if (rules.noMultipleSpaces) cleaned = cleaned.replace(/ {2,}/g, " ");
            violations.push({
                severity: "error",
                ruleId: "naming.controlChars",
                elementId: element.id,
                elementName: name,
                elementType: elType,
                elementLayer: layerLabel,
                message: "Name contains control characters",
                currentValue: name,
                fix: { type: "rename", proposedValue: cleaned, key: null }
            });
        }

        // Type-specific regex pattern
        if (typeRules.pattern) {
            try {
                var re = new RegExp(typeRules.pattern);
                if (!re.test(name)) {
                    violations.push({
                        severity: "warning",
                        ruleId: "naming.pattern",
                        elementId: element.id,
                        elementName: name,
                        elementType: elType,
                        elementLayer: layerLabel,
                        message: "Name does not match pattern: " + typeRules.pattern,
                        currentValue: name,
                        fix: null
                    });
                }
            } catch (e) { /* invalid regex in config */ }
        }

        // Layer-specific regex pattern (only if no type pattern)
        if (layerRules.pattern && !typeRules.pattern) {
            try {
                var layerRe = new RegExp(layerRules.pattern);
                if (!layerRe.test(name)) {
                    violations.push({
                        severity: "warning",
                        ruleId: "naming.pattern",
                        elementId: element.id,
                        elementName: name,
                        elementType: elType,
                        elementLayer: layerLabel,
                        message: "Name does not match layer pattern: " + layerRules.pattern,
                        currentValue: name,
                        fix: null
                    });
                }
            } catch (e) { /* invalid regex */ }
        }

        // Type-specific transform suggestion
        if (typeRules.transform) {
            var transformed = computeRename(name, [typeRules.transform]);
            if (transformed !== name) {
                violations.push({
                    severity: "info",
                    ruleId: "naming.transform",
                    elementId: element.id,
                    elementName: name,
                    elementType: elType,
                    elementLayer: layerLabel,
                    message: "Name should use " + typeRules.transform + " format",
                    currentValue: name,
                    fix: { type: "rename", proposedValue: transformed, key: null }
                });
            }
        }

        return violations;
    }

    // =================================================================
    // Property Validation
    // =================================================================

    function validateProperties(element, standards) {
        var violations = [];
        var elType = element.type;
        var layer = ELEMENT_TO_LAYER[elType] || null;
        var layerLabel = layer ? (LAYER_LABELS[layer] || layer) : "(unknown)";

        // Collect required properties from global, type, and layer rules
        var requiredProps = [];

        if (standards.properties.global) {
            for (var i = 0; i < standards.properties.global.length; i++) {
                requiredProps.push(standards.properties.global[i]);
            }
        }

        if (standards.properties.byType[elType]) {
            var typeProps = standards.properties.byType[elType];
            for (var i = 0; i < typeProps.length; i++) {
                requiredProps.push(typeProps[i]);
            }
        }

        if (layer && standards.properties.byLayer[layer]) {
            var layerProps = standards.properties.byLayer[layer];
            for (var i = 0; i < layerProps.length; i++) {
                requiredProps.push(layerProps[i]);
            }
        }

        for (var p = 0; p < requiredProps.length; p++) {
            var propDef = requiredProps[p];
            var propName = typeof propDef === "string" ? propDef : propDef.name;
            var propDefault = typeof propDef === "object" ? (propDef.defaultValue || "") : "";
            var propRequired = typeof propDef === "object" ? propDef.required !== false : true;

            var currentVal = element.prop(propName);

            if (!currentVal || !currentVal.trim()) {
                violations.push({
                    severity: propRequired ? "warning" : "info",
                    ruleId: "property.missing",
                    elementId: element.id,
                    elementName: element.name || "(unnamed)",
                    elementType: elType,
                    elementLayer: layerLabel,
                    message: "Missing required property: " + propName,
                    currentValue: "",
                    fix: propDefault ? { type: "setProperty", proposedValue: propDefault, key: propName } : null
                });
            }

            // Allowed values check
            if (currentVal && typeof propDef === "object" && propDef.allowedValues && propDef.allowedValues.length > 0) {
                var isAllowed = false;
                for (var av = 0; av < propDef.allowedValues.length; av++) {
                    if (currentVal.trim() === propDef.allowedValues[av]) {
                        isAllowed = true;
                        break;
                    }
                }
                if (!isAllowed) {
                    violations.push({
                        severity: "warning",
                        ruleId: "property.invalidValue",
                        elementId: element.id,
                        elementName: element.name || "(unnamed)",
                        elementType: elType,
                        elementLayer: layerLabel,
                        message: "Property '" + propName + "' has invalid value: " + currentVal +
                            " (allowed: " + propDef.allowedValues.join(", ") + ")",
                        currentValue: currentVal,
                        fix: null
                    });
                }
            }
        }

        return violations;
    }

    // =================================================================
    // Documentation Validation
    // =================================================================

    function validateDocumentation(element, standards) {
        var violations = [];
        var elType = element.type;
        var layer = ELEMENT_TO_LAYER[elType] || null;
        var layerLabel = layer ? (LAYER_LABELS[layer] || layer) : "(unknown)";
        var docRules = standards.documentation;

        var isRequired = false;

        if (docRules.requiredForTypes && docRules.requiredForTypes.length > 0) {
            for (var i = 0; i < docRules.requiredForTypes.length; i++) {
                if (docRules.requiredForTypes[i] === elType) {
                    isRequired = true;
                    break;
                }
            }
        }

        if (!isRequired && layer && docRules.requiredForLayers && docRules.requiredForLayers.length > 0) {
            for (var i = 0; i < docRules.requiredForLayers.length; i++) {
                if (docRules.requiredForLayers[i] === layer) {
                    isRequired = true;
                    break;
                }
            }
        }

        var doc = element.documentation || "";

        if (isRequired && (!doc || !doc.trim())) {
            violations.push({
                severity: "warning",
                ruleId: "documentation.missing",
                elementId: element.id,
                elementName: element.name || "(unnamed)",
                elementType: elType,
                elementLayer: layerLabel,
                message: "Documentation is required for " + elType + " elements",
                currentValue: "",
                fix: null
            });
        }

        if (doc && doc.trim() && docRules.minLength > 0 && doc.trim().length < docRules.minLength) {
            violations.push({
                severity: "info",
                ruleId: "documentation.tooShort",
                elementId: element.id,
                elementName: element.name || "(unnamed)",
                elementType: elType,
                elementLayer: layerLabel,
                message: "Documentation too short (min " + docRules.minLength + " chars, actual " + doc.trim().length + ")",
                currentValue: doc,
                fix: null
            });
        }

        return violations;
    }

    // =================================================================
    // Full Model Validation
    // =================================================================

    function validateModel(elements, standards) {
        var allViolations = [];
        var summary = {
            totalElements: 0,
            naming: { error: 0, warning: 0, info: 0 },
            properties: { error: 0, warning: 0, info: 0 },
            documentation: { error: 0, warning: 0, info: 0 }
        };

        elements.each(function (el) {
            summary.totalElements++;
            if (summary.totalElements % 500 === 0 && typeof log !== "undefined") {
                log.detail("  Checked " + summary.totalElements + " elements...");
            }

            var namingViolations = validateNaming(el, standards);
            for (var i = 0; i < namingViolations.length; i++) {
                namingViolations[i].category = "naming";
                allViolations.push(namingViolations[i]);
                summary.naming[namingViolations[i].severity]++;
            }

            var propViolations = validateProperties(el, standards);
            for (var i = 0; i < propViolations.length; i++) {
                propViolations[i].category = "properties";
                allViolations.push(propViolations[i]);
                summary.properties[propViolations[i].severity]++;
            }

            var docViolations = validateDocumentation(el, standards);
            for (var i = 0; i < docViolations.length; i++) {
                docViolations[i].category = "documentation";
                allViolations.push(docViolations[i]);
                summary.documentation[docViolations[i].severity]++;
            }
        });

        return { violations: allViolations, summary: summary };
    }

    // =================================================================
    // Rename Transforms
    // =================================================================

    function computeRename(name, transforms) {
        var result = name;
        for (var t = 0; t < transforms.length; t++) {
            switch (transforms[t]) {
                case "trim":
                    result = result.trim();
                    break;
                case "collapseSpaces":
                    result = result.replace(/ {2,}/g, " ");
                    break;
                case "stripControlChars":
                    result = result.replace(/[\x00-\x1f\x7f]/g, "");
                    break;
                case "capitalizeFirst":
                    if (result.length > 0) {
                        result = result.charAt(0).toUpperCase() + result.slice(1);
                    }
                    break;
                case "titleCase":
                    result = result.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
                    break;
            }
        }
        return result;
    }

    // =================================================================
    // Apply Fixes
    // =================================================================

    function applyFixes(fixes) {
        var applied = { renames: 0, properties: 0, failed: 0 };

        for (var i = 0; i < fixes.length; i++) {
            var fix = fixes[i];
            if (!fix.fix) continue;

            try {
                var el = $("#" + fix.elementId).first();
                if (!el) {
                    applied.failed++;
                    continue;
                }

                switch (fix.fix.type) {
                    case "rename":
                        el.name = fix.fix.proposedValue;
                        applied.renames++;
                        break;
                    case "setProperty":
                        el.prop(fix.fix.key, fix.fix.proposedValue);
                        applied.properties++;
                        break;
                    default:
                        applied.failed++;
                }
            } catch (e) {
                applied.failed++;
            }
        }

        return applied;
    }

    // =================================================================
    // Public API
    // =================================================================

    var modelPolicies = {
        ELEMENT_TO_LAYER: ELEMENT_TO_LAYER,
        LAYER_LABELS: LAYER_LABELS,

        loadStandards: loadStandards,
        getDefaultStandards: getDefaultStandards,
        validateNaming: validateNaming,
        validateProperties: validateProperties,
        validateDocumentation: validateDocumentation,
        validateModel: validateModel,
        computeRename: computeRename,
        applyFixes: applyFixes
    };

    if (typeof globalThis !== "undefined") globalThis.modelPolicies = modelPolicies;
    if (typeof module !== "undefined" && module.exports) module.exports = modelPolicies;
})();
