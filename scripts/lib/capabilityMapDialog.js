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
    var FontDialog = Java.type("org.eclipse.swt.widgets.FontDialog");
    var FontData = Java.type("org.eclipse.swt.graphics.FontData");
    var Font = Java.type("org.eclipse.swt.graphics.Font");
    var FontDataArray = Java.type("org.eclipse.swt.graphics.FontData[]");


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
        showIcon: 2,            // 1 = ALWAYS, 2 = NEVER
        alignment: "center",
        parentFont: { name: "Segoe UI", size: 9, style: "bold", color: null },
        leafFont: { name: "Segoe UI", size: 9, style: "", color: null },
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
        { id: 1, label: "Always" },
        { id: 2, label: "Never" }
    ];

    var ALIGNMENT_OPTIONS = [
        { id: "left", label: "Left" },
        { id: "center", label: "Center" },
        { id: "right", label: "Right" }
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

    /**
     * Convert a font style string ("bold", "italic", "bold|italic", "") to SWT style bitmask.
     */
    function fontStyleToSWT(style) {
        if (style === "bold") return SWT.BOLD;
        if (style === "italic") return SWT.ITALIC;
        if (style === "bold|italic") return Number(SWT.BOLD) | Number(SWT.ITALIC);
        return SWT.NORMAL;
    }

    /**
     * Build a human-readable description of a font state.
     */
    function fontDescription(state) {
        var desc = state.name + ", " + state.size + "pt";
        if (state.style === "bold") desc += ", Bold";
        else if (state.style === "italic") desc += ", Italic";
        else if (state.style === "bold|italic") desc += ", Bold Italic";
        return desc;
    }

    /**
     * Create a font picker row: Label | description text | "..." button.
     * Opens the system FontDialog (with color) on click.
     * @param {Object} parent - SWT Composite (3-column layout)
     * @param {string} labelText - Label text (e.g., "Parent:")
     * @param {Object} defaultFont - { name, size, style, color }
     * @param {Object} display - SWT Display
     * @param {Array} allocatedResources - Array to track Font/Color objects for disposal
     * @returns {{ name, size, style, color }} - Mutable state object
     */
    function createFontRow(parent, labelText, defaultFont, display, allocatedResources) {
        var state = { name: defaultFont.name, size: defaultFont.size, style: defaultFont.style, color: defaultFont.color };

        var label = new Label(parent, SWT.NONE);
        label.setText(labelText);
        GridDataFactory.swtDefaults().applyTo(label);

        var preview = new Label(parent, SWT.NONE);
        GridDataFactory.fillDefaults().grab(true, false).applyTo(preview);

        var btn = new Button(parent, SWT.PUSH);
        btn.setText("...");
        GridDataFactory.swtDefaults().hint(30, SWT.DEFAULT).applyTo(btn);

        function updatePreview() {
            preview.setText(fontDescription(state));
            var font = new Font(display, new FontData(state.name, state.size, fontStyleToSWT(state.style)));
            allocatedResources.push(font);
            preview.setFont(font);
            if (state.color) {
                var color = hexToColor(display, state.color);
                allocatedResources.push(color);
                preview.setForeground(color);
            } else {
                preview.setForeground(null);
            }
        }

        updatePreview();

        btn.addSelectionListener({
            widgetSelected: function () {
                var dlg = new FontDialog(parent.getShell());
                dlg.setText("Pick font for: " + labelText.replace(":", ""));

                var fdArr = new FontDataArray(1);
                fdArr[0] = new FontData(state.name, state.size, fontStyleToSWT(state.style));
                dlg.setFontList(fdArr);

                if (state.color) {
                    var c = hexToRgb(state.color);
                    dlg.setRGB(new RGB(c.r, c.g, c.b));
                }

                var result = dlg.open();
                if (result) {
                    state.name = "" + result.getName();
                    state.size = result.getHeight();
                    var s = Number(result.getStyle());
                    if ((s & Number(SWT.BOLD)) !== 0 && (s & Number(SWT.ITALIC)) !== 0) state.style = "bold|italic";
                    else if ((s & Number(SWT.BOLD)) !== 0) state.style = "bold";
                    else if ((s & Number(SWT.ITALIC)) !== 0) state.style = "italic";
                    else state.style = "";

                    var rgb = dlg.getRGB();
                    if (rgb) {
                        state.color = rgbToHex(rgb.red, rgb.green, rgb.blue);
                    }
                    updatePreview();
                }
            },
            widgetDefaultSelected: function () {}
        });

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
                    // Layout: General spanning full width on top,
                    // then Colors (left) beside Leaf Size / Spacing / Display (right)
                    var configPanel = new Composite(sash, SWT.NONE);
                    GridLayoutFactory.fillDefaults().numColumns(2).margins(10, 10).spacing(12, 10).applyTo(configPanel);

                    // === General (spans both columns) ===
                    var generalGroup = new Group(configPanel, SWT.NONE);
                    generalGroup.setText("General");
                    GridLayoutFactory.fillDefaults().numColumns(2).margins(8, 8).spacing(8, 6).applyTo(generalGroup);
                    GridDataFactory.fillDefaults().grab(true, false).span(2, 1).applyTo(generalGroup);

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

                    // === Colors (left of bottom row) ===
                    var colorGroup = new Group(configPanel, SWT.NONE);
                    colorGroup.setText("Colors");
                    GridLayoutFactory.fillDefaults().numColumns(3).margins(8, 8).spacing(8, 6).applyTo(colorGroup);
                    GridDataFactory.fillDefaults().grab(false, true).align(SWT.FILL, SWT.BEGINNING).applyTo(colorGroup);

                    w.leafColorRow = createColorRow(colorGroup, "Leaf:", DEFAULTS.leafColor, display, allocatedColors);

                    w.depthColorRows = [];
                    for (var i = 0; i <= maxDepth; i++) {
                        var defaultColor = DEFAULTS.depthColors[Math.min(i, DEFAULTS.depthColors.length - 1)];
                        var row = createColorRow(colorGroup, "Level " + i + ":", defaultColor, display, allocatedColors);
                        w.depthColorRows.push(row);
                    }

                    // === Right config column ===
                    // Leaf Size | Fonts on top, then Spacing | Display below
                    var rightCol = new Composite(configPanel, SWT.NONE);
                    GridLayoutFactory.fillDefaults().numColumns(2).spacing(12, 10).applyTo(rightCol);
                    GridDataFactory.fillDefaults().grab(true, false).align(SWT.FILL, SWT.BEGINNING).applyTo(rightCol);

                    // === Leaf Size (left) ===
                    var leafGroup = new Group(rightCol, SWT.NONE);
                    leafGroup.setText("Leaf Size");
                    GridLayoutFactory.fillDefaults().numColumns(2).margins(8, 8).spacing(8, 6).applyTo(leafGroup);
                    GridDataFactory.fillDefaults().grab(true, false).applyTo(leafGroup);

                    w.minLeafWidth = createLabeledSpinner(leafGroup, "Min width (px):", 50, 300, DEFAULTS.minLeafWidth, 10);
                    w.maxLeafWidth = createLabeledSpinner(leafGroup, "Max width (px):", 100, 500, DEFAULTS.maxLeafWidth, 10);
                    w.leafHeight = createLabeledSpinner(leafGroup, "Height (px):", 20, 150, DEFAULTS.leafHeight, 5);

                    // === Fonts (right, beside Leaf Size) ===
                    var fontGroup = new Group(rightCol, SWT.NONE);
                    fontGroup.setText("Fonts");
                    GridLayoutFactory.fillDefaults().numColumns(3).margins(8, 8).spacing(8, 6).applyTo(fontGroup);
                    GridDataFactory.fillDefaults().grab(true, false).applyTo(fontGroup);

                    w.parentFontRow = createFontRow(fontGroup, "Parent:", DEFAULTS.parentFont, display, allocatedColors);
                    w.leafFontRow = createFontRow(fontGroup, "Leaf:", DEFAULTS.leafFont, display, allocatedColors);

                    // === Spacing (left) ===
                    var spacingGroup = new Group(rightCol, SWT.NONE);
                    spacingGroup.setText("Spacing");
                    GridLayoutFactory.fillDefaults().numColumns(2).margins(8, 8).spacing(8, 6).applyTo(spacingGroup);
                    GridDataFactory.fillDefaults().grab(true, false).applyTo(spacingGroup);

                    w.gap = createLabeledSpinner(spacingGroup, "Element gap (px):", 2, 40, DEFAULTS.gap, 2);
                    w.padding = createLabeledSpinner(spacingGroup, "Container padding (px):", 4, 40, DEFAULTS.padding, 2);

                    // === Display (right) ===
                    var displayGroup = new Group(rightCol, SWT.NONE);
                    displayGroup.setText("Display");
                    GridLayoutFactory.fillDefaults().numColumns(2).margins(8, 8).spacing(8, 6).applyTo(displayGroup);
                    GridDataFactory.fillDefaults().grab(true, false).applyTo(displayGroup);

                    var iconLabel = new Label(displayGroup, SWT.NONE);
                    iconLabel.setText("Show icon:");
                    GridDataFactory.swtDefaults().applyTo(iconLabel);

                    var iconRadioRow = new Composite(displayGroup, SWT.NONE);
                    GridLayoutFactory.fillDefaults().numColumns(SHOW_ICON_OPTIONS.length).spacing(12, 0).applyTo(iconRadioRow);
                    GridDataFactory.fillDefaults().grab(true, false).applyTo(iconRadioRow);

                    w.showIconRadios = [];
                    for (var si = 0; si < SHOW_ICON_OPTIONS.length; si++) {
                        var radio = new Button(iconRadioRow, SWT.RADIO);
                        radio.setText(SHOW_ICON_OPTIONS[si].label);
                        radio.setSelection(SHOW_ICON_OPTIONS[si].id === DEFAULTS.showIcon);
                        w.showIconRadios.push(radio);
                    }
                    
                    var defaultAlignIdx = DEFAULTS.alignment === "left" ? 0 : (DEFAULTS.alignment === "right" ? 2 : 1);
                    w.alignmentCombo = createLabeledCombo(displayGroup, "Row alignment:", ALIGNMENT_OPTIONS, defaultAlignIdx);

                    // Set sash proportions
                    sash.setWeights(javaIntArray([40, 60]));

                    return area;
                },

                createButtonsForButtonBar: function (parent) {
                    myDialog.dialog.createButton(parent, IDialogConstants.OK_ID, "Build Map", true);
                    myDialog.dialog.createButton(parent, IDialogConstants.CANCEL_ID, "Cancel", false);
                },

                getInitialSize: function () {
                    var Point = swt.Point;
                    return new Point(1500, 900);
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
            showIcon: (function () {
                for (var i = 0; i < w.showIconRadios.length; i++) {
                    if (w.showIconRadios[i].getSelection()) return SHOW_ICON_OPTIONS[i].id;
                }
                return DEFAULTS.showIcon;
            })(),
            alignment: ALIGNMENT_OPTIONS[w.alignmentCombo.getSelectionIndex() >= 0 ? w.alignmentCombo.getSelectionIndex() : 1].id,
            parentFont: { name: w.parentFontRow.name, size: w.parentFontRow.size, style: w.parentFontRow.style, color: w.parentFontRow.color },
            leafFont: { name: w.leafFontRow.name, size: w.leafFontRow.size, style: w.leafFontRow.style, color: w.leafFontRow.color },
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
