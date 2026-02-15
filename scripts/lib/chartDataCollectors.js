/**
 * @module chartDataCollectors
 * @description Data collection methods for chart rendering. Queries the model
 * using jArchi's $() API and returns Chart.js-compatible data structures.
 * Dispatched by the `dataSource.method` field in chart definitions.
 * @version 1.0.0
 */
(function () {
    "use strict";

    if (typeof globalThis !== "undefined" && typeof globalThis.chartDataCollectors !== "undefined") return;

    // =========================================================================
    // ArchiMate type display names
    // =========================================================================

    var TYPE_DISPLAY_NAMES = {
        "business-actor": "Business Actor",
        "business-role": "Business Role",
        "business-collaboration": "Business Collaboration",
        "business-interface": "Business Interface",
        "business-process": "Business Process",
        "business-function": "Business Function",
        "business-interaction": "Business Interaction",
        "business-event": "Business Event",
        "business-service": "Business Service",
        "business-object": "Business Object",
        "contract": "Contract",
        "representation": "Representation",
        "product": "Product",
        "application-component": "Application Component",
        "application-collaboration": "Application Collaboration",
        "application-interface": "Application Interface",
        "application-function": "Application Function",
        "application-interaction": "Application Interaction",
        "application-process": "Application Process",
        "application-event": "Application Event",
        "application-service": "Application Service",
        "data-object": "Data Object",
        "node": "Node",
        "device": "Device",
        "system-software": "System Software",
        "technology-collaboration": "Technology Collaboration",
        "technology-interface": "Technology Interface",
        "technology-process": "Technology Process",
        "technology-function": "Technology Function",
        "technology-interaction": "Technology Interaction",
        "technology-event": "Technology Event",
        "technology-service": "Technology Service",
        "artifact": "Artifact",
        "communication-network": "Communication Network",
        "path": "Path",
        "material": "Material",
        "facility": "Facility",
        "equipment": "Equipment",
        "distribution-network": "Distribution Network",
        "resource": "Resource",
        "capability": "Capability",
        "course-of-action": "Course of Action",
        "value-stream": "Value Stream",
        "stakeholder": "Stakeholder",
        "driver": "Driver",
        "assessment": "Assessment",
        "goal": "Goal",
        "outcome": "Outcome",
        "principle": "Principle",
        "requirement": "Requirement",
        "constraint": "Constraint",
        "meaning": "Meaning",
        "value": "Value",
        "location": "Location",
        "grouping": "Grouping",
        "gap": "Gap",
        "plateau": "Plateau",
        "deliverable": "Deliverable",
        "implementation-event": "Implementation Event",
        "work-package": "Work Package"
    };

    // =========================================================================
    // ArchiMate layer classification
    // =========================================================================

    var LAYER_MAP = {
        // Strategy
        "resource": "Strategy", "capability": "Strategy",
        "course-of-action": "Strategy", "value-stream": "Strategy",
        // Business
        "business-actor": "Business", "business-role": "Business",
        "business-collaboration": "Business", "business-interface": "Business",
        "business-process": "Business", "business-function": "Business",
        "business-interaction": "Business", "business-event": "Business",
        "business-service": "Business", "business-object": "Business",
        "contract": "Business", "representation": "Business", "product": "Business",
        // Application
        "application-component": "Application", "application-collaboration": "Application",
        "application-interface": "Application", "application-function": "Application",
        "application-interaction": "Application", "application-process": "Application",
        "application-event": "Application", "application-service": "Application",
        "data-object": "Application",
        // Technology
        "node": "Technology", "device": "Technology", "system-software": "Technology",
        "technology-collaboration": "Technology", "technology-interface": "Technology",
        "technology-process": "Technology", "technology-function": "Technology",
        "technology-interaction": "Technology", "technology-event": "Technology",
        "technology-service": "Technology", "artifact": "Technology",
        "communication-network": "Technology", "path": "Technology",
        "material": "Technology", "facility": "Technology", "equipment": "Technology",
        "distribution-network": "Technology",
        // Motivation
        "stakeholder": "Motivation", "driver": "Motivation", "assessment": "Motivation",
        "goal": "Motivation", "outcome": "Motivation", "principle": "Motivation",
        "requirement": "Motivation", "constraint": "Motivation",
        "meaning": "Motivation", "value": "Motivation",
        // Implementation & Migration
        "gap": "Implementation & Migration", "plateau": "Implementation & Migration",
        "deliverable": "Implementation & Migration",
        "implementation-event": "Implementation & Migration",
        "work-package": "Implementation & Migration",
        // Other
        "location": "Other", "grouping": "Other"
    };

    var LAYER_ORDER = [
        "Strategy", "Business", "Application", "Technology",
        "Motivation", "Implementation & Migration", "Other"
    ];

    // =========================================================================
    // Helpers
    // =========================================================================

    /**
     * Get filtered elements from the model based on filter configuration.
     * @param {Object} filter - Element filter: { types: string[], scope: "model"|"view" }
     * @param {Object} [activeView] - The active view (used when scope is "view")
     * @returns {Array} Array of jArchi element proxies
     */
    function getFilteredElements(filter, activeView) {
        var elements = [];
        var types = filter.types || [];
        var scope = filter.scope || "model";

        // jArchi's $() does NOT support comma-separated type selectors.
        // Query each type individually and combine with .add().
        var collection;
        if (types.length === 1) {
            collection = $(types[0]);
        } else if (types.length > 1) {
            collection = $(types[0]);
            for (var t = 1; t < types.length; t++) {
                collection = collection.add($(types[t]));
            }
        } else {
            collection = $("element");
        }

        if (scope === "view" && activeView) {
            // Get elements that appear on the current view
            var viewElementIds = {};
            $(activeView).find("element").each(function (el) {
                var concept = el.concept || el;
                viewElementIds[concept.id] = true;
            });

            collection.each(function (el) {
                if (viewElementIds[el.id]) {
                    elements.push(el);
                }
            });
        } else {
            collection.each(function (el) {
                elements.push(el);
            });
        }

        return elements;
    }

    /**
     * Apply a color palette to data arrays.
     * For single-dataset charts, applies per-data-point colors.
     * For multi-dataset charts, applies per-dataset colors.
     * @param {Object} chartData - Chart.js data object
     * @param {string[]} palette - Array of color strings
     * @param {string} chartType - Chart type (bar, doughnut, radar, etc.)
     * @param {string[]} [borderPalette] - Optional separate border palette
     */
    function applyPalette(chartData, palette, chartType, borderPalette) {
        if (!palette || palette.length === 0) return;
        if (!chartData.datasets) return;

        var perPoint = (chartType === "pie" || chartType === "doughnut" ||
            chartType === "polarArea" ||
            (chartType === "bar" && chartData.datasets.length === 1));

        for (var i = 0; i < chartData.datasets.length; i++) {
            var ds = chartData.datasets[i];
            if (perPoint) {
                // Per-data-point colors
                var colors = [];
                var bColors = [];
                var count = (ds.data || []).length;
                for (var j = 0; j < count; j++) {
                    colors.push(palette[j % palette.length]);
                    bColors.push(borderPalette ? borderPalette[j % borderPalette.length] : palette[j % palette.length]);
                }
                ds.backgroundColor = colors;
                ds.borderColor = bColors;
                ds.borderWidth = 1;
            } else {
                // Per-dataset colors — use palette directly (may already include rgba)
                var fillColor = palette[i % palette.length];
                var strokeColor = borderPalette
                    ? borderPalette[i % borderPalette.length]
                    : (fillColor.indexOf("rgba") === 0 ? fillColor : fillColor);
                ds.backgroundColor = fillColor;
                ds.borderColor = strokeColor;
                ds.borderWidth = 2;
            }
        }
    }

    /**
     * Convert hex color to rgba string.
     */
    function hexToRgba(hex, alpha) {
        hex = hex.replace("#", "");
        var r = parseInt(hex.substring(0, 2), 16);
        var g = parseInt(hex.substring(2, 4), 16);
        var b = parseInt(hex.substring(4, 6), 16);
        return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
    }

    // =========================================================================
    // Collection methods
    // =========================================================================

    /**
     * Count elements grouped by a property value.
     * @param {Object} dataSource - Data source configuration
     * @param {Object} [activeView] - Active view for scope filtering
     * @returns {Object} Chart.js data: { labels, datasets }
     */
    function propertyDistribution(dataSource, activeView) {
        var elements = getFilteredElements(dataSource.elementFilter, activeView);
        var property = dataSource.groupByProperty;
        var valueLabels = dataSource.valueLabels || {};
        var sortOrder = dataSource.sortOrder || [];
        var includeUnset = dataSource.includeUnset !== false;
        var unsetLabel = dataSource.unsetLabel || "(not set)";

        // Count occurrences
        var counts = {};
        var rawValues = {};
        for (var i = 0; i < elements.length; i++) {
            var val = elements[i].prop(property);
            if (val === null || val === undefined || val === "") {
                if (includeUnset) {
                    counts[unsetLabel] = (counts[unsetLabel] || 0) + 1;
                    rawValues[unsetLabel] = "";
                }
            } else {
                var label = valueLabels[val] || val;
                counts[label] = (counts[label] || 0) + 1;
                rawValues[label] = val;
            }
        }

        // Build ordered labels
        var labels = [];
        if (sortOrder.length > 0) {
            for (var s = 0; s < sortOrder.length; s++) {
                var sortLabel = valueLabels[sortOrder[s]] || sortOrder[s];
                if (counts[sortLabel] !== undefined) {
                    labels.push(sortLabel);
                }
            }
            // Add any labels not in sortOrder
            var allLabels = Object.keys(counts);
            for (var a = 0; a < allLabels.length; a++) {
                if (labels.indexOf(allLabels[a]) === -1) {
                    labels.push(allLabels[a]);
                }
            }
        } else {
            labels = Object.keys(counts);
        }

        // Build data array
        var data = [];
        for (var d = 0; d < labels.length; d++) {
            data.push(counts[labels[d]] || 0);
        }

        return {
            labels: labels,
            datasets: [{
                label: "Count",
                data: data
            }]
        };
    }

    /**
     * Count elements by ArchiMate type.
     * @param {Object} dataSource - Data source configuration
     * @param {Object} [activeView] - Active view for scope filtering
     * @returns {Object} Chart.js data: { labels, datasets }
     */
    function typeDistribution(dataSource, activeView) {
        var elements = getFilteredElements(dataSource.elementFilter, activeView);
        var minCount = dataSource.minCount || 1;
        var topN = dataSource.topN || 0; // 0 = no limit

        // Count by type
        var counts = {};
        for (var i = 0; i < elements.length; i++) {
            var type = elements[i].type;
            if (type) {
                counts[type] = (counts[type] || 0) + 1;
            }
        }

        // Filter by minCount and sort by count descending
        var entries = [];
        var types = Object.keys(counts);
        for (var t = 0; t < types.length; t++) {
            if (counts[types[t]] >= minCount) {
                entries.push({ type: types[t], count: counts[types[t]] });
            }
        }
        entries.sort(function (a, b) { return b.count - a.count; });

        // Apply topN limit — group remaining into "Other"
        var labels = [];
        var data = [];
        if (topN > 0 && entries.length > topN) {
            var otherCount = 0;
            for (var e = 0; e < entries.length; e++) {
                if (e < topN) {
                    labels.push(TYPE_DISPLAY_NAMES[entries[e].type] || entries[e].type);
                    data.push(entries[e].count);
                } else {
                    otherCount += entries[e].count;
                }
            }
            if (otherCount > 0) {
                labels.push("Other");
                data.push(otherCount);
            }
        } else {
            for (var f = 0; f < entries.length; f++) {
                labels.push(TYPE_DISPLAY_NAMES[entries[f].type] || entries[f].type);
                data.push(entries[f].count);
            }
        }

        return {
            labels: labels,
            datasets: [{
                label: "Elements",
                data: data
            }]
        };
    }

    /**
     * Count relationships per element, return top N.
     * @param {Object} dataSource - Data source configuration
     * @param {Object} [activeView] - Active view for scope filtering
     * @returns {Object} Chart.js data: { labels, datasets }
     */
    function relationshipCount(dataSource, activeView) {
        var elements = getFilteredElements(dataSource.elementFilter, activeView);
        var topN = dataSource.topN || 20;
        var direction = dataSource.direction || "both";

        var counts = {};
        for (var i = 0; i < elements.length; i++) {
            var el = elements[i];
            var count = 0;
            if (direction === "both" || direction === "outgoing") {
                count += $(el).outRels().size();
            }
            if (direction === "both" || direction === "incoming") {
                count += $(el).inRels().size();
            }
            if (count > 0) {
                counts[el.id] = { name: el.name || "(unnamed)", type: el.type, count: count };
            }
        }

        // Sort by count descending and take top N
        var entries = [];
        var ids = Object.keys(counts);
        for (var j = 0; j < ids.length; j++) {
            entries.push(counts[ids[j]]);
        }
        entries.sort(function (a, b) { return b.count - a.count; });
        entries = entries.slice(0, topN);

        var maxLabelLength = dataSource.maxLabelLength || 0; // 0 = no limit

        var labels = [];
        var data = [];
        for (var e = 0; e < entries.length; e++) {
            var displayType = TYPE_DISPLAY_NAMES[entries[e].type] || entries[e].type;
            var label = entries[e].name + " (" + displayType + ")";
            if (maxLabelLength > 0 && label.length > maxLabelLength) {
                label = label.substring(0, maxLabelLength - 1) + "\u2026";
            }
            labels.push(label);
            data.push(entries[e].count);
        }

        return {
            labels: labels,
            datasets: [{
                label: "Relationships",
                data: data
            }]
        };
    }

    /**
     * Create scatter/bubble data from element properties.
     * Each element becomes a point with x, y, and optional r (radius).
     * @param {Object} dataSource - Data source configuration
     * @param {Object} [activeView] - Active view for scope filtering
     * @returns {Object} Chart.js data: { datasets }
     */
    function propertyScatter(dataSource, activeView) {
        var elements = getFilteredElements(dataSource.elementFilter, activeView);
        var xProp = dataSource.xProperty;
        var yProp = dataSource.yProperty;
        var rProp = dataSource.rProperty;
        var rScale = dataSource.rScale || 1;
        var labelElements = dataSource.labelElements || false;

        if (labelElements) {
            // Create one dataset per element so each appears in the legend
            var datasets = [];
            for (var i = 0; i < elements.length; i++) {
                var el = elements[i];
                var xVal = parseFloat(el.prop(xProp));
                var yVal = parseFloat(el.prop(yProp));

                if (isNaN(xVal) || isNaN(yVal)) continue;

                var point = { x: xVal, y: yVal };
                if (rProp) {
                    var rVal = parseFloat(el.prop(rProp));
                    if (!isNaN(rVal)) {
                        point.r = Math.max(5, Math.sqrt(rVal) * rScale);
                    } else {
                        point.r = 8;
                    }
                }
                datasets.push({
                    label: el.name || "(unnamed)",
                    data: [point]
                });
            }
            return { datasets: datasets };
        }

        // Default: single dataset with all points
        var points = [];
        for (var j = 0; j < elements.length; j++) {
            var el2 = elements[j];
            var xv = parseFloat(el2.prop(xProp));
            var yv = parseFloat(el2.prop(yProp));

            if (isNaN(xv) || isNaN(yv)) continue;

            var pt = { x: xv, y: yv };
            if (rProp) {
                var rv = parseFloat(el2.prop(rProp));
                if (!isNaN(rv)) {
                    pt.r = Math.max(3, Math.sqrt(rv) * rScale);
                } else {
                    pt.r = 5;
                }
            }
            points.push(pt);
        }

        return {
            datasets: [{
                label: "Applications",
                data: points
            }]
        };
    }

    /**
     * Create radar chart data from element properties.
     * Each element becomes a label (axis), each dataset is a property.
     * @param {Object} dataSource - Data source configuration
     * @param {Object} [activeView] - Active view for scope filtering
     * @returns {Object} Chart.js data: { labels, datasets }
     */
    function propertyRadar(dataSource, activeView) {
        var elements = getFilteredElements(dataSource.elementFilter, activeView);
        var datasetDefs = dataSource.datasets || [];
        var skipGenericNames = dataSource.skipGenericNames || false;

        // Optionally filter out elements whose name matches their type display name
        // (e.g., a capability simply named "Capability" is a placeholder)
        if (skipGenericNames) {
            var filtered = [];
            for (var f = 0; f < elements.length; f++) {
                var el = elements[f];
                var elName = (el.name || "").trim().toLowerCase();
                var typeName = (TYPE_DISPLAY_NAMES[el.type] || el.type || "").toLowerCase();
                if (elName && elName !== typeName && elName !== "(unnamed)") {
                    filtered.push(el);
                }
            }
            elements = filtered;
        }

        var labels = [];
        var datasets = [];

        // Use element names as labels
        for (var i = 0; i < elements.length; i++) {
            labels.push(elements[i].name || "(unnamed)");
        }

        // Create a dataset per property definition
        for (var d = 0; d < datasetDefs.length; d++) {
            var def = datasetDefs[d];
            var data = [];
            for (var j = 0; j < elements.length; j++) {
                var val = parseFloat(elements[j].prop(def.property));
                data.push(isNaN(val) ? 0 : val);
            }
            datasets.push({
                label: def.label || def.property,
                data: data,
                fill: def.fill !== false
            });
        }

        return {
            labels: labels,
            datasets: datasets
        };
    }

    /**
     * Count elements grouped by ArchiMate layer.
     * @param {Object} dataSource - Data source configuration
     * @param {Object} [activeView] - Active view for scope filtering
     * @returns {Object} Chart.js data: { labels, datasets }
     */
    function layerDistribution(dataSource, activeView) {
        var elements = getFilteredElements(dataSource.elementFilter, activeView);

        // Count by layer
        var counts = {};
        for (var i = 0; i < elements.length; i++) {
            var layer = LAYER_MAP[elements[i].type] || "Other";
            counts[layer] = (counts[layer] || 0) + 1;
        }

        // Build labels in LAYER_ORDER, omitting layers with zero elements
        var labels = [];
        var data = [];
        for (var o = 0; o < LAYER_ORDER.length; o++) {
            if (counts[LAYER_ORDER[o]]) {
                labels.push(LAYER_ORDER[o]);
                data.push(counts[LAYER_ORDER[o]]);
            }
        }

        return {
            labels: labels,
            datasets: [{
                label: "Elements",
                data: data
            }]
        };
    }

    /**
     * Cross-tabulate elements by two properties (group by A, segment by B).
     * Returns multi-dataset data suitable for stacked/grouped bars or multi-series lines.
     * @param {Object} dataSource - Data source configuration
     * @param {Object} [activeView] - Active view for scope filtering
     * @returns {Object} Chart.js data: { labels, datasets }
     */
    function propertyCrossTab(dataSource, activeView) {
        var elements = getFilteredElements(dataSource.elementFilter, activeView);
        var groupProp = dataSource.groupByProperty;
        var segProp = dataSource.segmentByProperty;
        var segLabels = dataSource.segmentLabels || {};
        var segOrder = dataSource.segmentOrder || [];
        var includeUnset = dataSource.includeUnset !== false;
        var unsetLabel = dataSource.unsetLabel || "(not set)";

        // Collect all group keys and segment keys, counting occurrences
        var groupKeys = {};
        var segKeys = {};
        var matrix = {}; // matrix[group][segment] = count

        for (var i = 0; i < elements.length; i++) {
            var gVal = elements[i].prop(groupProp);
            var sVal = elements[i].prop(segProp);
            if ((gVal === null || gVal === undefined || gVal === "") && !includeUnset) continue;
            if ((sVal === null || sVal === undefined || sVal === "") && !includeUnset) continue;

            var gKey = (gVal === null || gVal === undefined || gVal === "") ? unsetLabel : gVal;
            var sKey = (sVal === null || sVal === undefined || sVal === "") ? unsetLabel : sVal;

            groupKeys[gKey] = true;
            segKeys[sKey] = true;
            if (!matrix[gKey]) matrix[gKey] = {};
            matrix[gKey][sKey] = (matrix[gKey][sKey] || 0) + 1;
        }

        // Order group labels alphabetically
        var labels = Object.keys(groupKeys).sort();

        // Order segment keys: use segOrder if provided, otherwise alphabetical
        var orderedSegs = [];
        if (segOrder.length > 0) {
            for (var s = 0; s < segOrder.length; s++) {
                if (segKeys[segOrder[s]]) orderedSegs.push(segOrder[s]);
            }
            var allSegs = Object.keys(segKeys).sort();
            for (var a = 0; a < allSegs.length; a++) {
                if (orderedSegs.indexOf(allSegs[a]) === -1) orderedSegs.push(allSegs[a]);
            }
        } else {
            orderedSegs = Object.keys(segKeys).sort();
        }

        // Build datasets: one per segment value
        var datasets = [];
        for (var d = 0; d < orderedSegs.length; d++) {
            var segKey = orderedSegs[d];
            var data = [];
            for (var l = 0; l < labels.length; l++) {
                data.push((matrix[labels[l]] && matrix[labels[l]][segKey]) || 0);
            }
            datasets.push({
                label: segLabels[segKey] || segKey,
                data: data
            });
        }

        return {
            labels: labels,
            datasets: datasets
        };
    }

    /**
     * Count how many views each element appears on, return top N.
     * @param {Object} dataSource - Data source configuration
     * @param {Object} [activeView] - Active view for scope filtering
     * @returns {Object} Chart.js data: { labels, datasets }
     */
    function viewCoverage(dataSource, activeView) {
        var elements = getFilteredElements(dataSource.elementFilter, activeView);
        var topN = dataSource.topN || 20;
        var maxLabelLength = dataSource.maxLabelLength || 0;

        var entries = [];
        for (var i = 0; i < elements.length; i++) {
            var el = elements[i];
            var viewCount = $(el).viewRefs().size();
            if (viewCount > 0) {
                entries.push({ name: el.name || "(unnamed)", type: el.type, count: viewCount });
            }
        }

        // Sort descending and take top N
        entries.sort(function (a, b) { return b.count - a.count; });
        entries = entries.slice(0, topN);

        var labels = [];
        var data = [];
        for (var e = 0; e < entries.length; e++) {
            var displayType = TYPE_DISPLAY_NAMES[entries[e].type] || entries[e].type;
            var label = entries[e].name + " (" + displayType + ")";
            if (maxLabelLength > 0 && label.length > maxLabelLength) {
                label = label.substring(0, maxLabelLength - 1) + "\u2026";
            }
            labels.push(label);
            data.push(entries[e].count);
        }

        return {
            labels: labels,
            datasets: [{
                label: "Views",
                data: data
            }]
        };
    }

    // =========================================================================
    // Dispatcher
    // =========================================================================

    var METHODS = {
        "property-distribution": propertyDistribution,
        "type-distribution": typeDistribution,
        "relationship-count": relationshipCount,
        "property-scatter": propertyScatter,
        "property-radar": propertyRadar,
        "layer-distribution": layerDistribution,
        "property-cross-tab": propertyCrossTab,
        "view-coverage": viewCoverage
    };

    /**
     * Collect data for a chart definition.
     * @param {Object} definition - Chart definition with dataSource
     * @param {Object} [activeView] - Active view for scope filtering
     * @returns {Object} Chart.js compatible data object with colors applied
     */
    function collectData(definition, activeView) {
        var method = definition.dataSource.method;
        var collector = METHODS[method];
        if (!collector) {
            throw new Error("Unknown data collection method: " + method);
        }

        var data = collector(definition.dataSource, activeView);

        // Apply color palette (with optional separate border palette)
        applyPalette(data, definition.colorPalette, definition.type, definition.colorPaletteBorder);

        return data;
    }

    // =========================================================================
    // Export
    // =========================================================================

    var chartDataCollectors = {
        collectData: collectData,
        propertyDistribution: propertyDistribution,
        typeDistribution: typeDistribution,
        relationshipCount: relationshipCount,
        propertyScatter: propertyScatter,
        propertyRadar: propertyRadar,
        layerDistribution: layerDistribution,
        propertyCrossTab: propertyCrossTab,
        viewCoverage: viewCoverage,
        getFilteredElements: getFilteredElements
    };

    if (typeof globalThis !== "undefined") globalThis.chartDataCollectors = chartDataCollectors;
    if (typeof module !== "undefined" && module.exports) module.exports = chartDataCollectors;

})();
