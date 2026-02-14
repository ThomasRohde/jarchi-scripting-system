/**
 * @module menuConfig
 * @description Path resolution and layout defaults for the Script Menu.
 * Resolves scriptsRoot, registryRoot, and config directories.
 * Provides dialog dimensions — either fixed or auto-computed from screen size.
 * @version 1.0.0
 */
(function () {
    "use strict";

    if (typeof globalThis !== "undefined" && typeof globalThis.menuConfig !== "undefined") return;

    var scriptsRoot = "";
    var registryDir = "";
    var configDir = "";

    // =========================================================================
    // Dialog layout defaults
    // =========================================================================
    // Set "auto" to true to compute dimensions from screen size.
    // When auto is false, the fixed width/height values are used.

    var LAYOUT = {
        auto: true,
        autoRatio: 0.5,
        width: 1100,
        height: 750,
        sashWeights: [20, 80],
        detailSashWeights: [30, 70]
    };

    /**
     * Resolve all paths based on the scripts root directory.
     * @param {string} root - The scriptsRoot path (typically __DIR__ from Menu.ajs)
     */
    function resolve(root) {
        scriptsRoot = root.replace(/[\/\\]$/, "") + "/";
        registryDir = scriptsRoot + "registry/";
        configDir = scriptsRoot + ".jarchi-menu/";
    }

    /** @returns {string} */
    function getRegistryDir() { return registryDir; }

    /** @returns {string} */
    function getScriptsRoot() { return scriptsRoot; }

    /** @returns {string} */
    function getConfigDir() { return configDir; }

    /**
     * Get dialog layout dimensions.
     * If auto is true, computes width/height as a ratio of the primary screen.
     * @returns {Object} {width, height, sashWeights, detailSashWeights}
     */
    function getLayout() {
        var w = LAYOUT.width;
        var h = LAYOUT.height;

        if (LAYOUT.auto) {
            try {
                var Display = Java.type("org.eclipse.swt.widgets.Display");
                var display = Display.getCurrent() || Display.getDefault();
                var bounds = display.getPrimaryMonitor().getBounds();
                var ratio = LAYOUT.autoRatio;
                w = Math.round(bounds.width * ratio);
                h = Math.round(bounds.height * ratio);
            } catch (e) {
                // Fall back to fixed values
            }
        }

        return {
            width: w,
            height: h,
            sashWeights: LAYOUT.sashWeights.slice(),
            detailSashWeights: LAYOUT.detailSashWeights.slice()
        };
    }

    var menuConfig = {
        resolve: resolve,
        getRegistryDir: getRegistryDir,
        getScriptsRoot: getScriptsRoot,
        getConfigDir: getConfigDir,
        getLayout: getLayout
    };

    if (typeof globalThis !== "undefined") globalThis.menuConfig = menuConfig;
    if (typeof module !== "undefined" && module.exports) module.exports = menuConfig;
})();
