/**
 * @module chartDefinitions
 * @description Template data layer for chart definitions. Provides 12 built-in
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

    var PALETTE_LAYER = [
        "#D4A017", "#EDC948", "#4E79A7", "#59A14F",
        "#B07AA1", "#FF9DA7", "#BAB0AC"
    ];

    var PALETTE_DIVERGING = [
        "#2166AC", "#4393C3", "#92C5DE", "#D1E5F0", "#F7F7F7",
        "#FDDBC7", "#F4A582", "#D6604D", "#B2182B"
    ];

    // =========================================================================
    // Shared chart option fragments
    // =========================================================================

    var FONT_TITLE = { size: 20, weight: "bold" };
    var FONT_AXIS_TITLE = { size: 14 };
    var FONT_TICK = { size: 13 };
    var FONT_LEGEND = { size: 13 };
    var LAYOUT_PADDING = { top: 8, right: 16, bottom: 8, left: 8 };

    // =========================================================================
    // Visual settings defaults
    // =========================================================================

    var DEFAULT_VISUAL_SETTINGS = {
        fontFamily: "SansSerif",
        titleFontSize: FONT_TITLE.size,   // 20
        labelFontSize: FONT_TICK.size,    // 13
        showTitle: true,
        showLegend: null                  // null = use template default
    };

    /** Integer-only count axis config */
    function countAxis(axisTitle) {
        return {
            beginAtZero: true,
            title: { display: true, text: axisTitle, font: FONT_AXIS_TITLE },
            ticks: { font: FONT_TICK, precision: 0 }
        };
    }

    /** Stacked bar chart options with titles and legend */
    function stackedBarOptions(xTitle, yTitle) {
        return {
            layout: { padding: LAYOUT_PADDING },
            plugins: {
                title: { display: true, text: "", font: FONT_TITLE },
                legend: { display: true, position: "top", labels: { font: FONT_LEGEND, usePointStyle: true } }
            },
            scales: {
                x: {
                    stacked: true,
                    title: { display: !!xTitle, text: xTitle || "", font: FONT_AXIS_TITLE },
                    ticks: { font: FONT_TICK }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    title: { display: !!yTitle, text: yTitle || "", font: FONT_AXIS_TITLE },
                    ticks: { font: FONT_TICK, precision: 0 }
                }
            }
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
        },
        {
            id: "architecture-layer-balance",
            name: "Architecture Layer Balance",
            description: "Polar area chart showing the distribution of model elements across ArchiMate layers (Strategy, Business, Application, Technology, Motivation, Implementation & Migration). No custom properties required.",
            propertiesCreated: [],
            chartConfig: {
                version: "1.0.0",
                templateId: "architecture-layer-balance",
                type: "polarArea",
                title: "Architecture Layer Balance",
                width: 700,
                height: 550,
                backgroundColor: "#FFFFFF",
                dataSource: {
                    method: "layer-distribution",
                    elementFilter: { types: [], scope: "model" }
                },
                chartOptions: {
                    layout: { padding: { top: 8, right: 8, bottom: 8, left: 8 } },
                    plugins: {
                        title: { display: true, text: "Architecture Layer Balance", font: FONT_TITLE },
                        legend: {
                            display: true,
                            position: "right",
                            labels: { font: FONT_LEGEND, padding: 10, boxWidth: 14 }
                        }
                    },
                    scales: {
                        r: {
                            beginAtZero: true,
                            ticks: { font: FONT_TICK, backdropColor: "rgba(255,255,255,0.75)", precision: 0 }
                        }
                    }
                },
                colorPalette: PALETTE_LAYER
            }
        },
        {
            id: "lifecycle-by-category",
            name: "Lifecycle by Category",
            description: "Stacked bar chart cross-tabulating elements by department and lifecycle status. Requires 'department' and 'lifecycle-status' properties on application-component elements.",
            propertiesCreated: [
                {
                    name: "department",
                    targetTypes: ["application-component"],
                    defaultValue: "IT",
                    description: "Owning department"
                },
                {
                    name: "lifecycle-status",
                    targetTypes: ["application-component"],
                    defaultValue: "current",
                    description: "Lifecycle status"
                }
            ],
            chartConfig: (function () {
                var opts = stackedBarOptions("Department", "Count");
                opts.plugins.title.text = "Lifecycle by Category";
                return {
                    version: "1.0.0",
                    templateId: "lifecycle-by-category",
                    type: "bar",
                    title: "Lifecycle by Category",
                    width: 750,
                    height: 480,
                    backgroundColor: "#FFFFFF",
                    dataSource: {
                        method: "property-cross-tab",
                        elementFilter: { types: ["application-component"], scope: "model" },
                        groupByProperty: "department",
                        segmentByProperty: "lifecycle-status",
                        segmentOrder: ["emerging", "current", "sunset", "retired"],
                        includeUnset: true,
                        unsetLabel: "(not set)"
                    },
                    chartOptions: opts,
                    colorPalette: PALETTE_LIFECYCLE
                };
            })()
        },
        {
            id: "maturity-trend",
            name: "Maturity Trend",
            description: "Line chart comparing current vs target maturity levels across capabilities. Same data as the Capability Maturity radar but rendered as a line chart. Requires 'maturity-current' and 'maturity-target' properties on capability elements.",
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
                templateId: "maturity-trend",
                type: "line",
                title: "Maturity Trend",
                width: 800,
                height: 480,
                backgroundColor: "#FFFFFF",
                dataSource: {
                    method: "property-radar",
                    elementFilter: { types: ["capability"], scope: "model" },
                    datasets: [
                        { property: "maturity-current", label: "Current", fill: false },
                        { property: "maturity-target", label: "Target", fill: false }
                    ],
                    skipGenericNames: true
                },
                chartOptions: {
                    layout: { padding: LAYOUT_PADDING },
                    plugins: {
                        title: { display: true, text: "Maturity Trend", font: FONT_TITLE },
                        legend: { display: true, position: "top", labels: { font: FONT_LEGEND, usePointStyle: true } }
                    },
                    scales: {
                        x: {
                            title: { display: true, text: "Capability", font: FONT_AXIS_TITLE },
                            ticks: { font: FONT_TICK }
                        },
                        y: {
                            min: 0, max: 5,
                            title: { display: true, text: "Maturity Level", font: FONT_AXIS_TITLE },
                            ticks: { font: FONT_TICK, stepSize: 1 }
                        }
                    }
                },
                colorPalette: PALETTE_DUAL,
                colorPaletteBorder: PALETTE_DUAL_BORDER
            }
        },
        {
            id: "risk-assessment-matrix",
            name: "Risk Assessment Matrix",
            description: "Scatter chart plotting elements by risk impact (x) and risk likelihood (y) to form a risk quadrant. Requires 'risk-impact' and 'risk-likelihood' properties on application-component elements.",
            propertiesCreated: [
                {
                    name: "risk-impact",
                    targetTypes: ["application-component"],
                    defaultValue: "3",
                    description: "Risk impact rating (1-5)"
                },
                {
                    name: "risk-likelihood",
                    targetTypes: ["application-component"],
                    defaultValue: "3",
                    description: "Risk likelihood rating (1-5)"
                }
            ],
            chartConfig: {
                version: "1.0.0",
                templateId: "risk-assessment-matrix",
                type: "scatter",
                title: "Risk Assessment Matrix",
                width: 700,
                height: 550,
                backgroundColor: "#FFFFFF",
                dataSource: {
                    method: "property-scatter",
                    elementFilter: { types: ["application-component"], scope: "model" },
                    xProperty: "risk-impact",
                    yProperty: "risk-likelihood",
                    labelElements: true
                },
                chartOptions: {
                    layout: { padding: LAYOUT_PADDING },
                    plugins: {
                        title: { display: true, text: "Risk Assessment Matrix", font: FONT_TITLE },
                        legend: { display: true, position: "bottom", labels: { font: FONT_LEGEND, usePointStyle: true } }
                    },
                    elements: { point: { radius: 8, hoverRadius: 10 } },
                    scales: {
                        x: {
                            min: 0, max: 6,
                            title: { display: true, text: "Impact", font: FONT_AXIS_TITLE },
                            ticks: { font: FONT_TICK, stepSize: 1 }
                        },
                        y: {
                            min: 0, max: 6,
                            title: { display: true, text: "Likelihood", font: FONT_AXIS_TITLE },
                            ticks: { font: FONT_TICK, stepSize: 1 }
                        }
                    }
                },
                colorPalette: PALETTE_CATEGORICAL
            }
        },
        {
            id: "view-coverage",
            name: "View Coverage",
            description: "Horizontal bar chart showing the top 20 elements ranked by the number of views they appear on. No custom properties required — uses viewRefs() to count views per element.",
            propertiesCreated: [],
            chartConfig: {
                version: "1.0.0",
                templateId: "view-coverage",
                type: "bar",
                title: "View Coverage",
                width: 800,
                height: 550,
                backgroundColor: "#FFFFFF",
                dataSource: {
                    method: "view-coverage",
                    elementFilter: { types: [], scope: "model" },
                    topN: 20,
                    maxLabelLength: 35
                },
                chartOptions: {
                    indexAxis: "y",
                    layout: { padding: LAYOUT_PADDING },
                    plugins: {
                        title: { display: true, text: "View Coverage (Top 20)", font: FONT_TITLE },
                        legend: { display: false }
                    },
                    scales: {
                        x: countAxis("Views"),
                        y: { ticks: { font: { size: 12 } } }
                    }
                },
                colorPalette: PALETTE_CATEGORICAL
            }
        },
        {
            id: "technology-stack-composition",
            name: "Technology Stack Composition",
            description: "Stacked bar chart cross-tabulating technology elements by category and lifecycle status. Requires 'technology-category' and 'lifecycle-status' properties on technology elements.",
            propertiesCreated: [
                {
                    name: "technology-category",
                    targetTypes: TECHNOLOGY_TYPES,
                    defaultValue: "Infrastructure",
                    description: "Technology category"
                },
                {
                    name: "lifecycle-status",
                    targetTypes: TECHNOLOGY_TYPES,
                    defaultValue: "current",
                    description: "Lifecycle status"
                }
            ],
            chartConfig: (function () {
                var opts = stackedBarOptions("Technology Category", "Count");
                opts.plugins.title.text = "Technology Stack Composition";
                return {
                    version: "1.0.0",
                    templateId: "technology-stack-composition",
                    type: "bar",
                    title: "Technology Stack Composition",
                    width: 800,
                    height: 500,
                    backgroundColor: "#FFFFFF",
                    dataSource: {
                        method: "property-cross-tab",
                        elementFilter: { types: TECHNOLOGY_TYPES, scope: "model" },
                        groupByProperty: "technology-category",
                        segmentByProperty: "lifecycle-status",
                        segmentOrder: ["emerging", "current", "sunset", "retired"],
                        includeUnset: true,
                        unsetLabel: "(not set)"
                    },
                    chartOptions: opts,
                    colorPalette: PALETTE_LIFECYCLE
                };
            })()
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

    /**
     * Walk the chartOptions tree and apply visual overrides.
     * Mutates chartOptions in place.
     *
     * @param {Object} chartOptions - Chart.js options object from a definition
     * @param {Object} vs - Visual settings: { fontFamily, titleFontSize, labelFontSize, showTitle, showLegend }
     */
    function applyVisualSettings(chartOptions, vs) {
        if (!chartOptions || !vs) return;

        // Walk tree looking for font objects and apply family + size overrides
        function walkFonts(obj, path) {
            if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;
            var keys = Object.keys(obj);
            for (var k = 0; k < keys.length; k++) {
                var key = keys[k];
                var childPath = path ? path + "." + key : key;
                if (key === "font" && typeof obj[key] === "object" && obj[key] !== null) {
                    // Apply font family
                    if (vs.fontFamily) {
                        obj[key].family = vs.fontFamily;
                    }
                    // Apply font size: title gets titleFontSize, everything else gets labelFontSize
                    var isTitle = childPath === "plugins.title.font";
                    if (isTitle && typeof vs.titleFontSize === "number") {
                        obj[key].size = vs.titleFontSize;
                    } else if (!isTitle && typeof vs.labelFontSize === "number") {
                        obj[key].size = vs.labelFontSize;
                    }
                } else {
                    walkFonts(obj[key], childPath);
                }
            }
        }
        walkFonts(chartOptions, "");

        // Title visibility
        if (typeof vs.showTitle === "boolean") {
            if (chartOptions.plugins && chartOptions.plugins.title) {
                chartOptions.plugins.title.display = vs.showTitle;
            }
        }

        // Legend visibility
        if (typeof vs.showLegend === "boolean") {
            if (chartOptions.plugins && chartOptions.plugins.legend) {
                chartOptions.plugins.legend.display = vs.showLegend;
            }
        }
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

        // Apply visual settings overrides
        if (overrides.visualSettings) {
            definition.visualSettings = deepCopy(overrides.visualSettings);
            applyVisualSettings(definition.chartOptions, overrides.visualSettings);
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
        createDefinition: createDefinition,
        applyVisualSettings: applyVisualSettings,
        DEFAULT_VISUAL_SETTINGS: DEFAULT_VISUAL_SETTINGS
    };

    if (typeof globalThis !== "undefined") globalThis.chartDefinitions = chartDefinitions;
    if (typeof module !== "undefined" && module.exports) module.exports = chartDefinitions;

})();
