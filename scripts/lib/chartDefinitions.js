/**
 * @module chartDefinitions
 * @description Template data layer for chart definitions. Provides 6 built-in
 * EA-relevant chart templates plus JSON file persistence for user modifications.
 * Each template defines the chart type, data source configuration, and which
 * model properties to create/query.
 * @version 1.1.0
 */
(function () {
    "use strict";

    if (typeof globalThis !== "undefined" && typeof globalThis.chartDefinitions !== "undefined") return;

    var Files = Java.type("java.nio.file.Files");
    var Paths = Java.type("java.nio.file.Paths");
    var JString = Java.type("java.lang.String");
    var StandardOpenOption = Java.type("java.nio.file.StandardOpenOption");

    // =========================================================================
    // Default color palettes
    // =========================================================================

    var PALETTE_CATEGORICAL = [
        "#4E79A7", "#F28E2B", "#E15759", "#76B7B2",
        "#59A14F", "#EDC948", "#B07AA1", "#FF9DA7",
        "#9C755F", "#BAB0AC"
    ];

    var PALETTE_SEVERITY = ["#59A14F", "#EDC948", "#F28E2B", "#E15759", "#BAB0AC"];
    var PALETTE_LIFECYCLE = ["#76B7B2", "#4E79A7", "#F28E2B", "#E15759", "#BAB0AC"];
    var PALETTE_DUAL = ["rgba(78,121,167,0.35)", "rgba(225,87,89,0.35)"];
    var PALETTE_DUAL_BORDER = ["#4E79A7", "#E15759"];

    // =========================================================================
    // Shared chart option fragments
    // =========================================================================

    var FONT_TITLE = { size: 20, weight: "bold" };
    var FONT_AXIS_TITLE = { size: 14 };
    var FONT_TICK = { size: 13 };
    var FONT_LEGEND = { size: 13 };
    var LAYOUT_PADDING = { top: 8, right: 16, bottom: 8, left: 8 };

    /** Integer-only count axis config */
    function countAxis(axisTitle) {
        return {
            beginAtZero: true,
            title: { display: true, text: axisTitle, font: FONT_AXIS_TITLE },
            ticks: { font: FONT_TICK, precision: 0 }
        };
    }

    // =========================================================================
    // Technology layer element types
    // =========================================================================

    var TECHNOLOGY_TYPES = [
        "node", "device", "system-software", "technology-service",
        "artifact", "technology-collaboration", "technology-interface",
        "technology-process", "technology-function", "technology-interaction",
        "technology-event", "path", "communication-network"
    ];

    // =========================================================================
    // Built-in templates
    // =========================================================================

    var BUILT_IN_TEMPLATES = [
        {
            id: "technical-debt-distribution",
            name: "Technical Debt Distribution",
            description: "Bar chart showing the distribution of technical debt levels across application components. Requires 'technical-debt' property on application-component elements.",
            propertiesCreated: [
                {
                    name: "technical-debt",
                    targetTypes: ["application-component"],
                    defaultValue: "low",
                    description: "Technical debt level"
                }
            ],
            chartConfig: {
                version: "1.0.0",
                templateId: "technical-debt-distribution",
                type: "bar",
                title: "Technical Debt Distribution",
                width: 700,
                height: 450,
                backgroundColor: "#FFFFFF",
                dataSource: {
                    method: "property-distribution",
                    elementFilter: { types: ["application-component"], scope: "model" },
                    groupByProperty: "technical-debt",
                    valueLabels: { low: "Low", medium: "Medium", high: "High", critical: "Critical" },
                    sortOrder: ["low", "medium", "high", "critical"],
                    includeUnset: true,
                    unsetLabel: "(not set)"
                },
                chartOptions: {
                    layout: { padding: LAYOUT_PADDING },
                    plugins: {
                        title: { display: true, text: "Technical Debt Distribution", font: FONT_TITLE },
                        legend: { display: false }
                    },
                    scales: {
                        x: { ticks: { font: FONT_TICK } },
                        y: countAxis("Count")
                    }
                },
                colorPalette: PALETTE_SEVERITY
            }
        },
        {
            id: "technology-lifecycle",
            name: "Technology Lifecycle",
            description: "Bar chart showing the lifecycle status distribution of technology layer elements. Requires 'lifecycle-status' property on technology elements.",
            propertiesCreated: [
                {
                    name: "lifecycle-status",
                    targetTypes: TECHNOLOGY_TYPES,
                    defaultValue: "current",
                    description: "Technology lifecycle status"
                }
            ],
            chartConfig: {
                version: "1.0.0",
                templateId: "technology-lifecycle",
                type: "bar",
                title: "Technology Lifecycle",
                width: 700,
                height: 450,
                backgroundColor: "#FFFFFF",
                dataSource: {
                    method: "property-distribution",
                    elementFilter: { types: TECHNOLOGY_TYPES, scope: "model" },
                    groupByProperty: "lifecycle-status",
                    valueLabels: { emerging: "Emerging", current: "Current", sunset: "Sunset", retired: "Retired" },
                    sortOrder: ["emerging", "current", "sunset", "retired"],
                    includeUnset: true,
                    unsetLabel: "(not set)"
                },
                chartOptions: {
                    layout: { padding: LAYOUT_PADDING },
                    plugins: {
                        title: { display: true, text: "Technology Lifecycle", font: FONT_TITLE },
                        legend: { display: false }
                    },
                    scales: {
                        x: { ticks: { font: FONT_TICK } },
                        y: countAxis("Count")
                    }
                },
                colorPalette: PALETTE_LIFECYCLE
            }
        },
        {
            id: "application-portfolio",
            name: "Application Portfolio",
            description: "Bubble chart plotting application components by business value (x), technical quality (y), and annual cost (bubble size). Requires 'business-value', 'technical-quality', and 'annual-cost' properties.",
            propertiesCreated: [
                {
                    name: "business-value",
                    targetTypes: ["application-component"],
                    defaultValue: "3",
                    description: "Business value rating (1-5)"
                },
                {
                    name: "technical-quality",
                    targetTypes: ["application-component"],
                    defaultValue: "3",
                    description: "Technical quality rating (1-5)"
                },
                {
                    name: "annual-cost",
                    targetTypes: ["application-component"],
                    defaultValue: "100",
                    description: "Annual cost (numeric, used for bubble size)"
                }
            ],
            chartConfig: {
                version: "1.0.0",
                templateId: "application-portfolio",
                type: "bubble",
                title: "Application Portfolio",
                width: 800,
                height: 550,
                backgroundColor: "#FFFFFF",
                dataSource: {
                    method: "property-scatter",
                    elementFilter: { types: ["application-component"], scope: "model" },
                    xProperty: "business-value",
                    yProperty: "technical-quality",
                    rProperty: "annual-cost",
                    rScale: 0.04,
                    labelElements: true
                },
                chartOptions: {
                    layout: { padding: LAYOUT_PADDING },
                    plugins: {
                        title: { display: true, text: "Application Portfolio", font: FONT_TITLE },
                        legend: { display: true, position: "bottom", labels: { font: FONT_LEGEND, usePointStyle: true } }
                    },
                    scales: {
                        x: {
                            min: 0, max: 6,
                            title: { display: true, text: "Business Value", font: FONT_AXIS_TITLE },
                            ticks: { font: FONT_TICK, stepSize: 1 }
                        },
                        y: {
                            min: 0, max: 6,
                            title: { display: true, text: "Technical Quality", font: FONT_AXIS_TITLE },
                            ticks: { font: FONT_TICK, stepSize: 1 }
                        }
                    }
                },
                colorPalette: PALETTE_CATEGORICAL
            }
        },
        {
            id: "capability-maturity",
            name: "Capability Maturity",
            description: "Radar chart comparing current vs target maturity levels across capabilities. Requires 'maturity-current' and 'maturity-target' properties on capability elements.",
            propertiesCreated: [
                {
                    name: "maturity-current",
                    targetTypes: ["capability"],
                    defaultValue: "2",
                    description: "Current maturity level (1-5)"
                },
                {
                    name: "maturity-target",
                    targetTypes: ["capability"],
                    defaultValue: "4",
                    description: "Target maturity level (1-5)"
                }
            ],
            chartConfig: {
                version: "1.0.0",
                templateId: "capability-maturity",
                type: "radar",
                title: "Capability Maturity",
                width: 700,
                height: 550,
                backgroundColor: "#FFFFFF",
                dataSource: {
                    method: "property-radar",
                    elementFilter: { types: ["capability"], scope: "model" },
                    datasets: [
                        { property: "maturity-current", label: "Current", fill: true },
                        { property: "maturity-target", label: "Target", fill: true }
                    ],
                    skipGenericNames: true
                },
                chartOptions: {
                    layout: { padding: { top: 8, right: 24, bottom: 8, left: 24 } },
                    plugins: {
                        title: { display: true, text: "Capability Maturity", font: FONT_TITLE },
                        legend: { display: true, position: "top", labels: { font: FONT_LEGEND, usePointStyle: true } }
                    },
                    scales: {
                        r: {
                            min: 0, max: 5,
                            ticks: { stepSize: 1, font: FONT_TICK, backdropColor: "rgba(255,255,255,0.75)" },
                            pointLabels: { font: { size: 13 } }
                        }
                    }
                },
                colorPalette: PALETTE_DUAL,
                colorPaletteBorder: PALETTE_DUAL_BORDER
            }
        },
        {
            id: "element-distribution",
            name: "Element Distribution",
            description: "Doughnut chart showing the distribution of model elements by ArchiMate type. No custom properties required — counts elements directly.",
            propertiesCreated: [],
            chartConfig: {
                version: "1.0.0",
                templateId: "element-distribution",
                type: "doughnut",
                title: "Element Distribution",
                width: 750,
                height: 500,
                backgroundColor: "#FFFFFF",
                dataSource: {
                    method: "type-distribution",
                    elementFilter: { types: [], scope: "model" },
                    minCount: 1,
                    topN: 12
                },
                chartOptions: {
                    layout: { padding: { top: 8, right: 8, bottom: 8, left: 8 } },
                    plugins: {
                        title: { display: true, text: "Element Distribution", font: FONT_TITLE },
                        legend: {
                            display: true,
                            position: "right",
                            labels: { font: FONT_LEGEND, padding: 10, boxWidth: 14 }
                        }
                    }
                },
                colorPalette: PALETTE_CATEGORICAL
            }
        },
        {
            id: "relationship-complexity",
            name: "Relationship Complexity",
            description: "Horizontal bar chart showing the top 15 elements by relationship count. No custom properties required — counts relationships per element.",
            propertiesCreated: [],
            chartConfig: {
                version: "1.0.0",
                templateId: "relationship-complexity",
                type: "bar",
                title: "Relationship Complexity",
                width: 800,
                height: 550,
                backgroundColor: "#FFFFFF",
                dataSource: {
                    method: "relationship-count",
                    elementFilter: { types: [], scope: "model" },
                    topN: 15,
                    direction: "both",
                    maxLabelLength: 35
                },
                chartOptions: {
                    indexAxis: "y",
                    layout: { padding: LAYOUT_PADDING },
                    plugins: {
                        title: { display: true, text: "Relationship Complexity (Top 15)", font: FONT_TITLE },
                        legend: { display: false }
                    },
                    scales: {
                        x: countAxis("Relationships"),
                        y: { ticks: { font: { size: 12 } } }
                    }
                },
                colorPalette: PALETTE_CATEGORICAL
            }
        }
    ];

    // =========================================================================
    // Helpers
    // =========================================================================

    function deepCopy(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function getStoragePath() {
        return Paths.get(__DIR__ + "data/chart-definitions.json");
    }

    // =========================================================================
    // Public API
    // =========================================================================

    function getBuiltInTemplates() {
        return deepCopy(BUILT_IN_TEMPLATES);
    }

    function getTemplate(templateId) {
        for (var i = 0; i < BUILT_IN_TEMPLATES.length; i++) {
            if (BUILT_IN_TEMPLATES[i].id === templateId) {
                return deepCopy(BUILT_IN_TEMPLATES[i]);
            }
        }
        var custom = loadCustomTemplates();
        for (var j = 0; j < custom.length; j++) {
            if (custom[j].id === templateId) {
                return deepCopy(custom[j]);
            }
        }
        return null;
    }

    function loadCustomTemplates() {
        try {
            var path = getStoragePath();
            if (Files.exists(path)) {
                var content = new JString(Files.readAllBytes(path), "UTF-8");
                var parsed = JSON.parse(content);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (e) {
            // Fall through to empty array
        }
        return [];
    }

    function saveCustomTemplates(templates) {
        var path = getStoragePath();
        var dir = path.getParent();
        if (!Files.exists(dir)) {
            Files.createDirectories(dir);
        }
        var json = JSON.stringify(templates, null, 2);
        var bytes = new JString(json).getBytes("UTF-8");
        Files.write(path, bytes, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
    }

    function getAllTemplates() {
        return deepCopy(BUILT_IN_TEMPLATES).concat(loadCustomTemplates());
    }

    function createDefinition(templateId, overrides) {
        var template = getTemplate(templateId);
        if (!template) throw new Error("Unknown chart template: " + templateId);

        var definition = deepCopy(template.chartConfig);
        overrides = overrides || {};

        if (overrides.title) definition.title = overrides.title;
        if (overrides.width) definition.width = overrides.width;
        if (overrides.height) definition.height = overrides.height;
        if (overrides.scope) definition.dataSource.elementFilter.scope = overrides.scope;
        if (overrides.backgroundColor) definition.backgroundColor = overrides.backgroundColor;

        if (definition.chartOptions && definition.chartOptions.plugins && definition.chartOptions.plugins.title) {
            definition.chartOptions.plugins.title.text = definition.title;
        }

        return definition;
    }

    // =========================================================================
    // Export
    // =========================================================================

    var chartDefinitions = {
        getBuiltInTemplates: getBuiltInTemplates,
        getTemplate: getTemplate,
        getAllTemplates: getAllTemplates,
        loadCustomTemplates: loadCustomTemplates,
        saveCustomTemplates: saveCustomTemplates,
        createDefinition: createDefinition
    };

    if (typeof globalThis !== "undefined") globalThis.chartDefinitions = chartDefinitions;
    if (typeof module !== "undefined" && module.exports) module.exports = chartDefinitions;

})();
