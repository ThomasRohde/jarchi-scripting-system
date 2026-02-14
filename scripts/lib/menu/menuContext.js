/**
 * @module menuContext
 * @description Manages the __JARCHI_MENU_CTX__ global lifecycle.
 * Sets context before script execution and clears it after.
 * @version 1.0.0
 */
(function () {
    "use strict";

    if (typeof globalThis !== "undefined" && typeof globalThis.menuContext !== "undefined") return;

    /**
     * Set the menu context global before executing a script.
     * @param {Object} descriptor - The ScriptDescriptor for the script being run
     * @param {Object} selectionInfo - Captured selection info from selectionGating.captureSelection()
     */
    function set(descriptor, selectionInfo) {
        globalThis.__JARCHI_MENU_CTX__ = {
            selection: selectionInfo,
            activeView: selectionInfo ? selectionInfo.activeView : null,
            invocation: {
                menuId: descriptor.id,
                timestamp: new Date().toISOString(),
                title: descriptor.title
            }
        };
    }

    /**
     * Clear the menu context global after script execution.
     */
    function clear() {
        globalThis.__JARCHI_MENU_CTX__ = undefined;
    }

    var menuContext = {
        set: set,
        clear: clear
    };

    if (typeof globalThis !== "undefined") globalThis.menuContext = menuContext;
    if (typeof module !== "undefined" && module.exports) module.exports = menuContext;
})();
