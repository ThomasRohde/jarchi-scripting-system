/**
 * Tech Radar — shared rendering library
 *
 * Provides functions to collect tagged elements, render a Thoughtworks-style
 * Technology Radar as a BufferedImage, and embed it in an ArchiMate view.
 *
 * Elements are tagged with properties:
 *   tech-radar-ring      : Adopt | Trial | Assess | Hold
 *   tech-radar-quadrant  : Platforms | Tools | Languages & Frameworks | Techniques
 *   tech-radar-new       : true  (optional — draws a triangle marker)
 *
 * @module techRadar
 */
(function () {
    "use strict";
    if (typeof globalThis !== "undefined" && typeof globalThis.techRadar !== "undefined") return;

    // ── Java interop ────────────────────────────────────────────────────────
    var BufferedImage   = Java.type("java.awt.image.BufferedImage");
    var RenderingHints  = Java.type("java.awt.RenderingHints");
    var Color           = Java.type("java.awt.Color");
    var Font            = Java.type("java.awt.Font");
    var BasicStroke     = Java.type("java.awt.BasicStroke");
    var Polygon         = Java.type("java.awt.Polygon");
    var ImageIO         = Java.type("javax.imageio.ImageIO");
    var JFile           = Java.type("java.io.File");
    var JString         = Java.type("java.lang.String");
    var JFloat          = Java.type("java.lang.Float");

    // ── Radar configuration ─────────────────────────────────────────────────
    var RADAR = {
        W: 1100,
        margin: 55,

        rings:     ["Adopt",     "Trial",       "Assess",      "Hold"],
        quadrants: ["Platforms", "Tools",       "Languages &\nFrameworks", "Techniques"],

        // Light-mode ring fill colours (semi-transparent)
        ringFill: [
            new Color(46,  204, 113,  55),   // Adopt  — green
            new Color(52,  152, 219,  55),   // Trial  — blue
            new Color(241, 196,  15,  55),   // Assess — amber
            new Color(231,  76,  60,  50)    // Hold   — red
        ],
        ringBorder: [
            new Color(39,  174,  96),
            new Color(41,  128, 185),
            new Color(243, 156,  18),
            new Color(192,  57,  43)
        ],

        bgColor:   new Color(252, 252, 255),
        textColor: new Color(44,  62,  80),
        blipR:     11
    };

    // ── Helpers ──────────────────────────────────────────────────────────────

    function prop(el, name) {
        var v = el.prop(name);
        return v ? String(v).trim() : null;
    }

    function drawText(g, text, x, y) {
        g.drawString(new JString(String(text)), new JFloat(x), new JFloat(y));
    }

    // ── Data collection ─────────────────────────────────────────────────────

    function collectBlips() {
        var blips = [];
        var seen  = {};

        $("*").each(function (el) {
            var ring = prop(el, "tech-radar-ring");
            var quad = prop(el, "tech-radar-quadrant");
            if (!ring || !quad || seen[el.id]) return;

            var ri = RADAR.rings.findIndex(function (r) {
                return r.toLowerCase() === ring.toLowerCase();
            });
            var qi = RADAR.quadrants.findIndex(function (q) {
                return q.replace("\n", " ").toLowerCase() === quad.toLowerCase() ||
                       q.replace("\n", " ").toLowerCase().indexOf(quad.toLowerCase()) >= 0;
            });
            if (ri < 0 || qi < 0) {
                console.log("  Skipping '" + el.name + "': unrecognised ring='" + ring +
                            "' or quadrant='" + quad + "'");
                return;
            }
            seen[el.id] = true;
            blips.push({
                id:    el.id,
                name:  el.name,
                ring:  ri,
                quad:  qi,
                isNew: prop(el, "tech-radar-new") === "true"
            });
        });

        blips.sort(function (a, b) {
            if (a.quad !== b.quad) return a.quad - b.quad;
            if (a.ring !== b.ring) return a.ring - b.ring;
            return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
        });

        return blips;
    }

    // ── Deterministic pseudo-random placement ───────────────────────────────

    function seeded(seed) {
        var h1 = 0, h2 = 0x5f3759df;
        for (var i = 0; i < seed.length; i++) {
            var c = seed.charCodeAt(i);
            h1 = Math.imul(h1 ^ c, 0x9e3779b9) >>> 0;
            h2 = Math.imul(h2 ^ c, 0x85ebca6b) >>> 0;
        }
        var a = ((h1 ^ (h1 >>> 16)) * 0x45d9f3b) >>> 0;
        var b = ((h2 ^ (h2 >>> 13)) * 0xc2b2ae35) >>> 0;
        return { r: a / 0xffffffff, t: b / 0xffffffff };
    }

    function blipXY(cx, cy, qi, ri, innerR, outerR, seed) {
        var s    = seeded(seed);
        var band = innerR + (s.r * 0.72 + 0.14) * (outerR - innerR);
        var pad  = 10;
        var deg  = qi * 90 + pad + s.t * (90 - 2 * pad);
        var rad  = deg * Math.PI / 180;
        return { x: cx + band * Math.cos(rad), y: cy + band * Math.sin(rad) };
    }

    // ── Rendering ───────────────────────────────────────────────────────────

    function renderRadar(blips) {
        var W = RADAR.W;
        var cx = W / 2;
        var maxR = cx - RADAR.margin;          // radar fills the width

        // ── Pre-compute legend rows to determine image height ───────────
        var legendRows = [[], [], [], []];
        blips.forEach(function (blip, idx) {
            legendRows[blip.quad].push({ n: idx + 1, name: blip.name, ring: blip.ring });
        });
        var maxPerQuad = 0;
        for (var qi = 0; qi < 4; qi++) {
            maxPerQuad = Math.max(maxPerQuad, legendRows[qi].length);
        }

        var titleH       = 50;                 // space above the radar for title
        var rowH         = 16;
        var legendGap    = 28;                  // gap between radar bottom and legend
        var legendHeaderH = 20;
        var legendH      = legendHeaderH + maxPerQuad * rowH + 12;

        var cy = titleH + maxR;                 // radar centre
        var H  = Math.round(cy + maxR + legendGap + legendH);

        // ── Create image ────────────────────────────────────────────────
        var img = new BufferedImage(W, H, BufferedImage.TYPE_INT_ARGB);
        var g   = img.createGraphics();

        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING,      RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_LCD_HRGB);
        g.setRenderingHint(RenderingHints.KEY_RENDERING,         RenderingHints.VALUE_RENDER_QUALITY);

        g.setColor(RADAR.bgColor);
        g.fillRect(0, 0, W, H);

        var nR    = RADAR.rings.length;
        var ringR = [];
        for (var i = 0; i < nR; i++) ringR.push(maxR * (i + 1) / nR);

        // ── Ring fills — outermost first ────────────────────────────────
        for (var ri = nR - 1; ri >= 0; ri--) {
            var ro  = ringR[ri];
            var ri2 = ri > 0 ? ringR[ri - 1] : 0;

            g.setColor(RADAR.ringFill[ri]);
            g.fillOval(Math.round(cx - ro), Math.round(cy - ro),
                       Math.round(2 * ro),  Math.round(2 * ro));

            if (ri2 > 0) {
                g.setColor(RADAR.bgColor);
                g.fillOval(Math.round(cx - ri2), Math.round(cy - ri2),
                           Math.round(2 * ri2),  Math.round(2 * ri2));
            }
        }

        // ── Ring borders ────────────────────────────────────────────────
        g.setStroke(new BasicStroke(1.5));
        for (var ri = 0; ri < nR; ri++) {
            g.setColor(RADAR.ringBorder[ri]);
            var ro = ringR[ri];
            g.drawOval(Math.round(cx - ro), Math.round(cy - ro),
                       Math.round(2 * ro),  Math.round(2 * ro));
        }

        // ── Quadrant dividers (dashed) ──────────────────────────────────
        var dashArr = Java.to([7.0, 5.0], "float[]");
        var dashed  = new BasicStroke(1.0, BasicStroke.CAP_BUTT, BasicStroke.JOIN_MITER,
                                      10.0, dashArr, 0.0);
        g.setStroke(dashed);
        g.setColor(new Color(180, 185, 195, 160));
        g.drawLine(Math.round(cx), Math.round(cy - maxR - 8),
                   Math.round(cx), Math.round(cy + maxR + 8));
        g.drawLine(Math.round(cx - maxR - 8), Math.round(cy),
                   Math.round(cx + maxR + 8), Math.round(cy));

        // ── Ring name labels (centred along horizontal axis) ────────────
        g.setStroke(new BasicStroke(1.0));
        g.setFont(new Font("SansSerif", Font.BOLD, 12));
        for (var ri = 0; ri < nR; ri++) {
            var ro  = ringR[ri];
            var ri2 = ri > 0 ? ringR[ri - 1] : 0;
            var mid = (ro + ri2) / 2;
            var lbl = RADAR.rings[ri].toUpperCase();
            var fm  = g.getFontMetrics();
            var tw  = fm.stringWidth(new JString(lbl));
            g.setColor(new Color(140, 145, 160, 170));
            drawText(g, lbl, cx + mid - tw / 2, cy + fm.getAscent() / 2);
        }

        // ── Quadrant labels — corners just outside the radar ────────────
        //   Q0 Platforms              → bottom-right
        //   Q1 Tools                  → bottom-left
        //   Q2 Languages & Frameworks → top-left
        //   Q3 Techniques             → top-right
        //
        // Placed on the 45° diagonal at a radial distance just outside the
        // outermost ring.  cos(45°) ≈ 0.707 converts radial → x/y offset.
        g.setFont(new Font("SansSerif", Font.ITALIC + Font.BOLD, 18));
        g.setColor(new Color(100, 110, 130));

        var labelDist = maxR + 40;     // ← nudge: increase to push labels further from circle
        var d45       = labelDist * Math.cos(Math.PI / 4);   // x/y offset

        var cornerPositions = [
            { x: cx + d45, y: cy + d45, anchor: "left"  },   // Q0 bottom-right
            { x: cx - d45, y: cy + d45, anchor: "right" },   // Q1 bottom-left
            { x: cx - d45, y: cy - d45, anchor: "right" },   // Q2 top-left
            { x: cx + d45, y: cy - d45, anchor: "left"  }    // Q3 top-right
        ];

        for (var qi = 0; qi < 4; qi++) {
            var cpos  = cornerPositions[qi];
            var lines = RADAR.quadrants[qi].split("\n");
            var fm    = g.getFontMetrics();
            var lineH = fm.getHeight() + 2;
            for (var li = 0; li < lines.length; li++) {
                var tw = fm.stringWidth(new JString(lines[li]));
                var lx = cpos.anchor === "right" ? cpos.x - tw : cpos.x;
                var ly = cpos.y + li * lineH;
                drawText(g, lines[li], lx, ly);
            }
        }

        // ── Blips ───────────────────────────────────────────────────────
        var brad = RADAR.blipR;

        blips.forEach(function (blip, idx) {
            var n    = idx + 1;
            var ro   = ringR[blip.ring];
            var ri2  = blip.ring > 0 ? ringR[blip.ring - 1] : brad + 2;
            var pos  = blipXY(cx, cy, blip.quad, blip.ring, ri2, ro, blip.id + blip.name);
            var bx   = Math.round(pos.x);
            var by   = Math.round(pos.y);

            var bc   = RADAR.ringBorder[blip.ring];
            var fill = new Color(bc.getRed(), bc.getGreen(), bc.getBlue(), 210);

            if (blip.isNew) {
                g.setColor(fill);
                var tri = new Polygon();
                tri.addPoint(bx,        by - brad);
                tri.addPoint(bx + brad, by + brad - 2);
                tri.addPoint(bx - brad, by + brad - 2);
                g.fillPolygon(tri);
                g.setColor(new Color(60, 60, 80));
                g.setStroke(new BasicStroke(1.2));
                g.drawPolygon(tri);
                g.setStroke(new BasicStroke(1.0));
            } else {
                g.setColor(fill);
                g.fillOval(bx - brad, by - brad, brad * 2, brad * 2);
                g.setColor(new Color(0, 0, 0, 50));
                g.drawOval(bx - brad, by - brad, brad * 2, brad * 2);
            }

            // Number label inside blip
            g.setColor(Color.WHITE);
            g.setFont(new Font("SansSerif", Font.BOLD, 9));
            var fm = g.getFontMetrics();
            var ns = String(n);
            drawText(g, ns, bx - fm.stringWidth(new JString(ns)) / 2,
                            by + fm.getAscent() / 2 - 1);
        });

        // ── Title ───────────────────────────────────────────────────────
        g.setFont(new Font("SansSerif", Font.BOLD, 26));
        g.setColor(RADAR.textColor);
        var title = "Technology Radar";
        var fm    = g.getFontMetrics();
        drawText(g, title, cx - fm.stringWidth(new JString(title)) / 2, 36);

        // ── Legend — four columns below the radar ───────────────────────
        var legTopY = Math.round(cy + maxR + legendGap);
        var colW    = Math.round(W / 4);

        for (var qi = 0; qi < 4; qi++) {
            var lx = qi * colW + 8;

            g.setFont(new Font("SansSerif", Font.BOLD, 12));
            g.setColor(new Color(60, 70, 90));
            drawText(g, RADAR.quadrants[qi].replace("\n", " "), lx, legTopY);

            g.setFont(new Font("SansSerif", Font.PLAIN, 10));
            var rows = legendRows[qi];
            for (var li = 0; li < rows.length; li++) {
                var entry = rows[li];
                var ry    = legTopY + legendHeaderH + li * rowH;
                var dc    = RADAR.ringBorder[entry.ring];
                g.setColor(new Color(dc.getRed(), dc.getGreen(), dc.getBlue(), 220));
                g.fillOval(lx, ry - 8, 9, 9);
                g.setColor(RADAR.textColor);
                var lbl = entry.n + ". " + entry.name;
                if (lbl.length > 28) lbl = lbl.substring(0, 26) + "\u2026";
                drawText(g, lbl, lx + 12, ry);
            }
        }

        g.dispose();
        return img;
    }

    // ── Embed in view ───────────────────────────────────────────────────────

    function embedInView(img, view) {
        var tmpFile = JFile.createTempFile("tech-radar-", ".png");
        tmpFile.deleteOnExit();
        ImageIO.write(img, "png", tmpFile);
        var filePath = tmpFile.getAbsolutePath();

        var imageMap = model.createImage(filePath);

        var existing = null;
        $(view).children().each(function (child) {
            if (child.name === "Tech Radar" && child.type === "diagram-model-note") {
                existing = child;
            }
        });

        var noteObj;
        if (existing) {
            noteObj = existing;
        } else {
            noteObj = view.createObject("note", 0, 0, img.getWidth(), img.getHeight());
            noteObj.name = "Tech Radar";
        }

        noteObj.image         = imageMap;
        noteObj.imagePosition = 9;  // FILL
        noteObj.borderType    = 2;  // BORDER_NONE
        noteObj.setText("");
        noteObj.bounds = { x: 0, y: 0, width: img.getWidth(), height: img.getHeight() };
    }

    // ── Public API ──────────────────────────────────────────────────────────

    var techRadar = {
        RADAR:        RADAR,
        collectBlips: collectBlips,
        renderRadar:  renderRadar,
        embedInView:  embedInView
    };

    if (typeof globalThis !== "undefined") globalThis.techRadar = techRadar;
    if (typeof module !== "undefined" && module.exports) module.exports = techRadar;
})();
