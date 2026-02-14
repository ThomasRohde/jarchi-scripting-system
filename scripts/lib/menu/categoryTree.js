/**
 * @module categoryTree
 * @description Builds a sorted category tree model from script descriptors.
 * Categories are derived from the descriptor's category[] array.
 * Sorting: categories first (alphabetical), then scripts by order, title, id.
 * @version 1.0.0
 */
(function () {
    "use strict";

    if (typeof globalThis !== "undefined" && typeof globalThis.categoryTree !== "undefined") return;

    /**
     * Create a new tree node.
     * @param {string} label - Display label
     * @param {boolean} isCategory - True if this is a category node
     * @param {Object|null} descriptor - ScriptDescriptor for leaf nodes
     * @param {string[]} path - Category path from root
     * @returns {Object} TreeNode
     */
    function createNode(label, isCategory, descriptor, path) {
        return {
            label: label,
            isCategory: isCategory,
            descriptor: descriptor,
            children: [],
            path: path
        };
    }

    /**
     * Sort children of a node: categories first (alpha), then scripts (order, title, id).
     * @param {Object} node - TreeNode
     */
    function sortChildren(node) {
        node.children.sort(function (a, b) {
            // Categories before scripts
            if (a.isCategory && !b.isCategory) return -1;
            if (!a.isCategory && b.isCategory) return 1;

            if (a.isCategory && b.isCategory) {
                // Both categories: alphabetical
                return a.label.toLowerCase().localeCompare(b.label.toLowerCase());
            }

            // Both scripts: by order, then title, then id
            var aDesc = a.descriptor;
            var bDesc = b.descriptor;
            var orderDiff = (aDesc.order || 100) - (bDesc.order || 100);
            if (orderDiff !== 0) return orderDiff;

            var titleCmp = aDesc.title.toLowerCase().localeCompare(bDesc.title.toLowerCase());
            if (titleCmp !== 0) return titleCmp;

            return aDesc.id.localeCompare(bDesc.id);
        });

        // Recursively sort children of category nodes
        for (var i = 0; i < node.children.length; i++) {
            if (node.children[i].isCategory) {
                sortChildren(node.children[i]);
            }
        }
    }

    /**
     * Build a category tree from an array of script descriptors.
     * @param {Object[]} descriptors - Array of ScriptDescriptor objects
     * @returns {Object} Root TreeNode
     */
    function build(descriptors) {
        var root = createNode("Root", true, null, []);

        for (var i = 0; i < descriptors.length; i++) {
            var desc = descriptors[i];
            var categories = desc.category || ["Uncategorized"];
            var currentNode = root;
            var currentPath = [];

            // Walk/create category path
            for (var c = 0; c < categories.length; c++) {
                var catLabel = categories[c];
                currentPath = currentPath.concat([catLabel]);

                // Find existing category child
                var found = null;
                for (var j = 0; j < currentNode.children.length; j++) {
                    if (currentNode.children[j].isCategory && currentNode.children[j].label === catLabel) {
                        found = currentNode.children[j];
                        break;
                    }
                }

                if (!found) {
                    found = createNode(catLabel, true, null, currentPath.slice());
                    currentNode.children.push(found);
                }
                currentNode = found;
            }

            // Add script as leaf node
            var scriptNode = createNode(desc.title, false, desc, currentPath.slice());
            currentNode.children.push(scriptNode);
        }

        sortChildren(root);
        return root;
    }

    var categoryTree = {
        build: build
    };

    if (typeof globalThis !== "undefined") globalThis.categoryTree = categoryTree;
    if (typeof module !== "undefined" && module.exports) module.exports = categoryTree;
})();
