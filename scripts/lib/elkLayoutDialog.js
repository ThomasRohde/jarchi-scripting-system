/**
 * @module elkLayoutDialog
 * @description Eclipse-quality SWT dialog for configuring ELK layout options.
 * Provides a comprehensive TitleAreaDialog with tabbed option panels for
 * algorithm selection, spacing, edge routing, ports, and advanced settings.
 * @version 1.0.0
 * @author Thomas Rohde
 * @lastModifiedDate 2026-02-14
 */
(function () {
    "use strict";

    if (typeof globalThis !== "undefined" && typeof globalThis.showElkLayoutDialog !== "undefined") return;

    // Requires swtImports to be loaded first
    var swt = (typeof swtImports !== "undefined") ? swtImports : null;
    if (!swt) throw new Error("elkLayoutDialog: swtImports must be loaded first");

    var SWT = swt.SWT;
    var Composite = swt.Composite;
    var Label = swt.Label;
    var Button = swt.Button;
    var Combo = swt.Combo;
    var TabFolder = swt.TabFolder;
    var TabItem = swt.TabItem;
    var GridDataFactory = swt.GridDataFactory;
    var GridLayoutFactory = swt.GridLayoutFactory;
    var IDialogConstants = swt.IDialogConstants;
    var MessageDialog = swt.MessageDialog;
    var InputDialog = swt.InputDialog;
    var ExtendedTitleAreaDialog = swt.ExtendedTitleAreaDialog;

    // Import Spinner directly — not in swtImports
    var Spinner = Java.type("org.eclipse.swt.widgets.Spinner");
    var StackLayout = Java.type("org.eclipse.swt.custom.StackLayout");

    // =========================================================================
    // Default values
    // =========================================================================

    // -----------------------------------------------------------------------
    // Opinionated defaults tuned for ArchiMate diagram aesthetics:
    //   - Generous spacing so elements (120×55) have breathing room
    //   - Orthogonal routing + orthogonal connection style for a clean EA look
    //   - Network-simplex node placement for balanced, symmetric layers
    //   - Feedback edges enabled (ArchiMate models commonly have cycles)
    //   - Center port alignment for tidy connection attachment points
    // -----------------------------------------------------------------------
    var DEFAULTS = {
        algorithm: "layered",
        direction: "DOWN",

        // Spacing — roomy enough for standard ArchiMate elements
        nodeNodeSpacing: 60,
        edgeEdgeSpacing: 15,
        edgeNodeSpacing: 20,
        componentSpacing: 50,
        betweenLayerSpacing: 80,
        edgeNodeBetweenLayers: 25,
        padding: 30,

        // Edges — orthogonal is the EA standard
        edgeRouting: "ORTHOGONAL",
        mergeEdges: false,
        separateComponents: true,
        connectionStyle: "orthogonal",

        // Ports — centered attachment looks cleaner on wide ArchiMate elements
        portConstraints: "FIXED_SIDE",
        portAlignment: "CENTER",
        portAssignment: "direction",
        portSpacing: 12,

        // Layered — network-simplex placement produces balanced, compact layers
        crossingMinimization: "LAYER_SWEEP",
        nodePlacement: "NETWORK_SIMPLEX",
        layeringStrategy: "NETWORK_SIMPLEX",
        compaction: "NONE",
        wrapping: "NONE",
        feedbackEdges: true,

        // Stress — wider spacing for readability at ArchiMate scale
        stressDesiredEdgeLength: 200,
        stressIterations: 300,

        // Force
        forceIterations: 300,
        forceRepulsivePower: 0,

        // MrTree
        mrtreeWeighting: "MODEL_ORDER",
        mrtreeSearchOrder: "DFS",

        // Options
        hierarchy: "flat",
        applyBendpoints: true,
        setManualRouter: true,
        aspectRatio: 1.6,
        preserveSizes: true
    };

    // =========================================================================
    // Algorithm metadata
    // =========================================================================

    var ALGORITHMS = [
        { id: "layered", label: "Layered (Sugiyama)" },
        { id: "stress", label: "Stress Minimization" },
        { id: "mrtree", label: "MrTree" },
        { id: "radial", label: "Radial" },
        { id: "force", label: "Force-Directed" }
    ];

    var DIRECTIONS = ["DOWN", "UP", "LEFT", "RIGHT"];

    var EDGE_ROUTING = [
        { id: "ORTHOGONAL", label: "Orthogonal" },
        { id: "POLYLINE", label: "Polyline" },
        { id: "SPLINES", label: "Splines" },
        { id: "UNDEFINED", label: "Undefined (algorithm default)" }
    ];

    var PORT_CONSTRAINTS = [
        { id: "FREE", label: "Free" },
        { id: "FIXED_SIDE", label: "Fixed Side" },
        { id: "FIXED_ORDER", label: "Fixed Order" },
        { id: "FIXED_POS", label: "Fixed Position" },
        { id: "FIXED_RATIO", label: "Fixed Ratio" }
    ];

    var PORT_ALIGNMENT = [
        { id: "DISTRIBUTED", label: "Distributed" },
        { id: "BEGIN", label: "Begin" },
        { id: "CENTER", label: "Center" },
        { id: "END", label: "End" },
        { id: "JUSTIFIED", label: "Justified" }
    ];

    var PORT_ASSIGNMENT = [
        { id: "direction", label: "By Direction (auto)" },
        { id: "type", label: "By Relationship Type" },
        { id: "none", label: "None (free placement)" }
    ];

    var CONNECTION_STYLES = [
        { id: "none", label: "Don't change" },
        { id: "straight", label: "Straight" },
        { id: "orthogonal", label: "Orthogonal" },
        { id: "curved", label: "Curved" }
    ];

    var CROSSING_MIN = [
        { id: "LAYER_SWEEP", label: "Layer Sweep" },
        { id: "INTERACTIVE", label: "Interactive" }
    ];

    var NODE_PLACEMENT = [
        { id: "BRANDES_KOEPF", label: "Brandes & Kopf" },
        { id: "LINEAR_SEGMENTS", label: "Linear Segments" },
        { id: "NETWORK_SIMPLEX", label: "Network Simplex" },
        { id: "SIMPLE", label: "Simple" }
    ];

    var LAYERING_STRATEGY = [
        { id: "NETWORK_SIMPLEX", label: "Network Simplex" },
        { id: "LONGEST_PATH", label: "Longest Path" },
        { id: "INTERACTIVE", label: "Interactive" },
        { id: "MIN_WIDTH", label: "Minimize Width" }
    ];

    var COMPACTION = [
        { id: "NONE", label: "None" },
        { id: "EDGE_LENGTH", label: "Edge Length" }
    ];

    var WRAPPING = [
        { id: "NONE", label: "None" },
        { id: "SINGLE_EDGE", label: "Single Edge" },
        { id: "MULTI_EDGE", label: "Multi Edge" }
    ];

    var MRTREE_WEIGHTING = [
        { id: "MODEL_ORDER", label: "Model Order" },
        { id: "CONSTRAINT", label: "Constraint" }
    ];

    var MRTREE_SEARCH = [
        { id: "DFS", label: "Depth First" },
        { id: "BFS", label: "Breadth First" }
    ];

    var HIERARCHY_OPTIONS = [
        { id: "flat", label: "Flat (ignore nesting)" },
        { id: "hierarchical", label: "Hierarchical (respect groups)" }
    ];

    // =========================================================================
    // Widget helpers
    // =========================================================================

    /**
     * Create a labeled combo box.
     * @returns {Object} The Combo widget
     */
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
     * Create a labeled spinner.
     * @returns {Object} The Spinner widget
     */
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

    /**
     * Create a labeled checkbox.
     * @returns {Object} The Button widget
     */
    function createCheckbox(parent, labelText, defaultVal) {
        var check = new Button(parent, SWT.CHECK);
        check.setText(labelText);
        check.setSelection(defaultVal || false);
        GridDataFactory.fillDefaults().span(2, 1).applyTo(check);
        return check;
    }

    /**
     * Create a separator.
     */
    function createSeparator(parent, columns) {
        var sep = new Label(parent, SWT.SEPARATOR | SWT.HORIZONTAL);
        GridDataFactory.fillDefaults().span(columns || 2, 1).grab(true, false).applyTo(sep);
    }

    /**
     * Create a description label.
     */
    function createDescription(parent, text, columns) {
        var desc = new Label(parent, SWT.WRAP);
        desc.setText(text);
        GridDataFactory.fillDefaults().span(columns || 2, 1).grab(true, false).hint(400, SWT.DEFAULT).applyTo(desc);
    }

    /**
     * Find the index of an item by id in an array of {id, label} objects.
     */
    function findIndex(items, id) {
        for (var i = 0; i < items.length; i++) {
            if (items[i].id === id || items[i] === id) return i;
        }
        return 0;
    }

    /**
     * Get the selected id from a combo backed by an items array.
     */
    function getComboValue(combo, items) {
        var idx = combo.getSelectionIndex();
        if (idx < 0) idx = 0;
        return items[idx].id || items[idx];
    }

    // =========================================================================
    // Template helpers
    // =========================================================================

    /**
     * Apply a template's core fields to the dialog widgets.
     * @param {Object} template - Template object with 18 core fields
     * @param {Object} w - Widget references
     */
    function applyTemplateToWidgets(template, w) {
        // Algorithm + Direction
        w.algorithmCombo.select(findIndex(ALGORITHMS, template.algorithm));
        w.directionCombo.select(findIndex(DIRECTIONS, template.direction));

        // Spacing
        w.nodeNodeSpacing.setSelection(template.nodeNodeSpacing);
        w.edgeEdgeSpacing.setSelection(template.edgeEdgeSpacing);
        w.edgeNodeSpacing.setSelection(template.edgeNodeSpacing);
        w.componentSpacing.setSelection(template.componentSpacing);
        w.betweenLayerSpacing.setSelection(template.betweenLayerSpacing);
        w.edgeNodeBetweenLayers.setSelection(template.edgeNodeBetweenLayers);
        w.paddingSpinner.setSelection(template.padding);

        // Edges
        w.edgeRoutingCombo.select(findIndex(EDGE_ROUTING, template.edgeRouting));
        w.connectionStyleCombo.select(findIndex(CONNECTION_STYLES, template.connectionStyle));
        w.mergeEdgesCheck.setSelection(!!template.mergeEdges);
        w.separateComponentsCheck.setSelection(template.separateComponents !== false);

        // Ports
        w.portConstraintsCombo.select(findIndex(PORT_CONSTRAINTS, template.portConstraints));
        w.portAlignmentCombo.select(findIndex(PORT_ALIGNMENT, template.portAlignment));
        w.portAssignmentCombo.select(findIndex(PORT_ASSIGNMENT, template.portAssignment));
        w.portSpacingSpinner.setSelection(template.portSpacing);

        // Hierarchy (in Options tab)
        w.hierarchyCombo.select(findIndex(HIERARCHY_OPTIONS, template.hierarchy));

        // Update algorithm panel visibility
        updateAlgorithmPanel(w);
    }

    /**
     * Collect just the 18 core template fields from the dialog widgets.
     * @param {Object} w - Widget references
     * @returns {Object} Core options object (without name)
     */
    function collectCoreOptions(w) {
        return {
            algorithm: getComboValue(w.algorithmCombo, ALGORITHMS),
            direction: DIRECTIONS[w.directionCombo.getSelectionIndex()] || "DOWN",
            nodeNodeSpacing: w.nodeNodeSpacing.getSelection(),
            edgeEdgeSpacing: w.edgeEdgeSpacing.getSelection(),
            edgeNodeSpacing: w.edgeNodeSpacing.getSelection(),
            componentSpacing: w.componentSpacing.getSelection(),
            betweenLayerSpacing: w.betweenLayerSpacing.getSelection(),
            edgeNodeBetweenLayers: w.edgeNodeBetweenLayers.getSelection(),
            padding: w.paddingSpinner.getSelection(),
            edgeRouting: getComboValue(w.edgeRoutingCombo, EDGE_ROUTING),
            mergeEdges: w.mergeEdgesCheck.getSelection(),
            separateComponents: w.separateComponentsCheck.getSelection(),
            connectionStyle: getComboValue(w.connectionStyleCombo, CONNECTION_STYLES),
            portConstraints: getComboValue(w.portConstraintsCombo, PORT_CONSTRAINTS),
            portAlignment: getComboValue(w.portAlignmentCombo, PORT_ALIGNMENT),
            portAssignment: getComboValue(w.portAssignmentCombo, PORT_ASSIGNMENT),
            portSpacing: w.portSpacingSpinner.getSelection(),
            hierarchy: getComboValue(w.hierarchyCombo, HIERARCHY_OPTIONS)
        };
    }

    /**
     * Rebuild the template combo items from a templates array.
     * @param {Object} w - Widget references (needs w.templateCombo)
     * @param {Array} templates - Current templates array
     * @param {number} [selectIndex] - Index to select (0 = "— Custom —")
     */
    function refreshTemplateCombo(w, templates, selectIndex) {
        w.templateCombo.removeAll();
        w.templateCombo.add("\u2014 Custom \u2014");
        for (var i = 0; i < templates.length; i++) {
            w.templateCombo.add(templates[i].name);
        }
        w.templateCombo.select(selectIndex || 0);
    }

    // =========================================================================
    // Dialog
    // =========================================================================

    /**
     * Show the ELK layout options dialog.
     * @param {Object} parentShell - Eclipse SWT Shell
     * @returns {Object|null} Options object, or null if cancelled
     */
    function showElkLayoutDialog(parentShell) {
        var result = null;
        var w = {}; // Widget references

        // Load templates from disk (or built-in defaults)
        var currentTemplates = elkTemplates.loadTemplates();

        var myDialog = {
            dialog: new ExtendedTitleAreaDialog(parentShell, {
                configureShell: function (newShell) {
                    Java.super(myDialog.dialog).configureShell(newShell);
                    newShell.setText("ELK Graph Layout");
                },

                isResizable: function () {
                    return true;
                },

                createDialogArea: function (parent) {
                    var area = Java.super(myDialog.dialog).createDialogArea(parent);

                    myDialog.dialog.setTitle("ELK Graph Layout");
                    myDialog.dialog.setMessage("Configure automatic layout options for the active view.");

                    // Main container
                    var container = new Composite(area, SWT.NONE);
                    GridLayoutFactory.fillDefaults().numColumns(4).margins(10, 10).spacing(10, 8).applyTo(container);
                    GridDataFactory.fillDefaults().grab(true, true).applyTo(container);

                    // =====================================================
                    // Template bar
                    // =====================================================
                    var templateBar = new Composite(container, SWT.NONE);
                    GridLayoutFactory.fillDefaults().numColumns(4).spacing(8, 0).applyTo(templateBar);
                    GridDataFactory.fillDefaults().grab(true, false).span(4, 1).applyTo(templateBar);

                    var tplLabel = new Label(templateBar, SWT.NONE);
                    tplLabel.setText("Template:");
                    GridDataFactory.swtDefaults().applyTo(tplLabel);

                    w.templateCombo = new Combo(templateBar, SWT.DROP_DOWN | SWT.READ_ONLY);
                    GridDataFactory.fillDefaults().grab(true, false).applyTo(w.templateCombo);
                    refreshTemplateCombo(w, currentTemplates, 0);

                    var saveAsBtn = new Button(templateBar, SWT.PUSH);
                    saveAsBtn.setText("Save As...");
                    GridDataFactory.swtDefaults().applyTo(saveAsBtn);

                    var manageBtn = new Button(templateBar, SWT.PUSH);
                    manageBtn.setText("Manage...");
                    GridDataFactory.swtDefaults().applyTo(manageBtn);

                    // --- Template combo selection ---
                    w.templateCombo.addSelectionListener({
                        widgetSelected: function () {
                            var idx = w.templateCombo.getSelectionIndex();
                            if (idx > 0 && idx <= currentTemplates.length) {
                                applyTemplateToWidgets(currentTemplates[idx - 1], w);
                            }
                        },
                        widgetDefaultSelected: function () {}
                    });

                    // --- Save As button ---
                    saveAsBtn.addSelectionListener({
                        widgetSelected: function () {
                            var tplIdx = w.templateCombo.getSelectionIndex();
                            var defaultName = (tplIdx > 0) ? currentTemplates[tplIdx - 1].name : "";

                            var dlg = new InputDialog(
                                parentShell,
                                "Save As Template",
                                "Enter a name for this template:",
                                defaultName,
                                null
                            );
                            if (dlg.open() !== 0) return; // cancelled

                            var name = dlg.getValue().trim();
                            if (name.length === 0) return;

                            // Check for existing template with same name
                            var existingIdx = -1;
                            for (var i = 0; i < currentTemplates.length; i++) {
                                if (currentTemplates[i].name === name) {
                                    existingIdx = i;
                                    break;
                                }
                            }

                            if (existingIdx >= 0) {
                                var overwrite = MessageDialog.openConfirm(
                                    parentShell,
                                    "Overwrite Template",
                                    "A template named \"" + name + "\" already exists.\n\nOverwrite it?"
                                );
                                if (!overwrite) return;
                            }

                            var coreOpts = collectCoreOptions(w);
                            var newTpl = elkTemplates.createTemplate(name, coreOpts);

                            if (existingIdx >= 0) {
                                currentTemplates[existingIdx] = newTpl;
                            } else {
                                currentTemplates.push(newTpl);
                                existingIdx = currentTemplates.length - 1;
                            }

                            elkTemplates.saveTemplates(currentTemplates);
                            var selectIdx = (existingIdx >= 0) ? existingIdx + 1 : currentTemplates.length;
                            refreshTemplateCombo(w, currentTemplates, selectIdx);
                        },
                        widgetDefaultSelected: function () {}
                    });

                    // --- Manage button ---
                    manageBtn.addSelectionListener({
                        widgetSelected: function () {
                            var updated = showElkTemplateManagerDialog(parentShell, currentTemplates);
                            if (updated) {
                                currentTemplates = updated;
                                elkTemplates.saveTemplates(currentTemplates);
                                refreshTemplateCombo(w, currentTemplates, 0);
                            }
                        },
                        widgetDefaultSelected: function () {}
                    });

                    createSeparator(container, 4);

                    // =====================================================
                    // Top section: Algorithm + Direction
                    // =====================================================
                    w.algorithmCombo = createLabeledCombo(
                        container, "Algorithm:",
                        ALGORITHMS, findIndex(ALGORITHMS, DEFAULTS.algorithm)
                    );

                    w.directionCombo = createLabeledCombo(
                        container, "Direction:",
                        DIRECTIONS, findIndex(DIRECTIONS, DEFAULTS.direction)
                    );

                    createSeparator(container, 4);

                    // =====================================================
                    // Tab folder
                    // =====================================================
                    var tabFolder = new TabFolder(container, SWT.NONE);
                    GridDataFactory.fillDefaults().grab(true, true).span(4, 1).hint(SWT.DEFAULT, 400).applyTo(tabFolder);

                    // --- Tab 1: Spacing ---
                    createSpacingTab(tabFolder, w);

                    // --- Tab 2: Edges ---
                    createEdgesTab(tabFolder, w);

                    // --- Tab 3: Ports ---
                    createPortsTab(tabFolder, w);

                    // --- Tab 4: Algorithm-specific ---
                    createAlgorithmTab(tabFolder, w);

                    // --- Tab 5: Options ---
                    createOptionsTab(tabFolder, w);

                    // --- Algorithm change listener ---
                    w.algorithmCombo.addSelectionListener({
                        widgetSelected: function () {
                            updateAlgorithmPanel(w);
                        },
                        widgetDefaultSelected: function () {}
                    });

                    // Initialize algorithm panel visibility
                    updateAlgorithmPanel(w);

                    return area;
                },

                createButtonsForButtonBar: function (parent) {
                    myDialog.dialog.createButton(parent, IDialogConstants.OK_ID, "Apply Layout", true);
                    myDialog.dialog.createButton(parent, IDialogConstants.CANCEL_ID, "Cancel", false);
                },

                getInitialSize: function () {
                    var Point = swt.Point;
                    return new Point(580, 830);
                },

                okPressed: function () {
                    result = collectOptions(w);
                    Java.super(myDialog.dialog).okPressed();
                }
            })
        };

        myDialog.dialog.setHelpAvailable(false);
        myDialog.dialog.open();
        return result;
    }

    // =========================================================================
    // Tab creators
    // =========================================================================

    function createSpacingTab(tabFolder, w) {
        var tab = new TabItem(tabFolder, SWT.NONE);
        tab.setText("Spacing");

        var comp = new Composite(tabFolder, SWT.NONE);
        GridLayoutFactory.fillDefaults().numColumns(2).margins(10, 10).spacing(8, 6).applyTo(comp);
        tab.setControl(comp);

        createDescription(comp,
            "Control the spacing between nodes, edges, and layers in the layout.");

        w.nodeNodeSpacing = createLabeledSpinner(comp, "Node-Node:", 0, 500, DEFAULTS.nodeNodeSpacing, 5);
        w.edgeEdgeSpacing = createLabeledSpinner(comp, "Edge-Edge:", 0, 200, DEFAULTS.edgeEdgeSpacing, 2);
        w.edgeNodeSpacing = createLabeledSpinner(comp, "Edge-Node:", 0, 200, DEFAULTS.edgeNodeSpacing, 2);
        w.componentSpacing = createLabeledSpinner(comp, "Component-Component:", 0, 500, DEFAULTS.componentSpacing, 5);

        createSeparator(comp);

        var layeredLabel = new Label(comp, SWT.NONE);
        layeredLabel.setText("Layered algorithm:");
        GridDataFactory.fillDefaults().span(2, 1).applyTo(layeredLabel);

        w.betweenLayerSpacing = createLabeledSpinner(comp, "Between Layers (nodes):", 0, 500, DEFAULTS.betweenLayerSpacing, 5);
        w.edgeNodeBetweenLayers = createLabeledSpinner(comp, "Between Layers (edge-node):", 0, 200, DEFAULTS.edgeNodeBetweenLayers, 2);

        createSeparator(comp);

        w.paddingSpinner = createLabeledSpinner(comp, "Padding:", 0, 200, DEFAULTS.padding, 5);
    }

    function createEdgesTab(tabFolder, w) {
        var tab = new TabItem(tabFolder, SWT.NONE);
        tab.setText("Edges");

        var comp = new Composite(tabFolder, SWT.NONE);
        GridLayoutFactory.fillDefaults().numColumns(2).margins(10, 10).spacing(8, 6).applyTo(comp);
        tab.setControl(comp);

        createDescription(comp,
            "Configure how edges (connections) are routed between elements.");

        w.edgeRoutingCombo = createLabeledCombo(comp, "Edge Routing:",
            EDGE_ROUTING, findIndex(EDGE_ROUTING, DEFAULTS.edgeRouting));

        w.connectionStyleCombo = createLabeledCombo(comp, "Connection Style After Layout:",
            CONNECTION_STYLES, findIndex(CONNECTION_STYLES, DEFAULTS.connectionStyle));

        createSeparator(comp);

        w.mergeEdgesCheck = createCheckbox(comp, "Merge parallel edges between same nodes", DEFAULTS.mergeEdges);
        w.separateComponentsCheck = createCheckbox(comp, "Separate disconnected components", DEFAULTS.separateComponents);
    }

    function createPortsTab(tabFolder, w) {
        var tab = new TabItem(tabFolder, SWT.NONE);
        tab.setText("Ports");

        var comp = new Composite(tabFolder, SWT.NONE);
        GridLayoutFactory.fillDefaults().numColumns(2).margins(10, 10).spacing(8, 6).applyTo(comp);
        tab.setControl(comp);

        createDescription(comp,
            "Ports control where connections attach to elements. Each connection " +
            "endpoint gets a dedicated port, giving ELK precise control over " +
            "edge routing to produce clean, non-overlapping connections.");

        w.portConstraintsCombo = createLabeledCombo(comp, "Port Constraints:",
            PORT_CONSTRAINTS, findIndex(PORT_CONSTRAINTS, DEFAULTS.portConstraints));

        w.portAlignmentCombo = createLabeledCombo(comp, "Port Alignment:",
            PORT_ALIGNMENT, findIndex(PORT_ALIGNMENT, DEFAULTS.portAlignment));

        w.portAssignmentCombo = createLabeledCombo(comp, "Port Side Assignment:",
            PORT_ASSIGNMENT, findIndex(PORT_ASSIGNMENT, DEFAULTS.portAssignment));

        w.portSpacingSpinner = createLabeledSpinner(comp, "Port Spacing:", 0, 100, DEFAULTS.portSpacing, 2);

        createSeparator(comp);

        createDescription(comp,
            "FIXED_SIDE: Ports are assigned to a side (N/S/E/W) but can slide along it.\n" +
            "FIXED_ORDER: Ports are fixed to a side with a defined order.\n" +
            "FREE: ELK decides optimal port positions.");
    }

    function createAlgorithmTab(tabFolder, w) {
        var tab = new TabItem(tabFolder, SWT.NONE);
        tab.setText("Algorithm");

        var outerComp = new Composite(tabFolder, SWT.NONE);
        GridLayoutFactory.fillDefaults().margins(0, 0).applyTo(outerComp);
        tab.setControl(outerComp);

        // Stack layout to swap between algorithm panels
        w.algoStackLayout = new StackLayout();
        outerComp.setLayout(w.algoStackLayout);
        w.algoStackParent = outerComp;

        // --- Layered panel ---
        w.layeredPanel = createLayeredPanel(outerComp, w);

        // --- Stress panel ---
        w.stressPanel = createStressPanel(outerComp, w);

        // --- Force panel ---
        w.forcePanel = createForcePanel(outerComp, w);

        // --- MrTree panel ---
        w.mrtreePanel = createMrTreePanel(outerComp, w);

        // --- Radial panel ---
        w.radialPanel = createRadialPanel(outerComp, w);

        // Default: show layered
        w.algoStackLayout.topControl = w.layeredPanel;
    }

    function createLayeredPanel(parent, w) {
        var comp = new Composite(parent, SWT.NONE);
        GridLayoutFactory.fillDefaults().numColumns(2).margins(10, 10).spacing(8, 6).applyTo(comp);

        createDescription(comp,
            "The Layered algorithm (Sugiyama) organizes nodes in horizontal or " +
            "vertical layers. It excels at showing directed flow and hierarchy.");

        w.layeringCombo = createLabeledCombo(comp, "Layering Strategy:",
            LAYERING_STRATEGY, findIndex(LAYERING_STRATEGY, DEFAULTS.layeringStrategy));

        w.nodePlacementCombo = createLabeledCombo(comp, "Node Placement:",
            NODE_PLACEMENT, findIndex(NODE_PLACEMENT, DEFAULTS.nodePlacement));

        w.crossingMinCombo = createLabeledCombo(comp, "Crossing Minimization:",
            CROSSING_MIN, findIndex(CROSSING_MIN, DEFAULTS.crossingMinimization));

        w.compactionCombo = createLabeledCombo(comp, "Post-Compaction:",
            COMPACTION, findIndex(COMPACTION, DEFAULTS.compaction));

        w.wrappingCombo = createLabeledCombo(comp, "Wrapping:",
            WRAPPING, findIndex(WRAPPING, DEFAULTS.wrapping));

        createSeparator(comp);

        w.feedbackEdgesCheck = createCheckbox(comp, "Handle feedback edges (cycles)", DEFAULTS.feedbackEdges);

        return comp;
    }

    function createStressPanel(parent, w) {
        var comp = new Composite(parent, SWT.NONE);
        GridLayoutFactory.fillDefaults().numColumns(2).margins(10, 10).spacing(8, 6).applyTo(comp);

        createDescription(comp,
            "Stress Minimization produces aesthetically pleasing layouts by minimizing " +
            "the stress (deviation from ideal edge lengths) in the graph.");

        w.stressEdgeLengthSpinner = createLabeledSpinner(comp, "Desired Edge Length:", 10, 1000, DEFAULTS.stressDesiredEdgeLength, 10);
        w.stressIterationsSpinner = createLabeledSpinner(comp, "Iterations:", 10, 5000, DEFAULTS.stressIterations, 50);

        return comp;
    }

    function createForcePanel(parent, w) {
        var comp = new Composite(parent, SWT.NONE);
        GridLayoutFactory.fillDefaults().numColumns(2).margins(10, 10).spacing(8, 6).applyTo(comp);

        createDescription(comp,
            "Force-Directed layout simulates physical forces: nodes repel each other " +
            "while edges act as springs pulling connected nodes together.");

        w.forceIterationsSpinner = createLabeledSpinner(comp, "Iterations:", 10, 5000, DEFAULTS.forceIterations, 50);
        w.forceRepulsiveSpinner = createLabeledSpinner(comp, "Repulsive Power:", 0, 100, DEFAULTS.forceRepulsivePower, 1);

        return comp;
    }

    function createMrTreePanel(parent, w) {
        var comp = new Composite(parent, SWT.NONE);
        GridLayoutFactory.fillDefaults().numColumns(2).margins(10, 10).spacing(8, 6).applyTo(comp);

        createDescription(comp,
            "MrTree computes a tree layout using a minimum spanning tree approach. " +
            "Best for graphs with a clear tree-like structure.");

        w.mrtreeWeightingCombo = createLabeledCombo(comp, "Weighting:",
            MRTREE_WEIGHTING, findIndex(MRTREE_WEIGHTING, DEFAULTS.mrtreeWeighting));

        w.mrtreeSearchCombo = createLabeledCombo(comp, "Search Order:",
            MRTREE_SEARCH, findIndex(MRTREE_SEARCH, DEFAULTS.mrtreeSearchOrder));

        return comp;
    }

    function createRadialPanel(parent, w) {
        var comp = new Composite(parent, SWT.NONE);
        GridLayoutFactory.fillDefaults().numColumns(2).margins(10, 10).spacing(8, 6).applyTo(comp);

        createDescription(comp,
            "Radial layout arranges nodes in concentric circles around a central node. " +
            "Good for visualizing hierarchies radiating from a center.");

        return comp;
    }

    function createOptionsTab(tabFolder, w) {
        var tab = new TabItem(tabFolder, SWT.NONE);
        tab.setText("Options");

        var comp = new Composite(tabFolder, SWT.NONE);
        GridLayoutFactory.fillDefaults().numColumns(2).margins(10, 10).spacing(8, 6).applyTo(comp);
        tab.setControl(comp);

        createDescription(comp,
            "General layout options controlling hierarchy handling and output.");

        w.hierarchyCombo = createLabeledCombo(comp, "Hierarchy:",
            HIERARCHY_OPTIONS, findIndex(HIERARCHY_OPTIONS, DEFAULTS.hierarchy));

        w.aspectRatioSpinner = createLabeledSpinner(comp, "Aspect Ratio (x10):", 1, 100,
            Math.round(DEFAULTS.aspectRatio * 10), 1);

        createSeparator(comp);

        w.applyBendpointsCheck = createCheckbox(comp, "Apply bendpoints from edge routing", DEFAULTS.applyBendpoints);
        w.setManualRouterCheck = createCheckbox(comp, "Set view connection router to Manual", DEFAULTS.setManualRouter);
        w.preserveSizesCheck = createCheckbox(comp, "Preserve existing element sizes", DEFAULTS.preserveSizes);
    }

    // =========================================================================
    // Dynamic updates
    // =========================================================================

    function updateAlgorithmPanel(w) {
        var algoId = getComboValue(w.algorithmCombo, ALGORITHMS);
        var panels = {
            "layered": w.layeredPanel,
            "stress": w.stressPanel,
            "force": w.forcePanel,
            "mrtree": w.mrtreePanel,
            "radial": w.radialPanel
        };

        var panel = panels[algoId] || w.layeredPanel;
        w.algoStackLayout.topControl = panel;
        w.algoStackParent.layout();
    }

    // =========================================================================
    // Collect options
    // =========================================================================

    function collectOptions(w) {
        var opts = {};

        // Top-level
        opts.algorithm = getComboValue(w.algorithmCombo, ALGORITHMS);
        opts.direction = DIRECTIONS[w.directionCombo.getSelectionIndex()] || "DOWN";

        // Spacing
        opts.nodeNodeSpacing = w.nodeNodeSpacing.getSelection();
        opts.edgeEdgeSpacing = w.edgeEdgeSpacing.getSelection();
        opts.edgeNodeSpacing = w.edgeNodeSpacing.getSelection();
        opts.componentSpacing = w.componentSpacing.getSelection();
        opts.betweenLayerSpacing = w.betweenLayerSpacing.getSelection();
        opts.edgeNodeBetweenLayers = w.edgeNodeBetweenLayers.getSelection();
        opts.padding = w.paddingSpinner.getSelection();

        // Edges
        opts.edgeRouting = getComboValue(w.edgeRoutingCombo, EDGE_ROUTING);
        opts.connectionStyle = getComboValue(w.connectionStyleCombo, CONNECTION_STYLES);
        opts.mergeEdges = w.mergeEdgesCheck.getSelection();
        opts.separateComponents = w.separateComponentsCheck.getSelection();

        // Ports
        opts.portConstraints = getComboValue(w.portConstraintsCombo, PORT_CONSTRAINTS);
        opts.portAlignment = getComboValue(w.portAlignmentCombo, PORT_ALIGNMENT);
        opts.portAssignment = getComboValue(w.portAssignmentCombo, PORT_ASSIGNMENT);
        opts.portSpacing = w.portSpacingSpinner.getSelection();

        // Layered
        opts.crossingMinimization = getComboValue(w.crossingMinCombo, CROSSING_MIN);
        opts.nodePlacement = getComboValue(w.nodePlacementCombo, NODE_PLACEMENT);
        opts.layeringStrategy = getComboValue(w.layeringCombo, LAYERING_STRATEGY);
        opts.compaction = getComboValue(w.compactionCombo, COMPACTION);
        opts.wrapping = getComboValue(w.wrappingCombo, WRAPPING);
        opts.feedbackEdges = w.feedbackEdgesCheck.getSelection();

        // Stress
        opts.stressDesiredEdgeLength = w.stressEdgeLengthSpinner.getSelection();
        opts.stressIterations = w.stressIterationsSpinner.getSelection();

        // Force
        opts.forceIterations = w.forceIterationsSpinner.getSelection();
        opts.forceRepulsivePower = w.forceRepulsiveSpinner.getSelection();

        // MrTree
        opts.mrtreeWeighting = getComboValue(w.mrtreeWeightingCombo, MRTREE_WEIGHTING);
        opts.mrtreeSearchOrder = getComboValue(w.mrtreeSearchCombo, MRTREE_SEARCH);

        // Options
        opts.hierarchy = getComboValue(w.hierarchyCombo, HIERARCHY_OPTIONS);
        opts.aspectRatio = w.aspectRatioSpinner.getSelection() / 10.0;
        opts.applyBendpoints = w.applyBendpointsCheck.getSelection();
        opts.setManualRouter = w.setManualRouterCheck.getSelection();
        opts.preserveSizes = w.preserveSizesCheck.getSelection();

        return opts;
    }

    // =========================================================================
    // Export
    // =========================================================================

    if (typeof globalThis !== "undefined") globalThis.showElkLayoutDialog = showElkLayoutDialog;
    if (typeof module !== "undefined" && module.exports) module.exports = showElkLayoutDialog;

})();
