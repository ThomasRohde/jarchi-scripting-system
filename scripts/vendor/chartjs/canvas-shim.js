/**
 * canvas-shim.js - Canvas 2D API backed by Java AWT Graphics2D for GraalJS
 *
 * Provides a Canvas and Context2D implementation that Chart.js can render to,
 * producing BufferedImage output exportable to PNG via ImageIO.
 *
 * Usage:
 *   load(__DIR__ + "vendor/chartjs/canvas-shim.js");
 *   var canvas = new canvasShim.Canvas(600, 400);
 *   var ctx = canvas.getContext('2d');
 *   // ... draw operations ...
 *   canvas.toFile("/path/to/output.png");
 *
 * @module vendor/chartjs/canvas-shim
 * @version 1.0.0
 */
(function () {
    "use strict";

    if (typeof globalThis !== "undefined" && typeof globalThis.canvasShim !== "undefined") return;

    // =========================================================================
    // Java type imports
    // =========================================================================

    var BufferedImage = Java.type("java.awt.image.BufferedImage");
    var Graphics2D = Java.type("java.awt.Graphics2D");
    var AwtColor = Java.type("java.awt.Color");
    var BasicStroke = Java.type("java.awt.BasicStroke");
    var AwtFont = Java.type("java.awt.Font");
    var RenderingHints = Java.type("java.awt.RenderingHints");
    var AlphaComposite = Java.type("java.awt.AlphaComposite");
    var GeneralPath = Java.type("java.awt.geom.GeneralPath");
    var Arc2D = Java.type("java.awt.geom.Arc2D");
    var Rectangle2D = Java.type("java.awt.geom.Rectangle2D");
    var AffineTransform = Java.type("java.awt.geom.AffineTransform");
    var LinearGradientPaint = Java.type("java.awt.LinearGradientPaint");
    var ImageIO = Java.type("javax.imageio.ImageIO");
    var JFile = Java.type("java.io.File");
    var JString = Java.type("java.lang.String");
    var JFloat = Java.type("java.lang.Float");

    // =========================================================================
    // Color parsing
    // =========================================================================

    var NAMED_COLORS = {
        transparent: [0, 0, 0, 0],
        black: [0, 0, 0, 255],
        white: [255, 255, 255, 255],
        red: [255, 0, 0, 255],
        green: [0, 128, 0, 255],
        blue: [0, 0, 255, 255],
        yellow: [255, 255, 0, 255],
        cyan: [0, 255, 255, 255],
        magenta: [255, 0, 255, 255],
        orange: [255, 165, 0, 255],
        purple: [128, 0, 128, 255],
        gray: [128, 128, 128, 255],
        grey: [128, 128, 128, 255],
        silver: [192, 192, 192, 255],
        maroon: [128, 0, 0, 255],
        olive: [128, 128, 0, 255],
        lime: [0, 255, 0, 255],
        aqua: [0, 255, 255, 255],
        teal: [0, 128, 128, 255],
        navy: [0, 0, 128, 255],
        fuchsia: [255, 0, 255, 255],
        pink: [255, 192, 203, 255],
        lightgray: [211, 211, 211, 255],
        lightgrey: [211, 211, 211, 255],
        darkgray: [169, 169, 169, 255],
        darkgrey: [169, 169, 169, 255]
    };

    /**
     * Parse a CSS color string into a Java AWT Color.
     * Supports: #RGB, #RRGGBB, #RRGGBBAA, rgb(), rgba(), named colors.
     */
    function parseColor(cssColor) {
        if (!cssColor || cssColor === "none") return new AwtColor(0, 0, 0, 0);

        // Handle gradient objects — return their first stop color or black
        if (typeof cssColor === "object" && cssColor._type === "gradient") {
            if (cssColor._stops && cssColor._stops.length > 0) {
                return parseColor(cssColor._stops[0].color);
            }
            return new AwtColor(0, 0, 0, 255);
        }

        var s = String(cssColor).trim().toLowerCase();

        // Named colors
        if (NAMED_COLORS[s]) {
            var nc = NAMED_COLORS[s];
            return new AwtColor(nc[0], nc[1], nc[2], nc[3]);
        }

        // Hex: #RGB
        if (/^#[0-9a-f]{3}$/i.test(s)) {
            var r = parseInt(s[1] + s[1], 16);
            var g = parseInt(s[2] + s[2], 16);
            var b = parseInt(s[3] + s[3], 16);
            return new AwtColor(r, g, b, 255);
        }

        // Hex: #RRGGBB
        if (/^#[0-9a-f]{6}$/i.test(s)) {
            return new AwtColor(
                parseInt(s.substring(1, 3), 16),
                parseInt(s.substring(3, 5), 16),
                parseInt(s.substring(5, 7), 16),
                255
            );
        }

        // Hex: #RRGGBBAA
        if (/^#[0-9a-f]{8}$/i.test(s)) {
            return new AwtColor(
                parseInt(s.substring(1, 3), 16),
                parseInt(s.substring(3, 5), 16),
                parseInt(s.substring(5, 7), 16),
                parseInt(s.substring(7, 9), 16)
            );
        }

        // rgb(r, g, b) or rgb(r g b)
        var rgbMatch = s.match(/^rgb\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)\s*\)$/);
        if (rgbMatch) {
            return new AwtColor(
                Math.min(255, parseInt(rgbMatch[1])),
                Math.min(255, parseInt(rgbMatch[2])),
                Math.min(255, parseInt(rgbMatch[3])),
                255
            );
        }

        // rgba(r, g, b, a) — a is 0..1 float
        var rgbaMatch = s.match(/^rgba\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)[,\s]+([\d.]+)\s*\)$/);
        if (rgbaMatch) {
            return new AwtColor(
                Math.min(255, parseInt(rgbaMatch[1])),
                Math.min(255, parseInt(rgbaMatch[2])),
                Math.min(255, parseInt(rgbaMatch[3])),
                Math.min(255, Math.round(parseFloat(rgbaMatch[4]) * 255))
            );
        }

        // Fallback: black
        return new AwtColor(0, 0, 0, 255);
    }

    // =========================================================================
    // Font parsing
    // =========================================================================

    /**
     * Parse a CSS font string into a Java AWT Font.
     * Handles: "12px Arial", "bold 14px Helvetica", "italic 600 16px sans-serif"
     */
    function parseFont(cssFontString) {
        if (!cssFontString) return new AwtFont("SansSerif", AwtFont.PLAIN, 12);

        var s = String(cssFontString).trim();
        var style = AwtFont.PLAIN;
        var size = 12;
        var family = "SansSerif";

        // Extract italic
        if (/\bitalic\b/i.test(s)) {
            style |= AwtFont.ITALIC;
            s = s.replace(/\bitalic\b/i, "").trim();
        }

        // Extract bold (keyword or numeric weight >= 600)
        if (/\bbold\b/i.test(s)) {
            style |= AwtFont.BOLD;
            s = s.replace(/\bbold\b/i, "").trim();
        }
        var weightMatch = s.match(/\b([5-9]\d{2})\b/);
        if (weightMatch && parseInt(weightMatch[1]) >= 600) {
            style |= AwtFont.BOLD;
            s = s.replace(weightMatch[0], "").trim();
        }
        // Remove any remaining numeric weight (100-400)
        s = s.replace(/\b[1-4]\d{2}\b/, "").trim();
        // Remove "normal" keyword
        s = s.replace(/\bnormal\b/gi, "").trim();

        // Extract size (Npx or Npt)
        var sizeMatch = s.match(/([\d.]+)\s*(?:px|pt)/i);
        if (sizeMatch) {
            size = Math.round(parseFloat(sizeMatch[1]));
            s = s.replace(sizeMatch[0], "").trim();
        }

        // Extract line-height (e.g., /1.2 or / 1.2)
        s = s.replace(/\/\s*[\d.]+/, "").trim();

        // Remaining text is the font family
        if (s.length > 0) {
            // Remove quotes and commas, take first family
            family = s.replace(/['"]/g, "").split(",")[0].trim();
        }

        // Map generic families
        var familyMap = {
            "sans-serif": "SansSerif",
            "serif": "Serif",
            "monospace": "Monospaced",
            "cursive": "SansSerif",
            "fantasy": "SansSerif",
            "system-ui": "SansSerif",
            "arial": "SansSerif",
            "helvetica": "SansSerif",
            "verdana": "SansSerif",
            "times": "Serif",
            "times new roman": "Serif",
            "courier": "Monospaced",
            "courier new": "Monospaced"
        };
        var mapped = familyMap[family.toLowerCase()];
        if (mapped) family = mapped;

        return new AwtFont(family, style, size);
    }

    // =========================================================================
    // Gradient object
    // =========================================================================

    function LinearGradient(x0, y0, x1, y1) {
        this._type = "gradient";
        this.x0 = x0;
        this.y0 = y0;
        this.x1 = x1;
        this.y1 = y1;
        this._stops = [];
    }

    LinearGradient.prototype.addColorStop = function (offset, color) {
        this._stops.push({ offset: offset, color: color });
        this._stops.sort(function (a, b) { return a.offset - b.offset; });
    };

    /**
     * Convert to Java LinearGradientPaint.
     */
    LinearGradient.prototype.toJavaPaint = function () {
        if (this._stops.length === 0) return new AwtColor(0, 0, 0, 255);
        if (this._stops.length === 1) return parseColor(this._stops[0].color);

        // Ensure first stop at 0 and last at 1
        var stops = this._stops.slice();
        if (stops[0].offset > 0) stops.unshift({ offset: 0, color: stops[0].color });
        if (stops[stops.length - 1].offset < 1) stops.push({ offset: 1, color: stops[stops.length - 1].color });

        // De-duplicate identical offsets (LinearGradientPaint requires strictly increasing)
        var deduped = [stops[0]];
        for (var i = 1; i < stops.length; i++) {
            if (stops[i].offset > deduped[deduped.length - 1].offset) {
                deduped.push(stops[i]);
            }
        }
        stops = deduped;

        if (stops.length < 2) return parseColor(stops[0].color);

        var fractions = Java.type("float[]");
        var fArr = new fractions(stops.length);
        var colors = Java.type("java.awt.Color[]");
        var cArr = new colors(stops.length);

        for (var j = 0; j < stops.length; j++) {
            fArr[j] = stops[j].offset;
            cArr[j] = parseColor(stops[j].color);
        }

        // Avoid zero-length gradient (identical start/end)
        var dx = this.x1 - this.x0;
        var dy = this.y1 - this.y0;
        if (dx === 0 && dy === 0) {
            return parseColor(stops[stops.length - 1].color);
        }

        var Point2D = Java.type("java.awt.geom.Point2D$Float");
        return new LinearGradientPaint(
            new Point2D(this.x0, this.y0),
            new Point2D(this.x1, this.y1),
            fArr,
            cArr
        );
    };

    // =========================================================================
    // Context2D
    // =========================================================================

    function Context2D(canvas) {
        this._canvas = canvas;
        this._g2d = canvas._image.createGraphics();
        this._path = new GeneralPath();

        // Enable anti-aliasing
        this._g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        this._g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        this._g2d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);

        // State
        this._fillStyle = "#000000";
        this._strokeStyle = "#000000";
        this._lineWidth = 1;
        this._lineJoin = "miter";
        this._lineCap = "butt";
        this._lineDash = [];
        this._lineDashOffset = 0;
        this._font = "10px sans-serif";
        this._javaFont = new AwtFont("SansSerif", AwtFont.PLAIN, 10);
        this._textAlign = "start";
        this._textBaseline = "alphabetic";
        this._globalAlpha = 1.0;
        this._stateStack = [];

        this._g2d.setFont(this._javaFont);
    }

    // ---- Property getters/setters ----

    Object.defineProperty(Context2D.prototype, "fillStyle", {
        get: function () { return this._fillStyle; },
        set: function (v) { this._fillStyle = v; }
    });

    Object.defineProperty(Context2D.prototype, "strokeStyle", {
        get: function () { return this._strokeStyle; },
        set: function (v) { this._strokeStyle = v; }
    });

    Object.defineProperty(Context2D.prototype, "lineWidth", {
        get: function () { return this._lineWidth; },
        set: function (v) { this._lineWidth = v; }
    });

    Object.defineProperty(Context2D.prototype, "lineJoin", {
        get: function () { return this._lineJoin; },
        set: function (v) { this._lineJoin = v; }
    });

    Object.defineProperty(Context2D.prototype, "lineCap", {
        get: function () { return this._lineCap; },
        set: function (v) { this._lineCap = v; }
    });

    Object.defineProperty(Context2D.prototype, "lineDashOffset", {
        get: function () { return this._lineDashOffset; },
        set: function (v) { this._lineDashOffset = v; }
    });

    Object.defineProperty(Context2D.prototype, "font", {
        get: function () { return this._font; },
        set: function (v) {
            this._font = v;
            this._javaFont = parseFont(v);
            this._g2d.setFont(this._javaFont);
        }
    });

    Object.defineProperty(Context2D.prototype, "textAlign", {
        get: function () { return this._textAlign; },
        set: function (v) { this._textAlign = v; }
    });

    Object.defineProperty(Context2D.prototype, "textBaseline", {
        get: function () { return this._textBaseline; },
        set: function (v) { this._textBaseline = v; }
    });

    Object.defineProperty(Context2D.prototype, "globalAlpha", {
        get: function () { return this._globalAlpha; },
        set: function (v) {
            this._globalAlpha = Math.max(0, Math.min(1, v));
        }
    });

    Object.defineProperty(Context2D.prototype, "canvas", {
        get: function () { return this._canvas; }
    });

    // ---- State management ----

    Context2D.prototype.save = function () {
        this._stateStack.push({
            fillStyle: this._fillStyle,
            strokeStyle: this._strokeStyle,
            lineWidth: this._lineWidth,
            lineJoin: this._lineJoin,
            lineCap: this._lineCap,
            lineDash: this._lineDash.slice(),
            lineDashOffset: this._lineDashOffset,
            font: this._font,
            javaFont: this._javaFont,
            textAlign: this._textAlign,
            textBaseline: this._textBaseline,
            globalAlpha: this._globalAlpha,
            transform: this._g2d.getTransform(),
            clip: this._g2d.getClip()
        });
    };

    Context2D.prototype.restore = function () {
        if (this._stateStack.length === 0) return;
        var state = this._stateStack.pop();
        this._fillStyle = state.fillStyle;
        this._strokeStyle = state.strokeStyle;
        this._lineWidth = state.lineWidth;
        this._lineJoin = state.lineJoin;
        this._lineCap = state.lineCap;
        this._lineDash = state.lineDash;
        this._lineDashOffset = state.lineDashOffset;
        this._font = state.font;
        this._javaFont = state.javaFont;
        this._textAlign = state.textAlign;
        this._textBaseline = state.textBaseline;
        this._globalAlpha = state.globalAlpha;
        this._g2d.setTransform(state.transform);
        this._g2d.setClip(state.clip);
        this._g2d.setFont(this._javaFont);
    };

    // ---- Internal helpers ----

    Context2D.prototype._applyFill = function () {
        var style = this._fillStyle;
        if (typeof style === "object" && style._type === "gradient") {
            this._g2d.setPaint(style.toJavaPaint());
        } else {
            this._g2d.setColor(parseColor(style));
        }
        if (this._globalAlpha < 1.0) {
            this._g2d.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, this._globalAlpha));
        } else {
            this._g2d.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 1.0));
        }
    };

    Context2D.prototype._applyStroke = function () {
        var style = this._strokeStyle;
        if (typeof style === "object" && style._type === "gradient") {
            this._g2d.setPaint(style.toJavaPaint());
        } else {
            this._g2d.setColor(parseColor(style));
        }
        if (this._globalAlpha < 1.0) {
            this._g2d.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, this._globalAlpha));
        } else {
            this._g2d.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 1.0));
        }

        // Line join
        var join = BasicStroke.JOIN_MITER;
        if (this._lineJoin === "round") join = BasicStroke.JOIN_ROUND;
        else if (this._lineJoin === "bevel") join = BasicStroke.JOIN_BEVEL;

        // Line cap
        var cap = BasicStroke.CAP_BUTT;
        if (this._lineCap === "round") cap = BasicStroke.CAP_ROUND;
        else if (this._lineCap === "square") cap = BasicStroke.CAP_SQUARE;

        // Dash
        if (this._lineDash.length > 0) {
            var dashArr = Java.type("float[]");
            var dashes = new dashArr(this._lineDash.length);
            for (var i = 0; i < this._lineDash.length; i++) {
                dashes[i] = this._lineDash[i];
            }
            this._g2d.setStroke(new BasicStroke(this._lineWidth, cap, join, 10.0, dashes, this._lineDashOffset));
        } else {
            this._g2d.setStroke(new BasicStroke(this._lineWidth, cap, join));
        }
    };

    /**
     * Compute x offset for text alignment.
     */
    Context2D.prototype._textAlignX = function (x, textWidth) {
        switch (this._textAlign) {
            case "center": return x - textWidth / 2;
            case "right":
            case "end": return x - textWidth;
            default: return x; // "left", "start"
        }
    };

    /**
     * Compute y offset for text baseline.
     */
    Context2D.prototype._textBaselineY = function (y) {
        var fm = this._g2d.getFontMetrics();
        switch (this._textBaseline) {
            case "top": return y + fm.getAscent();
            case "hanging": return y + fm.getAscent();
            case "middle": return y + fm.getAscent() / 2;
            case "bottom": return y - fm.getDescent();
            case "ideographic": return y - fm.getDescent();
            default: return y; // "alphabetic"
        }
    };

    // ---- Rectangle methods ----

    Context2D.prototype.fillRect = function (x, y, w, h) {
        this._applyFill();
        this._g2d.fill(new Rectangle2D.Double(x, y, w, h));
    };

    Context2D.prototype.strokeRect = function (x, y, w, h) {
        this._applyStroke();
        this._g2d.draw(new Rectangle2D.Double(x, y, w, h));
    };

    Context2D.prototype.clearRect = function (x, y, w, h) {
        var saved = this._g2d.getComposite();
        this._g2d.setComposite(AlphaComposite.Clear);
        this._g2d.fill(new Rectangle2D.Double(x, y, w, h));
        this._g2d.setComposite(saved);
    };

    // ---- Path methods ----

    Context2D.prototype.beginPath = function () {
        this._path = new GeneralPath();
    };

    Context2D.prototype.moveTo = function (x, y) {
        this._path.moveTo(x, y);
    };

    Context2D.prototype.lineTo = function (x, y) {
        this._path.lineTo(x, y);
    };

    Context2D.prototype.closePath = function () {
        this._path.closePath();
    };

    Context2D.prototype.rect = function (x, y, w, h) {
        this._path.moveTo(x, y);
        this._path.lineTo(x + w, y);
        this._path.lineTo(x + w, y + h);
        this._path.lineTo(x, y + h);
        this._path.closePath();
    };

    Context2D.prototype.arc = function (x, y, radius, startAngle, endAngle, anticlockwise) {
        if (typeof anticlockwise === "undefined") anticlockwise = false;

        // Convert radians to degrees (Java uses degrees)
        var startDeg = -startAngle * 180 / Math.PI;
        var endDeg = -endAngle * 180 / Math.PI;
        var extent = endDeg - startDeg;

        if (!anticlockwise) {
            // Clockwise in canvas = negative extent in Java (Java's positive is counter-clockwise)
            if (extent > 0) extent -= 360;
        } else {
            if (extent < 0) extent += 360;
        }

        // Handle full circle
        if (Math.abs(endAngle - startAngle) >= 2 * Math.PI) {
            extent = anticlockwise ? 360 : -360;
        }

        var arc = new Arc2D.Double(
            x - radius, y - radius, radius * 2, radius * 2,
            startDeg, extent, Arc2D.OPEN
        );
        this._path.append(arc, true);
    };

    Context2D.prototype.arcTo = function (x1, y1, x2, y2, radius) {
        // Simplified arcTo: use quadratic curve as approximation
        // This is sufficient for Chart.js rounded corners
        var cp = this._path.getCurrentPoint();
        if (!cp) {
            this._path.moveTo(x1, y1);
            return;
        }
        this._path.quadTo(x1, y1, (x1 + x2) / 2, (y1 + y2) / 2);
    };

    Context2D.prototype.bezierCurveTo = function (cp1x, cp1y, cp2x, cp2y, x, y) {
        this._path.curveTo(cp1x, cp1y, cp2x, cp2y, x, y);
    };

    Context2D.prototype.quadraticCurveTo = function (cpx, cpy, x, y) {
        this._path.quadTo(cpx, cpy, x, y);
    };

    // ---- Drawing ----

    Context2D.prototype.fill = function () {
        this._applyFill();
        this._g2d.fill(this._path);
    };

    Context2D.prototype.stroke = function () {
        this._applyStroke();
        this._g2d.draw(this._path);
    };

    Context2D.prototype.clip = function () {
        this._g2d.clip(this._path);
    };

    // ---- Text ----

    Context2D.prototype.fillText = function (text, x, y) {
        this._applyFill();
        this._g2d.setFont(this._javaFont);
        var jText = new JString(String(text));
        var fm = this._g2d.getFontMetrics();
        var tw = fm.stringWidth(jText);
        var ax = new JFloat(this._textAlignX(x, tw));
        var ay = new JFloat(this._textBaselineY(y));
        this._g2d.drawString(jText, ax, ay);
    };

    Context2D.prototype.strokeText = function (text, x, y) {
        // Approximate stroke text with fill text (stroke text is rare in Chart.js)
        this._applyStroke();
        this._g2d.setFont(this._javaFont);
        var jText = new JString(String(text));
        var fm = this._g2d.getFontMetrics();
        var tw = fm.stringWidth(jText);
        var ax = new JFloat(this._textAlignX(x, tw));
        var ay = new JFloat(this._textBaselineY(y));
        this._g2d.drawString(jText, ax, ay);
    };

    Context2D.prototype.measureText = function (text) {
        this._g2d.setFont(this._javaFont);
        var jText = new JString(String(text));
        var fm = this._g2d.getFontMetrics();
        var w = fm.stringWidth(jText);
        var ascent = fm.getAscent();
        var descent = fm.getDescent();
        return {
            width: w,
            actualBoundingBoxAscent: ascent,
            actualBoundingBoxDescent: descent,
            fontBoundingBoxAscent: ascent,
            fontBoundingBoxDescent: descent,
            emHeightAscent: ascent,
            emHeightDescent: descent
        };
    };

    // ---- Line dash ----

    Context2D.prototype.setLineDash = function (segments) {
        this._lineDash = segments ? segments.slice() : [];
    };

    Context2D.prototype.getLineDash = function () {
        return this._lineDash.slice();
    };

    // ---- Transforms ----

    Context2D.prototype.translate = function (x, y) {
        this._g2d.translate(x, y);
    };

    Context2D.prototype.rotate = function (angle) {
        this._g2d.rotate(angle);
    };

    Context2D.prototype.scale = function (x, y) {
        this._g2d.scale(x, y);
    };

    Context2D.prototype.setTransform = function (a, b, c, d, e, f) {
        this._g2d.setTransform(new AffineTransform(a, b, c, d, e, f));
    };

    Context2D.prototype.resetTransform = function () {
        this._g2d.setTransform(new AffineTransform());
    };

    Context2D.prototype.getTransform = function () {
        var t = this._g2d.getTransform();
        return {
            a: t.getScaleX(), b: t.getShearY(),
            c: t.getShearX(), d: t.getScaleY(),
            e: t.getTranslateX(), f: t.getTranslateY()
        };
    };

    // ---- Gradients ----

    Context2D.prototype.createLinearGradient = function (x0, y0, x1, y1) {
        return new LinearGradient(x0, y0, x1, y1);
    };

    Context2D.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) {
        // Approximate radial gradient as linear (Chart.js rarely uses radial gradients)
        return new LinearGradient(x0, y0, x1, y1);
    };

    // ---- Pixel operations (no-ops for Chart.js compatibility) ----

    Context2D.prototype.createImageData = function (w, h) {
        return { width: w, height: h, data: new Array(w * h * 4) };
    };

    Context2D.prototype.getImageData = function (x, y, w, h) {
        return { width: w, height: h, data: new Array(w * h * 4) };
    };

    Context2D.prototype.putImageData = function () { /* no-op */ };

    Context2D.prototype.drawImage = function () { /* no-op */ };

    // ---- Pattern (no-op stub) ----

    Context2D.prototype.createPattern = function () {
        return null;
    };

    // ---- isPointInPath (no-op stub) ----

    Context2D.prototype.isPointInPath = function () {
        return false;
    };

    Context2D.prototype.isPointInStroke = function () {
        return false;
    };

    // =========================================================================
    // Canvas
    // =========================================================================

    function Canvas(width, height) {
        this.width = width || 300;
        this.height = height || 150;
        this._image = new BufferedImage(this.width, this.height, BufferedImage.TYPE_INT_ARGB);
        this._ctx = null;
        // Chart.js checks for style property
        this.style = {};
    }

    Canvas.prototype.getContext = function (type) {
        if (type !== "2d") throw new Error("Only '2d' context is supported");
        if (!this._ctx) {
            this._ctx = new Context2D(this);
        }
        return this._ctx;
    };

    Canvas.prototype.toFile = function (path) {
        if (this._ctx) {
            this._ctx._g2d.dispose();
        }
        ImageIO.write(this._image, "PNG", new JFile(path));
    };

    Canvas.prototype.toDataURL = function () {
        // Stub for Chart.js compatibility — returns empty string
        return "";
    };

    // Chart.js calls addEventListener on the canvas
    Canvas.prototype.addEventListener = function () { /* no-op */ };
    Canvas.prototype.removeEventListener = function () { /* no-op */ };

    // Chart.js may call getBoundingClientRect
    Canvas.prototype.getBoundingClientRect = function () {
        return { left: 0, top: 0, width: this.width, height: this.height, right: this.width, bottom: this.height };
    };

    // Chart.js setAttribute/getAttribute
    Canvas.prototype.setAttribute = function () { /* no-op */ };
    Canvas.prototype.getAttribute = function (name) {
        if (name === "width") return this.width;
        if (name === "height") return this.height;
        return null;
    };

    // =========================================================================
    // CanvasGradient (for Chart.js instanceof checks)
    // =========================================================================

    function CanvasGradient() {}
    LinearGradient.prototype.__proto__ = CanvasGradient.prototype;

    // =========================================================================
    // CanvasPattern (for Chart.js instanceof checks)
    // =========================================================================

    function CanvasPattern() {}

    // =========================================================================
    // Export
    // =========================================================================

    var canvasShim = {
        Canvas: Canvas,
        Context2D: Context2D,
        CanvasGradient: CanvasGradient,
        CanvasPattern: CanvasPattern,
        parseColor: parseColor,
        parseFont: parseFont,
        LinearGradient: LinearGradient
    };

    if (typeof globalThis !== "undefined") globalThis.canvasShim = canvasShim;
    if (typeof module !== "undefined" && module.exports) module.exports = canvasShim;

})();
