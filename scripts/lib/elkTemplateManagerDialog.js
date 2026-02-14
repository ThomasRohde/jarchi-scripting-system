/**
 * @module elkTemplateManagerDialog
 * @description SWT dialog for managing ELK layout templates. Provides a table listing
 * all templates with buttons for rename, duplicate, delete, reorder, and reset to defaults.
 * @version 1.0.0
 * @author Thomas Rohde
 * @lastModifiedDate 2026-02-14
 */
(function () {
    "use strict";

    if (typeof globalThis !== "undefined" && typeof globalThis.showElkTemplateManagerDialog !== "undefined") return;

    var swt = (typeof swtImports !== "undefined") ? swtImports : null;
    if (!swt) throw new Error("elkTemplateManagerDialog: swtImports must be loaded first");

    var SWT = swt.SWT;
    var Composite = swt.Composite;
    var Label = swt.Label;
    var Button = swt.Button;
    var Table = swt.Table;
    var TableItem = swt.TableItem;
    var TableColumn = swt.TableColumn;
    var GridDataFactory = swt.GridDataFactory;
    var GridLayoutFactory = swt.GridLayoutFactory;
    var IDialogConstants = swt.IDialogConstants;
    var MessageDialog = swt.MessageDialog;
    var InputDialog = swt.InputDialog;
    var ExtendedTitleAreaDialog = swt.ExtendedTitleAreaDialog;

    // =========================================================================
    // Helpers
    // =========================================================================

    /**
     * Rebuild all table items from the templates array.
     * @param {Object} table - SWT Table widget
     * @param {Array} templates - Array of template objects
     */
    function refreshTable(table, templates) {
        table.removeAll();
        for (var i = 0; i < templates.length; i++) {
            var item = new TableItem(table, SWT.NONE);
            item.setText(templates[i].name);
        }
    }

    /**
     * Update button enabled states based on table selection.
     * @param {Object} table - SWT Table
     * @param {Object} buttons - Button reference map
     * @param {Array} templates - Current templates array
     */
    function updateButtons(table, buttons, templates) {
        var idx = table.getSelectionIndex();
        var hasSelection = idx >= 0;
        var count = templates.length;

        buttons.renameBtn.setEnabled(hasSelection);
        buttons.duplicateBtn.setEnabled(hasSelection);
        buttons.deleteBtn.setEnabled(hasSelection && count > 1);
        buttons.moveUpBtn.setEnabled(hasSelection && idx > 0);
        buttons.moveDownBtn.setEnabled(hasSelection && idx < count - 1);
    }

    /**
     * Create a push button in a vertical button bar.
     * @param {Object} parent - Parent composite
     * @param {string} text - Button label
     * @returns {Object} SWT Button widget
     */
    function createBarButton(parent, text) {
        var btn = new Button(parent, SWT.PUSH);
        btn.setText(text);
        GridDataFactory.fillDefaults().grab(true, false).applyTo(btn);
        return btn;
    }

    // =========================================================================
    // Dialog
    // =========================================================================

    /**
     * Show the template manager dialog.
     * @param {Object} parentShell - Eclipse SWT Shell
     * @param {Array} templates - Current templates array (will be deep-copied)
     * @returns {Array|null} Updated templates array on OK, null on Cancel
     */
    function showElkTemplateManagerDialog(parentShell, templates) {
        var result = null;
        var workingCopy = JSON.parse(JSON.stringify(templates));
        var table;
        var buttons = {};

        var myDialog = {
            dialog: new ExtendedTitleAreaDialog(parentShell, {
                configureShell: function (newShell) {
                    Java.super(myDialog.dialog).configureShell(newShell);
                    newShell.setText("Manage Layout Templates");
                },

                isResizable: function () {
                    return true;
                },

                createDialogArea: function (parent) {
                    var area = Java.super(myDialog.dialog).createDialogArea(parent);

                    myDialog.dialog.setTitle("Manage Layout Templates");
                    myDialog.dialog.setMessage("Rename, reorder, duplicate, or delete layout templates.");

                    // Main container: 2 columns (table | buttons)
                    var container = new Composite(area, SWT.NONE);
                    GridLayoutFactory.fillDefaults().numColumns(2).margins(10, 10).spacing(10, 8).applyTo(container);
                    GridDataFactory.fillDefaults().grab(true, true).applyTo(container);

                    // --- Table ---
                    table = new Table(container, SWT.BORDER | SWT.SINGLE | SWT.FULL_SELECTION);
                    table.setHeaderVisible(true);
                    table.setLinesVisible(true);
                    GridDataFactory.fillDefaults().grab(true, true).hint(300, 350).applyTo(table);

                    var nameCol = new TableColumn(table, SWT.NONE);
                    nameCol.setText("Template Name");
                    nameCol.setWidth(280);

                    refreshTable(table, workingCopy);

                    // --- Button bar ---
                    var btnComp = new Composite(container, SWT.NONE);
                    GridLayoutFactory.fillDefaults().numColumns(1).spacing(0, 4).applyTo(btnComp);
                    GridDataFactory.fillDefaults().align(SWT.FILL, SWT.BEGINNING).applyTo(btnComp);

                    buttons.renameBtn = createBarButton(btnComp, "Rename...");
                    buttons.duplicateBtn = createBarButton(btnComp, "Duplicate");
                    buttons.deleteBtn = createBarButton(btnComp, "Delete");

                    // Separator
                    var sep1 = new Label(btnComp, SWT.SEPARATOR | SWT.HORIZONTAL);
                    GridDataFactory.fillDefaults().grab(true, false).applyTo(sep1);

                    buttons.moveUpBtn = createBarButton(btnComp, "Move Up");
                    buttons.moveDownBtn = createBarButton(btnComp, "Move Down");

                    var sep2 = new Label(btnComp, SWT.SEPARATOR | SWT.HORIZONTAL);
                    GridDataFactory.fillDefaults().grab(true, false).applyTo(sep2);

                    var resetBtn = createBarButton(btnComp, "Reset All...");

                    // --- Initial button state ---
                    updateButtons(table, buttons, workingCopy);

                    // --- Listeners ---

                    table.addSelectionListener({
                        widgetSelected: function () {
                            updateButtons(table, buttons, workingCopy);
                        },
                        widgetDefaultSelected: function () {}
                    });

                    buttons.renameBtn.addSelectionListener({
                        widgetSelected: function () {
                            var idx = table.getSelectionIndex();
                            if (idx < 0) return;

                            var dlg = new InputDialog(
                                parentShell,
                                "Rename Template",
                                "Enter a new name for the template:",
                                workingCopy[idx].name,
                                null
                            );
                            if (dlg.open() === 0) { // OK
                                var newName = dlg.getValue().trim();
                                if (newName.length > 0) {
                                    workingCopy[idx].name = newName;
                                    refreshTable(table, workingCopy);
                                    table.select(idx);
                                    updateButtons(table, buttons, workingCopy);
                                }
                            }
                        },
                        widgetDefaultSelected: function () {}
                    });

                    buttons.duplicateBtn.addSelectionListener({
                        widgetSelected: function () {
                            var idx = table.getSelectionIndex();
                            if (idx < 0) return;

                            var copy = JSON.parse(JSON.stringify(workingCopy[idx]));
                            copy.name = "Copy of " + copy.name;
                            workingCopy.splice(idx + 1, 0, copy);
                            refreshTable(table, workingCopy);
                            table.select(idx + 1);
                            updateButtons(table, buttons, workingCopy);
                        },
                        widgetDefaultSelected: function () {}
                    });

                    buttons.deleteBtn.addSelectionListener({
                        widgetSelected: function () {
                            var idx = table.getSelectionIndex();
                            if (idx < 0 || workingCopy.length <= 1) return;

                            var confirmed = MessageDialog.openConfirm(
                                parentShell,
                                "Delete Template",
                                "Delete template \"" + workingCopy[idx].name + "\"?"
                            );
                            if (confirmed) {
                                workingCopy.splice(idx, 1);
                                refreshTable(table, workingCopy);
                                var newIdx = Math.min(idx, workingCopy.length - 1);
                                if (newIdx >= 0) table.select(newIdx);
                                updateButtons(table, buttons, workingCopy);
                            }
                        },
                        widgetDefaultSelected: function () {}
                    });

                    buttons.moveUpBtn.addSelectionListener({
                        widgetSelected: function () {
                            var idx = table.getSelectionIndex();
                            if (idx <= 0) return;

                            var tmp = workingCopy[idx];
                            workingCopy[idx] = workingCopy[idx - 1];
                            workingCopy[idx - 1] = tmp;
                            refreshTable(table, workingCopy);
                            table.select(idx - 1);
                            updateButtons(table, buttons, workingCopy);
                        },
                        widgetDefaultSelected: function () {}
                    });

                    buttons.moveDownBtn.addSelectionListener({
                        widgetSelected: function () {
                            var idx = table.getSelectionIndex();
                            if (idx < 0 || idx >= workingCopy.length - 1) return;

                            var tmp = workingCopy[idx];
                            workingCopy[idx] = workingCopy[idx + 1];
                            workingCopy[idx + 1] = tmp;
                            refreshTable(table, workingCopy);
                            table.select(idx + 1);
                            updateButtons(table, buttons, workingCopy);
                        },
                        widgetDefaultSelected: function () {}
                    });

                    resetBtn.addSelectionListener({
                        widgetSelected: function () {
                            var confirmed = MessageDialog.openConfirm(
                                parentShell,
                                "Reset All Templates",
                                "This will replace all templates with the built-in defaults.\n\n" +
                                "Any custom templates will be lost. Continue?"
                            );
                            if (confirmed) {
                                var fresh = elkTemplates.resetToDefaults();
                                workingCopy.length = 0;
                                for (var i = 0; i < fresh.length; i++) {
                                    workingCopy.push(fresh[i]);
                                }
                                refreshTable(table, workingCopy);
                                updateButtons(table, buttons, workingCopy);
                            }
                        },
                        widgetDefaultSelected: function () {}
                    });

                    return area;
                },

                createButtonsForButtonBar: function (parent) {
                    myDialog.dialog.createButton(parent, IDialogConstants.OK_ID, "OK", true);
                    myDialog.dialog.createButton(parent, IDialogConstants.CANCEL_ID, "Cancel", false);
                },

                getInitialSize: function () {
                    var Point = swt.Point;
                    return new Point(460, 550);
                },

                okPressed: function () {
                    result = workingCopy;
                    Java.super(myDialog.dialog).okPressed();
                }
            })
        };

        myDialog.dialog.setHelpAvailable(false);
        myDialog.dialog.open();
        return result;
    }

    // =========================================================================
    // Export
    // =========================================================================

    if (typeof globalThis !== "undefined") globalThis.showElkTemplateManagerDialog = showElkTemplateManagerDialog;
    if (typeof module !== "undefined" && module.exports) module.exports = showElkTemplateManagerDialog;

})();
