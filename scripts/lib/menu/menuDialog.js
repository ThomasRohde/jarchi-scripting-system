/**
 * @module menuDialog
 * @description Main SWT/JFace dialog for the Script Menu.
 * Provides a tree/list view of registered scripts with search, details pane,
 * help browser, selection gating, and keyboard navigation.
 * @version 1.0.0
 */
(function () {
    "use strict";

    if (typeof globalThis !== "undefined" && typeof globalThis.showMenuDialog !== "undefined") return;

    // Requires swtImports to be loaded first
    var swt = (typeof swtImports !== "undefined") ? swtImports : null;
    if (!swt) throw new Error("menuDialog: swtImports must be loaded first");

    var SWT = swt.SWT;
    var Composite = swt.Composite;
    var Label = swt.Label;
    var Button = swt.Button;
    var Text = swt.Text;
    var Tree = swt.Tree;
    var TreeItem = swt.TreeItem;
    var Browser = swt.Browser;
    var SashForm = swt.SashForm;
    var GridDataFactory = swt.GridDataFactory;
    var GridLayoutFactory = swt.GridLayoutFactory;
    var IDialogConstants = swt.IDialogConstants;
    var MessageDialog = swt.MessageDialog;
    var ExtendedTitleAreaDialog = swt.ExtendedTitleAreaDialog;
    var Point = swt.Point;
    var Color = swt.Color;
    var Font = swt.Font;
    var FontData = swt.FontData;
    var Display = swt.Display;
    var Paths = Java.type("java.nio.file.Paths");

    // Custom button IDs
    var RUN_ID = IDialogConstants.OK_ID;
    var OPEN_SCRIPT_ID = IDialogConstants.CLIENT_ID + 1;
    var CLOSE_ID = IDialogConstants.CANCEL_ID;

    // Danger level colors (RGB)
    var DANGER_COLORS = {
        low: null,
        medium: [204, 102, 0],
        high: [204, 0, 0]
    };

    /**
     * Show the Script Menu dialog.
     * @param {Object} parentShell - Eclipse SWT Shell
     * @returns {Object|null} Selected descriptor to run, or null if cancelled
     */
    function showMenuDialog(parentShell) {
        var result = null;
        var w = {}; // Widget references
        var currentDescriptors = [];
        var treeRoot = null;
        var selectedDescriptor = null;
        var selectionInfo = null;
        var isSearchMode = false;
        var searchResults = [];

        // Get layout dimensions
        var layout = menuConfig.getLayout();

        // Capture current selection once
        selectionInfo = selectionGating.captureSelection();

        // Initial scan
        var scanResult = doScan();
        currentDescriptors = scanResult.descriptors;
        treeRoot = categoryTree.build(currentDescriptors);

        function doScan() {
            var registryDir = menuConfig.getRegistryDir();
            var result = registryScanner.scan(registryDir);
            if (result.errors.length > 0) {
                for (var i = 0; i < result.errors.length; i++) {
                    log.warn("Registry: " + result.errors[i]);
                }
            }
            return result;
        }

        var myDialog = {
            dialog: new ExtendedTitleAreaDialog(parentShell, {
                configureShell: function (newShell) {
                    Java.super(myDialog.dialog).configureShell(newShell);
                    newShell.setText("Script Menu");
                    newShell.setMinimumSize(800, 600);
                },

                isResizable: function () {
                    return true;
                },

                createDialogArea: function (parent) {
                    var area = Java.super(myDialog.dialog).createDialogArea(parent);

                    myDialog.dialog.setTitle("Script Menu");
                    myDialog.dialog.setMessage("Select a script to run");

                    // Main container
                    var container = new Composite(area, SWT.NONE);
                    GridLayoutFactory.fillDefaults().margins(10, 10).spacing(8, 8).applyTo(container);
                    GridDataFactory.fillDefaults().grab(true, true).applyTo(container);

                    // =====================================================
                    // Toolbar: Search + Refresh + Expand/Collapse
                    // =====================================================
                    var toolbar = new Composite(container, SWT.NONE);
                    GridLayoutFactory.fillDefaults().numColumns(4).spacing(6, 0).applyTo(toolbar);
                    GridDataFactory.fillDefaults().grab(true, false).applyTo(toolbar);

                    w.searchText = new Text(toolbar, SWT.BORDER | SWT.SEARCH | SWT.ICON_SEARCH | SWT.ICON_CANCEL);
                    w.searchText.setMessage("Search scripts...");
                    GridDataFactory.fillDefaults().grab(true, false).applyTo(w.searchText);

                    var refreshBtn = new Button(toolbar, SWT.PUSH);
                    refreshBtn.setText("Refresh");
                    GridDataFactory.swtDefaults().applyTo(refreshBtn);

                    var expandBtn = new Button(toolbar, SWT.PUSH);
                    expandBtn.setText("\u25BC");
                    expandBtn.setToolTipText("Expand All");
                    GridDataFactory.swtDefaults().applyTo(expandBtn);

                    var collapseBtn = new Button(toolbar, SWT.PUSH);
                    collapseBtn.setText("\u25B2");
                    collapseBtn.setToolTipText("Collapse All");
                    GridDataFactory.swtDefaults().applyTo(collapseBtn);

                    // =====================================================
                    // Main SashForm: Left (tree/list) | Right (details+help)
                    // =====================================================
                    w.mainSash = new SashForm(container, SWT.HORIZONTAL);
                    GridDataFactory.fillDefaults().grab(true, true).applyTo(w.mainSash);

                    // --- Left pane: Tree ---
                    w.tree = new Tree(w.mainSash, SWT.BORDER | SWT.SINGLE | SWT.V_SCROLL);

                    // --- Right pane: Details + Help ---
                    w.detailSash = new SashForm(w.mainSash, SWT.VERTICAL);

                    // Details composite (top of right pane)
                    var detailComp = new Composite(w.detailSash, SWT.BORDER);
                    GridLayoutFactory.fillDefaults().margins(10, 8).spacing(4, 4).applyTo(detailComp);

                    w.titleLabel = new Label(detailComp, SWT.WRAP);
                    var display = Display.getCurrent();
                    var boldFontData = w.titleLabel.getFont().getFontData();
                    boldFontData[0].setStyle(SWT.BOLD);
                    boldFontData[0].setHeight(boldFontData[0].getHeight() + 2);
                    w.titleFont = new Font(display, boldFontData[0]);
                    w.titleLabel.setFont(w.titleFont);
                    GridDataFactory.fillDefaults().grab(true, false).applyTo(w.titleLabel);

                    w.descriptionLabel = new Label(detailComp, SWT.WRAP);
                    GridDataFactory.fillDefaults().grab(true, false).hint(300, SWT.DEFAULT).applyTo(w.descriptionLabel);

                    var sep1 = new Label(detailComp, SWT.SEPARATOR | SWT.HORIZONTAL);
                    GridDataFactory.fillDefaults().grab(true, false).applyTo(sep1);

                    w.categoryLabel = new Label(detailComp, SWT.NONE);
                    GridDataFactory.fillDefaults().grab(true, false).applyTo(w.categoryLabel);

                    w.tagsLabel = new Label(detailComp, SWT.WRAP);
                    GridDataFactory.fillDefaults().grab(true, false).applyTo(w.tagsLabel);

                    w.dangerLabel = new Label(detailComp, SWT.NONE);
                    GridDataFactory.fillDefaults().grab(true, false).applyTo(w.dangerLabel);

                    var sep2 = new Label(detailComp, SWT.SEPARATOR | SWT.HORIZONTAL);
                    GridDataFactory.fillDefaults().grab(true, false).applyTo(sep2);

                    w.selectionReqLabel = new Label(detailComp, SWT.WRAP);
                    GridDataFactory.fillDefaults().grab(true, false).hint(300, SWT.DEFAULT).applyTo(w.selectionReqLabel);

                    w.gatingStatusLabel = new Label(detailComp, SWT.WRAP);
                    GridDataFactory.fillDefaults().grab(true, false).hint(300, SWT.DEFAULT).applyTo(w.gatingStatusLabel);

                    // Help browser (bottom of right pane)
                    var helpComp = new Composite(w.detailSash, SWT.NONE);
                    GridLayoutFactory.fillDefaults().margins(0, 0).applyTo(helpComp);

                    try {
                        w.helpBrowser = new Browser(helpComp, SWT.NONE);
                        GridDataFactory.fillDefaults().grab(true, true).applyTo(w.helpBrowser);
                        w.helpBrowser.setText(markdownRenderer.render(null));
                    } catch (browserErr) {
                        // Browser widget not available — fallback to label
                        w.helpBrowser = null;
                        w.helpFallback = new Label(helpComp, SWT.WRAP | SWT.V_SCROLL);
                        w.helpFallback.setText("(Help browser not available)");
                        GridDataFactory.fillDefaults().grab(true, true).applyTo(w.helpFallback);
                    }

                    // Set sash weights
                    w.mainSash.setWeights(javaIntArray(layout.sashWeights));
                    w.detailSash.setWeights(javaIntArray(layout.detailSashWeights));

                    // =====================================================
                    // Populate tree
                    // =====================================================
                    buildTreeItems(w.tree, treeRoot);
                    expandAll(w.tree);
                    clearDetails();

                    // =====================================================
                    // Event listeners
                    // =====================================================

                    // Search
                    w.searchText.addModifyListener(function () {
                        var query = String(w.searchText.getText()).trim();
                        if (query.length === 0) {
                            // Return to tree mode
                            isSearchMode = false;
                            w.tree.removeAll();
                            buildTreeItems(w.tree, treeRoot);
                            expandAll(w.tree);
                            selectedDescriptor = null;
                            clearDetails();
                            updateButtons();
                        } else {
                            // Switch to flat search results
                            isSearchMode = true;
                            searchResults = fuzzySearch.search(query, currentDescriptors);
                            w.tree.removeAll();
                            for (var i = 0; i < searchResults.length; i++) {
                                var desc = searchResults[i].descriptor;
                                var item = new TreeItem(w.tree, SWT.NONE);
                                item.setText(desc.title + "  \u2014  " + desc.category.join(" > "));
                                item.setData(desc);
                            }
                            // Auto-select first result
                            if (searchResults.length > 0) {
                                w.tree.select(w.tree.getItem(0));
                                onScriptSelected(searchResults[0].descriptor);
                            } else {
                                selectedDescriptor = null;
                                clearDetails();
                            }
                            updateButtons();
                        }
                    });

                    // Tree selection
                    w.tree.addSelectionListener({
                        widgetSelected: function () {
                            var items = w.tree.getSelection();
                            if (items.length > 0) {
                                var data = items[0].getData();
                                if (data && data.id) {
                                    onScriptSelected(data);
                                } else {
                                    selectedDescriptor = null;
                                    clearDetails();
                                }
                            }
                            updateButtons();
                        },
                        widgetDefaultSelected: function () {
                            // Double-click or Enter on tree → run
                            if (selectedDescriptor) {
                                attemptRun();
                            }
                        }
                    });

                    // Refresh
                    refreshBtn.addSelectionListener({
                        widgetSelected: function () {
                            var scan = doScan();
                            currentDescriptors = scan.descriptors;
                            treeRoot = categoryTree.build(currentDescriptors);
                            selectionInfo = selectionGating.captureSelection();
                            w.searchText.setText("");
                            w.tree.removeAll();
                            buildTreeItems(w.tree, treeRoot);
                            expandAll(w.tree);
                            selectedDescriptor = null;
                            clearDetails();
                            updateButtons();
                            myDialog.dialog.setMessage("Registry refreshed (" + currentDescriptors.length + " scripts)");
                        },
                        widgetDefaultSelected: function () {}
                    });

                    // Expand All
                    expandBtn.addSelectionListener({
                        widgetSelected: function () { expandAll(w.tree); },
                        widgetDefaultSelected: function () {}
                    });

                    // Collapse All
                    collapseBtn.addSelectionListener({
                        widgetSelected: function () { collapseAll(w.tree); },
                        widgetDefaultSelected: function () {}
                    });

                    // =====================================================
                    // Keyboard shortcuts
                    // =====================================================
                    w.searchText.addKeyListener({
                        keyPressed: function (e) {
                            if (e.keyCode === SWT.ESC) {
                                if (String(w.searchText.getText()).length > 0) {
                                    w.searchText.setText("");
                                } else {
                                    myDialog.dialog.close();
                                }
                            } else if (e.keyCode === SWT.ARROW_DOWN) {
                                w.tree.setFocus();
                                if (w.tree.getItemCount() > 0) {
                                    w.tree.select(w.tree.getItem(0));
                                    var data = w.tree.getItem(0).getData();
                                    if (data && data.id) onScriptSelected(data);
                                    updateButtons();
                                }
                            } else if (e.keyCode === SWT.CR || e.keyCode === SWT.KEYPAD_CR) {
                                if (selectedDescriptor) {
                                    attemptRun();
                                }
                            }
                        },
                        keyReleased: function () {}
                    });

                    w.tree.addKeyListener({
                        keyPressed: function (e) {
                            if (e.keyCode === SWT.ESC) {
                                if (isSearchMode) {
                                    w.searchText.setText("");
                                    w.searchText.setFocus();
                                } else {
                                    myDialog.dialog.close();
                                }
                            } else if (e.stateMask === SWT.CTRL && (e.keyCode === 102 || e.keyCode === 70)) {
                                // Ctrl+F
                                w.searchText.setFocus();
                                w.searchText.selectAll();
                            } else if (e.keyCode === SWT.F1) {
                                if (w.helpBrowser) {
                                    w.helpBrowser.setFocus();
                                }
                            }
                        },
                        keyReleased: function () {}
                    });

                    // Focus search on dialog open
                    parent.getDisplay().asyncExec(function () {
                        if (!w.searchText.isDisposed()) {
                            w.searchText.setFocus();
                        }
                    });

                    return area;
                },

                createButtonsForButtonBar: function (parent) {
                    w.runButton = myDialog.dialog.createButton(parent, RUN_ID, "Run", true);
                    w.openScriptButton = myDialog.dialog.createButton(parent, OPEN_SCRIPT_ID, "Open Script", false);
                    myDialog.dialog.createButton(parent, CLOSE_ID, "Close", false);
                    updateButtons();
                },

                getInitialSize: function () {
                    return new Point(layout.width, layout.height);
                },

                buttonPressed: function (buttonId) {
                    if (buttonId === RUN_ID) {
                        attemptRun();
                    } else if (buttonId === OPEN_SCRIPT_ID) {
                        openScript();
                    } else {
                        Java.super(myDialog.dialog).buttonPressed(buttonId);
                    }
                },

                close: function () {
                    // Dispose font
                    if (w.titleFont && !w.titleFont.isDisposed()) {
                        w.titleFont.dispose();
                    }
                    return Java.super(myDialog.dialog).close();
                }
            })
        };

        // =====================================================
        // Helper functions
        // =====================================================

        function onScriptSelected(descriptor) {
            selectedDescriptor = descriptor;

            // Update details
            w.titleLabel.setText(descriptor.title);
            w.descriptionLabel.setText(descriptor.description || "");
            w.categoryLabel.setText("Category: " + descriptor.category.join(" > "));

            var tagsText = (descriptor.tags && descriptor.tags.length > 0)
                ? "Tags: " + descriptor.tags.join(", ")
                : "";
            w.tagsLabel.setText(tagsText);

            // Danger level
            var dangerLevel = descriptor.run.danger_level || "low";
            if (dangerLevel === "high") {
                w.dangerLabel.setText("\u26A0 DANGER: High risk — confirmation required");
            } else if (dangerLevel === "medium") {
                w.dangerLabel.setText("\u26A0 Caution: Medium risk");
            } else {
                w.dangerLabel.setText("");
            }

            // Selection requirements
            w.selectionReqLabel.setText("Selection: " + selectionGating.formatRules(descriptor.selection));

            // Check gating
            var gateResult = selectionGating.checkRules(selectionInfo, descriptor.selection);
            if (gateResult.allowed) {
                w.gatingStatusLabel.setText("\u2713 Selection requirements met");
            } else {
                w.gatingStatusLabel.setText("\u2717 " + gateResult.reason);
            }

            // Update help
            loadHelp(descriptor);

            // Layout detail pane
            w.titleLabel.getParent().layout(true);
        }

        function clearDetails() {
            w.titleLabel.setText("Select a script");
            w.descriptionLabel.setText("Choose a script from the tree to view details and help.");
            w.categoryLabel.setText("");
            w.tagsLabel.setText("");
            w.dangerLabel.setText("");
            w.selectionReqLabel.setText("");
            w.gatingStatusLabel.setText("");
            if (w.helpBrowser) {
                w.helpBrowser.setText(markdownRenderer.render(null));
            } else if (w.helpFallback) {
                w.helpFallback.setText("");
            }
        }

        function loadHelp(descriptor) {
            var helpPath = descriptor.help.markdown_path;
            var html;
            if (helpPath && helpPath.length > 0) {
                // Resolve relative to registry dir with containment check
                var registryDir = menuConfig.getRegistryDir();
                var resolved = Paths.get(registryDir, helpPath).normalize();
                var base = Paths.get(registryDir).getParent().normalize();
                if (!resolved.startsWith(base)) {
                    html = markdownRenderer.render("# Error\n\nHelp path is outside the allowed directory.");
                } else {
                    html = markdownRenderer.renderFile(String(resolved));
                }
            } else {
                // No help file — show description as markdown
                if (descriptor.description) {
                    html = markdownRenderer.render("# " + descriptor.title + "\n\n" + descriptor.description);
                } else {
                    html = markdownRenderer.render(null);
                }
            }

            if (w.helpBrowser) {
                w.helpBrowser.setText(html);
            } else if (w.helpFallback) {
                w.helpFallback.setText(descriptor.description || "No help available.");
            }
        }

        function updateButtons() {
            if (!w.runButton || w.runButton.isDisposed()) return;

            if (!selectedDescriptor) {
                w.runButton.setEnabled(false);
                w.openScriptButton.setEnabled(false);
                return;
            }

            w.openScriptButton.setEnabled(true);

            var gateResult = selectionGating.checkRules(selectionInfo, selectedDescriptor.selection);
            w.runButton.setEnabled(gateResult.allowed);
        }

        function attemptRun() {
            if (!selectedDescriptor) return;

            // Re-check gating with fresh selection
            selectionInfo = selectionGating.captureSelection();
            var gateResult = selectionGating.checkRules(selectionInfo, selectedDescriptor.selection);
            if (!gateResult.allowed) {
                MessageDialog.openWarning(
                    parentShell,
                    "Cannot Run Script",
                    "Selection requirements not met:\n\n" + gateResult.reason
                );
                return;
            }

            // Danger confirmation for high
            if (selectedDescriptor.run.danger_level === "high") {
                var message = selectedDescriptor.run.confirm_message
                    || "This script is marked as high risk. Are you sure you want to run it?";
                var confirmed = MessageDialog.openConfirm(
                    parentShell,
                    "Confirm: " + selectedDescriptor.title,
                    message
                );
                if (!confirmed) return;
            }

            result = selectedDescriptor;
            Java.super(myDialog.dialog).okPressed();
        }

        function openScript() {
            if (!selectedDescriptor) return;
            var scriptsRoot = menuConfig.getScriptsRoot();
            var scriptPath = scriptsRoot + selectedDescriptor.script.path;
            try {
                var Desktop = Java.type("java.awt.Desktop");
                var JFile = Java.type("java.io.File");
                Desktop.getDesktop().open(new JFile(scriptPath));
            } catch (e) {
                log.warn("Could not open script file: " + e);
            }
        }

        // =====================================================
        // Tree building
        // =====================================================

        function buildTreeItems(treeWidget, rootNode) {
            for (var i = 0; i < rootNode.children.length; i++) {
                buildTreeItemRecursive(treeWidget, rootNode.children[i]);
            }
        }

        function buildTreeItemRecursive(parent, node) {
            var item = new TreeItem(parent, SWT.NONE);

            if (node.isCategory) {
                item.setText(node.label);
                item.setData(null); // Category nodes have no descriptor
                for (var i = 0; i < node.children.length; i++) {
                    buildTreeItemRecursive(item, node.children[i]);
                }
            } else {
                item.setText(node.label);
                item.setData(node.descriptor);
            }
        }

        function expandAll(treeWidget) {
            var items = treeWidget.getItems();
            for (var i = 0; i < items.length; i++) {
                expandItemRecursive(items[i]);
            }
        }

        function expandItemRecursive(item) {
            item.setExpanded(true);
            var children = item.getItems();
            for (var i = 0; i < children.length; i++) {
                expandItemRecursive(children[i]);
            }
        }

        function collapseAll(treeWidget) {
            var items = treeWidget.getItems();
            for (var i = 0; i < items.length; i++) {
                collapseItemRecursive(items[i]);
            }
        }

        function collapseItemRecursive(item) {
            item.setExpanded(false);
            var children = item.getItems();
            for (var i = 0; i < children.length; i++) {
                collapseItemRecursive(children[i]);
            }
        }

        /**
         * Convert a JS array to a Java int[] for SashForm.setWeights().
         */
        function javaIntArray(arr) {
            var intArray = Java.type("int[]");
            var result = new intArray(arr.length);
            for (var i = 0; i < arr.length; i++) {
                result[i] = arr[i];
            }
            return result;
        }

        // =====================================================
        // Open dialog
        // =====================================================
        myDialog.dialog.setHelpAvailable(false);
        myDialog.dialog.open();
        return result;
    }

    // Export
    if (typeof globalThis !== "undefined") globalThis.showMenuDialog = showMenuDialog;
    if (typeof module !== "undefined" && module.exports) module.exports = showMenuDialog;
})();
