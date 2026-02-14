/**
 * @module log
 * @description Console logging helpers with color-coded output levels.
 *
 * Levels:
 *   log.header(msg)  — Blue    — script name, section titles
 *   log.info(msg)    — Default — normal progress messages
 *   log.detail(msg)  — Gray    — secondary info, sub-steps
 *   log.success(msg) — Green   — completion, result summaries
 *   log.warn(msg)    — Orange  — non-fatal warnings
 *   log.error(msg)   — Red     — errors (via console.error)
 *
 * @version 1.0.0
 * @author Thomas Rohde
 * @lastModifiedDate 2026-02-14
 */
(function () {
    "use strict";
    if (typeof globalThis !== "undefined" && typeof globalThis.log !== "undefined") return;

    // RGB color palette
    var COLORS = {
        header:  [0, 102, 204],   // Blue
        success: [0, 153, 51],    // Green
        warn:    [204, 102, 0],   // Orange
        detail:  [128, 128, 128]  // Gray
    };

    function colorMsg(rgb, msg) {
        console.setTextColor(rgb[0], rgb[1], rgb[2]);
        console.log(msg);
        console.setDefaultTextColor();
    }

    var log = {
        /** Blue — script name, section headings */
        header: function (msg) { colorMsg(COLORS.header, msg); },

        /** Default color — normal progress messages */
        info: function (msg) { console.log(msg); },

        /** Gray — secondary details, sub-steps */
        detail: function (msg) { colorMsg(COLORS.detail, msg); },

        /** Green — success / completion */
        success: function (msg) { colorMsg(COLORS.success, msg); },

        /** Orange — non-fatal warnings */
        warn: function (msg) { colorMsg(COLORS.warn, msg); },

        /** Red (via console.error) — errors */
        error: function (msg) { console.error(msg); }
    };

    if (typeof globalThis !== "undefined") globalThis.log = log;
    if (typeof module !== "undefined" && module.exports) module.exports = log;
})();
