/**
 * @module capabilityMapDialog
 * @description SWT dialog for configuring Build Capability Map options.
 * Provides an ExtendedTitleAreaDialog with a capability tree selector
 * and groups for general settings, leaf sizing, spacing, and per-level color pickers.
 * @version 2.0.0
 * @author Thomas Rohde
 * @lastModifiedDate 2026-02-24
 */
(function () {
    "use strict";

    if (typeof globalThis !== "undefined" && typeof globalThis.showCapabilityMapDialog !== "undefined") return;

    // Requires swtImports to be loaded first
    var swt = (typeof swtImports !== "undefined") ? swtImports : null;
    if (!swt) throw new Error("capabilityMapDialog: swtImports must be loaded first");

    var SWT = swt.SWT;
    var Composite = swt.Composite;
    var Group = swt.Group;
    var Label = swt.Label;
    var Button = swt.Button;
    var Combo = swt.Combo;
    var Text = swt.Text;
    var Display = swt.Display;
    var Color = swt.Color;
    var SashForm = swt.SashForm;
    var Tree = swt.Tree;
    var TreeItem = swt.TreeItem;
    var GridDataFactory = swt.GridDataFactory;
    var GridLayoutFactory = swt.GridLayoutFactory;
    var IDialogConstants = swt.IDialogConstants;
    var ExtendedTitleAreaDialog = swt.ExtendedTitleAreaDialog;

    // Import types not in swtImports
    var Spinner = Java.type("org.eclipse.swt.widgets.Spinner");
    var ColorDialog = Java.type("org.eclipse.swt.widgets.ColorDialog");
    var RGB = Java.type("org.eclipse.swt.graphics.RGB");


    // =========================================================================
    // Defaults
    // =========================================================================

    var DEFAULTS = {
        viewName: "Business Capability Map",
        maxDepth: -1,           // -1 = all
        sortMode: "subtrees",   // "subtrees" | "alphabetical"
        minLeafWidth: 120,
        maxLeafWidth: 200,
        leafHeight: 45,
        gap: 8,
        padding: 12,
        showIcon: 0,            // 0 = IF_NO_IMAGE, 1 = ALWAYS, 2 = NEVER
        leafColor: "#E8E8E8",
        depthColors: [
            "#D6E4F0", // Level 0: light blue
            "#D9EAD3", // Level 1: light green
            "#E1D5E7", // Level 2: light lavender
            "#FCE5CD", // Level 3: light peach
            "#FFF2CC", // Level 4: light yellow
            "#F4CCCC"  // Level 5: light pink
        ]
    };

    var SORT_MODES = [
        { id: "subtrees", label: "Subtrees first, then alphabetical" },
        { id: "alphabetical", label: "Alphabetical" }
    ];

    var SHOW_ICON_OPTIONS = [
        { id: 0, label: "If no image" },
        { id: 1, label: "Always" },
        { id: 2, label: "Never" }
    ];

    // =========================================================================
    // Color helpers
    // =========================================================================

    function hexToRgb(hex) {
        return {
            r: parseInt(hex.substring(1, 3), 16),
            g: parseInt(hex.substring(3, 5), 16),
            b: parseInt(hex.substring(5, 7), 16)
        };
    }

    function rgbToHex(r, g, b) {
        function toHex(n) {
            var h = Math.round(n).toString(16);
            return h.length === 1 ? "0" + h : h;
        }
        return "#" + toHex(r) + toHex(g) + toHex(b);
    }

    function hexToColor(display, hex) {
        var c = hexToRgb(hex);
        return new Color(display, c.r, c.g, c.b);
    }

    // =========================================================================
    // Widget helpers
    // =========================================================================

    function createLabeledSpinner(parent, labelText, min, max, defaultVal, increment) {
        var label = new Label(parent, SWT.NONE);
        label.setText(labelText);
        GridDataFactory.swtDefaults().applyTo(label);

        var spinner = new Spinner(parent, SWT.BORDER);
        spinner.setMinimum(min || 0);
        spinner.setMaximum(max || 9999);
        spinner.setSelection(defaultVal || 0);
        spinner.setIncrement(increment || 1);
        spinner.setPageIncrement(increment ? increment * 10 : 10);
        GridDataFactory.fillDefaults().hint(80, SWT.DEFAULT).applyTo(spinner);

        return spinner;
    }

    function createLabeledCombo(parent, labelText, items, defaultIndex) {
        var label = new Label(parent, SWT.NONE);
        label.setText(labelText);
        GridDataFactory.swtDefaults().applyTo(label);

        var combo = new Combo(parent, SWT.DROP_DOWN | SWT.READ_ONLY);
        for (var i = 0; i < items.length; i++) {
            combo.add(items[i].label || items[i]);
        }
        combo.select(defaultIndex || 0);
        GridDataFactory.fillDefaults().grab(true, false).applyTo(combo);

        return combo;
    }

    /**
     * Create a color picker row: Label | colored swatch | "..." button.
     * @param {Object} parent - SWT Composite
     * @param {string} labelText - Label text (e.g., "Level 0:")
     * @param {string} defaultHex - Default color as hex string (e.g., "#D6E4F0")
     * @param {Object} display - SWT Display
     * @param {Array} allocatedColors - Array to track Color objects for disposal
     * @returns {{ swatch: Object, hex: string }} - Object with swatch label and current hex value
     */
    function createColorRow(parent, labelText, defaultHex, display, allocatedColors) {
        var state = { hex: defaultHex };

        var label = new Label(parent, SWT.NONE);
        label.setText(labelText);
        GridDataFactory.swtDefaults().applyTo(label);

        var swatch = new Label(parent, SWT.BORDER);
        swatch.setText("      ");
        GridDataFactory.swtDefaults().hint(50, 20).applyTo(swatch);

        var color = hexToColor(display, defaultHex);
        allocatedColors.push(color);
        swatch.setBackground(color);

        var btn = new Button(parent, SWT.PUSH);
        btn.setText("...");
        GridDataFactory.swtDefaults().hint(30, SWT.DEFAULT).applyTo(btn);

        btn.addSelectionListener({
            widgetSelected: function () {
                var dlg = new ColorDialog(parent.getShell());
                dlg.setText("Pick color for: " + labelText.replace(":", ""));
                var c = hexToRgb(state.hex);
                dlg.setRGB(new RGB(c.r, c.g, c.b));
                var result = dlg.open();
                if (result) {
                    state.hex = rgbToHex(result.red, result.green, result.blue);
                    var newColor = hexToColor(display, state.hex);
                    allocatedColors.push(newColor);
                    swatch.setBackground(newColor);
                }
            },
            widgetDefaultSelected: function () {}
        });

        state.swatch = swatch;
        return state;
    }

    // =========================================================================
    // Tree helpers
    // =========================================================================

    /**
     * Recursively populate SWT TreeItems from tree node data.
     * Each item stores the element ID via setData().
     * Top-level items are checked by default; children are unchecked.
     * @param {boolean} isTopLevel - true for root-level items
     */
    function populateTreeItems(parentWidget, nodes, getNameFn, isTopLevel) {
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            var item = new TreeItem(parentWidget, SWT.NONE);
            item.setText(getNameFn(node.element));
            item.setData(node.element.id);
            item.setChecked(isTopLevel);
            if (node.children && node.children.length > 0) {
                populateTreeItems(item, node.children, getNameFn, false);
            }
        }
    }

    /**
     * Set checked state on all items in the tree recursively.
     */
    function setAllTreeChecked(tree, checked) {
        function setRecursive(items) {
            for (var i = 0; i < items.length; i++) {
                items[i].setChecked(checked);
                setRecursive(items[i].getItems());
            }
        }
        setRecursive(tree.getItems());
    }

    /**
     * Recursively collect IDs of all checked items in the tree.
     */
    function collectCheckedIds(tree) {
        var ids = [];
        function walk(items) {
            for (var i = 0; i < items.length; i++) {
                if (items[i].getChecked()) {
                    ids.push("" + items[i].getData());
                }
                walk(items[i].getItems());
            }
        }
        walk(tree.getItems());
        return ids;
    }

    /**
     * Check whether any item in the tree is checked.
     */
    function hasAnyChecked(tree) {
        function walk(items) {
            for (var i = 0; i < items.length; i++) {
                if (items[i].getChecked()) return true;
                if (walk(items[i].getItems())) return true;
            }
            return false;
        }
        return walk(tree.getItems());
    }

    /**
     * Convert a JS array to a Java int[] for SashForm.setWeights().
     */
    function javaIntArray(arr) {
        var intArrayType = Java.type("int[]");
        var result = new intArrayType(arr.length);
        for (var i = 0; i < arr.length; i++) {
            result[i] = arr[i];
        }
        return result;
    }

    // =========================================================================
    // Dialog
    // =========================================================================

    /**
     * Show the capability map configuration dialog.
     * @param {Object} parentShell - Eclipse SWT Shell
     * @param {number} maxDepth - Maximum depth found in the capability tree
     * @param {number} capabilityCount - Total number of capabilities found
     * @param {Array} trees - Array of root tree nodes (each with .element, .children)
     * @param {Function} getNameFn - Function to get display name for an element
     * @returns {Object|null} Options object (with .selectedRootIds), or null if cancelled
     */
    function showCapabilityMapDialog(parentShell, maxDepth, capabilityCount, trees, getNameFn) {
        var result = null;
        var w = {};
        var allocatedColors = [];
        var display = Display.getCurrent();

        var myDialog = {
            dialog: new ExtendedTitleAreaDialog(parentShell, {
                configureShell: function (newShell) {
                    Java.super(myDialog.dialog).configureShell(newShell);
                    newShell.setText("Build Capability Map");
                    newShell.setMinimumSize(950, 400);
                },

                isResizable: function () {
                    return true;
                },

                getShellStyle: function () {
                    return SWT.CLOSE | SWT.TITLE | SWT.BORDER | SWT.APPLICATION_MODAL | SWT.RESIZE | SWT.MAX;
                },

                createDialogArea: function (parent) {
                    var area = Java.super(myDialog.dialog).createDialogArea(parent);

                    myDialog.dialog.setTitle("Build Capability Map");
                    myDialog.dialog.setMessage(
                        "Found " + capabilityCount + " capabilities with " +
                        maxDepth + " level" + (maxDepth !== 1 ? "s" : "") +
                        " of nesting. Check any capability to use it as a map root."
                    );

                    // Main horizontal split: tree | config
                    var sash = new SashForm(area, SWT.HORIZONTAL);
                    GridDataFactory.fillDefaults().grab(true, true).applyTo(sash);

                    // --- Left panel: Capability tree ---
                    var treePanel = new Composite(sash, SWT.NONE);
                    GridLayoutFactory.fillDefaults().numColumns(1).margins(10, 10).spacing(0, 6).applyTo(treePanel);

                    var treeLabel = new Label(treePanel, SWT.NONE);
                    treeLabel.setText("Select capabilities to map:");
                    GridDataFactory.fillDefaults().applyTo(treeLabel);

                    // Button row
                    var btnRow = new Composite(treePanel, SWT.NONE);
                    GridLayoutFactory.fillDefaults().numColumns(2).margins(0, 0).spacing(6, 0).applyTo(btnRow);
                    GridDataFactory.fillDefaults().applyTo(btnRow);

                    var selectAllBtn = new Button(btnRow, SWT.PUSH);
                    selectAllBtn.setText("Select All");
                    var deselectAllBtn = new Button(btnRow, SWT.PUSH);
                    deselectAllBtn.setText("Deselect All");

                    w.capTree = new Tree(treePanel, SWT.BORDER | SWT.CHECK | SWT.V_SCROLL | SWT.H_SCROLL);
                    GridDataFactory.fillDefaults().grab(true, true).applyTo(w.capTree);

                    // Populate tree — top-level roots checked by default
                    populateTreeItems(w.capTree, trees, getNameFn, true);

                    // Expand root level so children are visible
                    var rootItems = w.capTree.getItems();
                    for (var ri = 0; ri < rootItems.length; ri++) {
                        rootItems[ri].setExpanded(true);
                    }

                    selectAllBtn.addSelectionListener({
                        widgetSelected: function () { setAllTreeChecked(w.capTree, true); },
                        widgetDefaultSelected: function () {}
                    });
                    deselectAllBtn.addSelectionListener({
                        widgetSelected: function () { setAllTreeChecked(w.capTree, false); },
                        widgetDefaultSelected: function () {}
                    });

                    // --- Right panel: Configuration ---
                    var container = new Composite(sash, SWT.NONE);
                    GridLayoutFactory.fillDefaults().numColumns(2).margins(10, 10).spacing(12, 10).applyTo(container);

                    // --- Left config column ---
                    var leftCol = new Composite(container, SWT.NONE);
                    GridLayoutFactory.fillDefaults().numColumns(1).spacing(0, 10).applyTo(leftCol);
                    GridDataFactory.fillDefaults().grab(true, true).align(SWT.FILL, SWT.FILL).applyTo(leftCol);

                    // === General ===
                    var generalGroup = new Group(leftCol, SWT.NONE);
                    generalGroup.setText("General");
                    GridLayoutFactory.fillDefaults().numColumns(2).margins(8, 8).spacing(8, 6).applyTo(generalGroup);
                    GridDataFactory.fillDefaults().grab(true, false).applyTo(generalGroup);

                    var nameLabel = new Label(generalGroup, SWT.NONE);
                    nameLabel.setText("View name:");
                    GridDataFactory.swtDefaults().applyTo(nameLabel);

                    w.viewNameText = new Text(generalGroup, SWT.BORDER);
                    w.viewNameText.setText(DEFAULTS.viewName);
                    GridDataFactory.fillDefaults().grab(true, false).applyTo(w.viewNameText);

                    var depthLabel = new Label(generalGroup, SWT.NONE);
                    depthLabel.setText("Max depth:");
                    GridDataFactory.swtDefaults().applyTo(depthLabel);

                    w.maxDepthCombo = new Combo(generalGroup, SWT.DROP_DOWN | SWT.READ_ONLY);
                    w.maxDepthCombo.add("All");
                    for (var d = 1; d <= maxDepth; d++) {
                        w.maxDepthCombo.add("" + d);
                    }
                    w.maxDepthCombo.select(0);
                    GridDataFactory.fillDefaults().grab(true, false).applyTo(w.maxDepthCombo);

                    w.sortCombo = createLabeledCombo(generalGroup, "Sort children:", SORT_MODES, 0);

                    // === Colors ===
                    var colorGroup = new Group(leftCol, SWT.NONE);
                    colorGroup.setText("Colors");
                    GridLayoutFactory.fillDefaults().numColumns(3).margins(8, 8).spacing(8, 6).applyTo(colorGroup);
                    GridDataFactory.fillDefaults().grab(true, true).applyTo(colorGroup);

                    w.leafColorRow = createColorRow(colorGroup, "Leaf:", DEFAULTS.leafColor, display, allocatedColors);

                    w.depthColorRows = [];
                    for (var i = 0; i <= maxDepth; i++) {
                        var defaultColor = DEFAULTS.depthColors[Math.min(i, DEFAULTS.depthColors.length - 1)];
                        var row = createColorRow(colorGroup, "Level " + i + ":", defaultColor, display, allocatedColors);
                        w.depthColorRows.push(row);
                    }

                    // --- Right config column ---
                    var rightCol = new Composite(container, SWT.NONE);
                    GridLayoutFactory.fillDefaults().numColumns(1).spacing(0, 10).applyTo(rightCol);
                    GridDataFactory.fillDefaults().grab(false, false).align(SWT.FILL, SWT.BEGINNING).applyTo(rightCol);

                    // === Leaf Size ===
                    var leafGroup = new Group(rightCol, SWT.NONE);
                    leafGroup.setText("Leaf Size");
                    GridLayoutFactory.fillDefaults().numColumns(2).margins(8, 8).spacing(8, 6).applyTo(leafGroup);
                    GridDataFactory.fillDefaults().grab(true, false).applyTo(leafGroup);

                    w.minLeafWidth = createLabeledSpinner(leafGroup, "Min width (px):", 50, 300, DEFAULTS.minLeafWidth, 10);
                    w.maxLeafWidth = createLabeledSpinner(leafGroup, "Max width (px):", 100, 500, DEFAULTS.maxLeafWidth, 10);
                    w.leafHeight = createLabeledSpinner(leafGroup, "Height (px):", 20, 150, DEFAULTS.leafHeight, 5);

                    // === Spacing ===
                    var spacingGroup = new Group(rightCol, SWT.NONE);
                    spacingGroup.setText("Spacing");
                    GridLayoutFactory.fillDefaults().numColumns(2).margins(8, 8).spacing(8, 6).applyTo(spacingGroup);
                    GridDataFactory.fillDefaults().grab(true, false).applyTo(spacingGroup);

                    w.gap = createLabeledSpinner(spacingGroup, "Element gap (px):", 2, 40, DEFAULTS.gap, 2);
                    w.padding = createLabeledSpinner(spacingGroup, "Container padding (px):", 4, 40, DEFAULTS.padding, 2);

                    // === Display ===
                    var displayGroup = new Group(rightCol, SWT.NONE);
                    displayGroup.setText("Display");
                    GridLayoutFactory.fillDefaults().numColumns(2).margins(8, 8).spacing(8, 6).applyTo(displayGroup);
                    GridDataFactory.fillDefaults().grab(true, false).applyTo(displayGroup);

                    w.showIconCombo = createLabeledCombo(displayGroup, "Show icon:", SHOW_ICON_OPTIONS, DEFAULTS.showIcon);

                    // Set sash proportions
                    sash.setWeights(javaIntArray([30, 70]));

                    return area;
                },

                createButtonsForButtonBar: function (parent) {
                    myDialog.dialog.createButton(parent, IDialogConstants.OK_ID, "Build Map", true);
                    myDialog.dialog.createButton(parent, IDialogConstants.CANCEL_ID, "Cancel", false);
                },

                getInitialSize: function () {
                    var Point = swt.Point;
                    var colorRowCount = maxDepth + 2; // levels + leaf
                    var estimatedHeight = 500 + colorRowCount * 45;
                    return new Point(1000, estimatedHeight);
                },

                okPressed: function () {
                    if (!hasAnyChecked(w.capTree)) {
                        myDialog.dialog.setErrorMessage("Select at least one capability.");
                        return;
                    }
                    result = collectOptions(w);
                    Java.super(myDialog.dialog).okPressed();
                }
            })
        };

        myDialog.dialog.setHelpAvailable(false);
        myDialog.dialog.open();

        // Dispose colors after dialog closes (dialog is modal, so we're here after it closes)
        for (var i = 0; i < allocatedColors.length; i++) {
            if (!allocatedColors[i].isDisposed()) allocatedColors[i].dispose();
        }

        return result;
    }

    // =========================================================================
    // Collect options
    // =========================================================================

    function collectOptions(w) {
        var depthIdx = w.maxDepthCombo.getSelectionIndex();
        var maxDepthVal = depthIdx === 0 ? -1 : depthIdx; // 0 = "All" => -1

        var sortIdx = w.sortCombo.getSelectionIndex();
        var sortMode = SORT_MODES[sortIdx >= 0 ? sortIdx : 0].id;

        var depthColors = [];
        for (var i = 0; i < w.depthColorRows.length; i++) {
            depthColors.push(w.depthColorRows[i].hex);
        }

        // Collect all checked item IDs (any level can be a map root)
        var selectedRootIds = collectCheckedIds(w.capTree);

        return {
            viewName: w.viewNameText.getText().trim() || DEFAULTS.viewName,
            maxDepth: maxDepthVal,
            sortMode: sortMode,
            minLeafWidth: w.minLeafWidth.getSelection(),
            maxLeafWidth: w.maxLeafWidth.getSelection(),
            leafHeight: w.leafHeight.getSelection(),
            gap: w.gap.getSelection(),
            padding: w.padding.getSelection(),
            showIcon: SHOW_ICON_OPTIONS[w.showIconCombo.getSelectionIndex() >= 0 ? w.showIconCombo.getSelectionIndex() : 0].id,
            leafColor: w.leafColorRow.hex,
            depthColors: depthColors,
            selectedRootIds: selectedRootIds
        };
    }

    // =========================================================================
    // Export
    // =========================================================================

    if (typeof globalThis !== "undefined") globalThis.showCapabilityMapDialog = showCapabilityMapDialog;
    if (typeof module !== "undefined" && module.exports) module.exports = showCapabilityMapDialog;

})();
