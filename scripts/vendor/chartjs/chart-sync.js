/**
 * chart-sync.js - Synchronous Chart.js wrapper for JArchi/GraalJS
 *
 * Loads Chart.js UMD bundle with a canvas shim backed by Java AWT,
 * providing server-side chart rendering to PNG files.
 *
 * Usage:
 *   load(__DIR__ + "vendor/chartjs/chart-sync.js");
 *
 *   var outputPath = chartSync.renderChart({
 *       type: "bar",
 *       data: {
 *           labels: ["A", "B", "C"],
 *           datasets: [{ label: "Values", data: [10, 20, 30] }]
 *       },
 *       options: {}
 *   }, 600, 400, "/tmp/chart.png");
 *
 * @module vendor/chartjs/chart-sync
 * @version 1.0.0
 */
(function () {
    "use strict";

    if (typeof globalThis !== "undefined" && typeof globalThis.chartSync !== "undefined") return;

    // --- Determine base directory ---
    var chartDir = typeof __DIR__ !== "undefined" ? __DIR__ : "";

    // --- Load canvas shim ---
    load(chartDir + "canvas-shim.js");

    var Canvas = canvasShim.Canvas;
    var CanvasGradient = canvasShim.CanvasGradient;
    var CanvasPattern = canvasShim.CanvasPattern;

    // --- Set globals Chart.js expects ---
    globalThis.CanvasGradient = CanvasGradient;
    globalThis.CanvasPattern = CanvasPattern;

    // --- Intl shim for Chart.js tick formatting ---
    // GraalJS in JArchi doesn't expose the Intl object. Chart.js uses
    // Intl.NumberFormat for numeric tick labels. This shim provides a
    // minimal implementation backed by Java's NumberFormat/DecimalFormat.
    var shimIntl = (function () {
        var JDecimalFormat = Java.type("java.text.DecimalFormat");
        var JDecimalFormatSymbols = Java.type("java.text.DecimalFormatSymbols");
        var JLocale = Java.type("java.util.Locale");

        function NumberFormat(locales, options) {
            options = options || {};
            this._style = options.style || "decimal";
            this._minimumFractionDigits = options.minimumFractionDigits;
            this._maximumFractionDigits = options.maximumFractionDigits;
            this._notation = options.notation || "standard";
            this._currency = options.currency || "USD";
            this._useGrouping = options.useGrouping !== false;

            // Resolve locale
            var locale = JLocale.US;
            if (locales) {
                var tag = Array.isArray(locales) ? locales[0] : String(locales);
                if (tag) {
                    try { locale = JLocale.forLanguageTag(tag); } catch (e) { /* keep US */ }
                }
            }

            var symbols = new JDecimalFormatSymbols(locale);

            if (this._style === "percent") {
                this._fmt = new JDecimalFormat("#,##0%", symbols);
            } else if (this._style === "currency") {
                this._fmt = new JDecimalFormat("\u00A4#,##0.00", symbols);
            } else if (this._notation === "compact") {
                // Simple compact: 1K, 1M, etc.
                this._compact = true;
                this._fmt = new JDecimalFormat("#,##0.##", symbols);
            } else {
                this._fmt = new JDecimalFormat("#,##0.##########", symbols);
            }

            if (!this._useGrouping) {
                this._fmt.setGroupingUsed(false);
            }

            if (typeof this._minimumFractionDigits === "number") {
                this._fmt.setMinimumFractionDigits(this._minimumFractionDigits);
            }
            if (typeof this._maximumFractionDigits === "number") {
                this._fmt.setMaximumFractionDigits(this._maximumFractionDigits);
            }
        }

        NumberFormat.prototype.format = function (value) {
            if (this._compact) {
                var abs = Math.abs(value);
                if (abs >= 1e9) return (value / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
                if (abs >= 1e6) return (value / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
                if (abs >= 1e3) return (value / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
            }
            return String(this._fmt.format(value));
        };

        NumberFormat.prototype.resolvedOptions = function () {
            return {
                style: this._style,
                minimumFractionDigits: this._minimumFractionDigits || 0,
                maximumFractionDigits: this._maximumFractionDigits || 10,
                notation: this._notation
            };
        };

        // Chart.js also checks for Intl.DateTimeFormat in some paths
        function DateTimeFormat(locales, options) {
            this._options = options || {};
            var locale = JLocale.US;
            if (locales) {
                var tag = Array.isArray(locales) ? locales[0] : String(locales);
                if (tag) {
                    try { locale = JLocale.forLanguageTag(tag); } catch (e) { /* keep US */ }
                }
            }
            this._locale = locale;
        }

        DateTimeFormat.prototype.format = function (date) {
            if (!(date instanceof Date)) date = new Date(date);
            return date.toLocaleDateString();
        };

        DateTimeFormat.prototype.resolvedOptions = function () {
            return this._options;
        };

        return {
            NumberFormat: NumberFormat,
            DateTimeFormat: DateTimeFormat
        };
    })();

    // --- Read Chart.js UMD bundle ---
    var Files = Java.type("java.nio.file.Files");
    var JPath = Java.type("java.nio.file.Paths");
    var JString = Java.type("java.lang.String");

    var chartFilePath = JPath.get(chartDir + "chart.umd.js");
    var chartCode = new JString(Files.readAllBytes(chartFilePath), "UTF-8");

    // --- Mock document for Chart.js ---
    var mockDocument = {
        createElement: function (tag) {
            if (tag === "canvas") {
                return new Canvas(300, 150);
            }
            // Return a minimal element stub for other tags
            return {
                style: {},
                setAttribute: function () {},
                getAttribute: function () { return null; },
                addEventListener: function () {},
                removeEventListener: function () {},
                appendChild: function () {},
                children: [],
                childNodes: [],
                parentNode: null
            };
        },
        createElementNS: function (ns, tag) {
            return this.createElement(tag);
        },
        getElementById: function () { return null; },
        getElementsByTagName: function () { return []; },
        querySelector: function () { return null; },
        querySelectorAll: function () { return []; },
        body: {
            style: {},
            appendChild: function () {},
            removeChild: function () {}
        },
        documentElement: { style: {} },
        readyState: "complete",
        addEventListener: function () {},
        removeEventListener: function () {}
    };

    // --- Mock window for Chart.js ---
    var mockWindow = {
        document: mockDocument,
        navigator: { userAgent: "GraalJS" },
        getComputedStyle: function () {
            return {
                getPropertyValue: function () { return ""; }
            };
        },
        addEventListener: function () {},
        removeEventListener: function () {},
        devicePixelRatio: 1,
        requestAnimationFrame: function (cb) { cb(0); return 0; },
        cancelAnimationFrame: function () {},
        setTimeout: function (fn) { fn(); return 0; },
        clearTimeout: function () {},
        CanvasGradient: CanvasGradient,
        CanvasPattern: CanvasPattern
    };

    // --- Inject Intl into mockWindow so Chart.js can find it ---
    mockWindow.Intl = shimIntl;

    // --- Execute Chart.js in a function scope ---
    var shimModule = { exports: {} };
    var chartFn = new Function(
        "module", "exports", "document", "window", "self",
        "setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame",
        "navigator", "CanvasGradient", "CanvasPattern", "Intl",
        String(chartCode)
    );
    chartFn(
        shimModule, shimModule.exports, mockDocument, mockWindow, mockWindow,
        function (fn) { fn(); return 0; }, function () {},
        function (cb) { cb(0); return 0; }, function () {},
        { userAgent: "GraalJS" }, CanvasGradient, CanvasPattern, shimIntl
    );

    // --- Extract Chart constructor ---
    var Chart = shimModule.exports;
    if (Chart && Chart.Chart) Chart = Chart.Chart;
    if (Chart && Chart.default) Chart = Chart.default;

    if (!Chart) {
        throw new Error("Failed to load Chart.js. Ensure chart.umd.js is in the same directory.");
    }

    // Register all built-in controllers, elements, scales, plugins
    if (typeof Chart.register === "function") {
        // Chart.js 4.x auto-registers when loaded as UMD
        // But just in case, try to register defaults
        try {
            var reg = shimModule.exports.registerables || shimModule.exports._registerables;
            if (reg) Chart.register.apply(Chart, reg);
        } catch (e) {
            // Already registered — ignore
        }
    }

    /**
     * Render a Chart.js chart to a PNG file.
     *
     * @param {Object} config - Chart.js configuration object
     * @param {string} config.type - Chart type: "bar", "line", "pie", "doughnut", "radar", "bubble", etc.
     * @param {Object} config.data - Chart data with labels and datasets
     * @param {Object} [config.options] - Chart.js options
     * @param {string} [config.backgroundColor="#FFFFFF"] - Canvas background color
     * @param {number} width - Canvas width in pixels
     * @param {number} height - Canvas height in pixels
     * @param {string} outputPath - File path for PNG output
     * @returns {string} The output file path
     */
    function renderChart(config, width, height, outputPath) {
        var canvas = new Canvas(width, height);
        var ctx = canvas.getContext("2d");

        // Fill background
        ctx.fillStyle = config.backgroundColor || "#FFFFFF";
        ctx.fillRect(0, 0, width, height);

        // Merge options with required server-side settings
        var options = {};
        var userOptions = config.options || {};

        // Deep-ish merge of user options
        var keys = Object.keys(userOptions);
        for (var i = 0; i < keys.length; i++) {
            options[keys[i]] = userOptions[keys[i]];
        }

        // Force server-side rendering settings
        options.responsive = false;
        options.animation = false;
        options.devicePixelRatio = 1;

        // Ensure plugins.legend and plugins.title don't animate
        if (!options.plugins) options.plugins = {};

        var chart = new Chart(ctx, {
            type: config.type,
            data: config.data,
            options: options,
            plugins: config.plugins || []
        });

        canvas.toFile(outputPath);
        chart.destroy();
        return outputPath;
    }

    // --- Export ---
    var chartSyncModule = {
        renderChart: renderChart,
        Chart: Chart,
        Canvas: Canvas
    };

    if (typeof globalThis !== "undefined") globalThis.chartSync = chartSyncModule;
    if (typeof module !== "undefined" && module.exports) module.exports = chartSyncModule;

})();
