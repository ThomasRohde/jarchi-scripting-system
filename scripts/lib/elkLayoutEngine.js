/**
 * @module elkLayoutEngine
 * @description Converts JArchi views to ELK graphs and applies layout results back,
 * including element positioning and connection bendpoints with port support.
 * @version 1.0.0
 * @author Thomas Rohde
 * @lastModifiedDate 2026-02-14
 */
(function () {
    "use strict";

    if (typeof globalThis !== "undefined" && typeof globalThis.elkLayoutEngine !== "undefined") return;

    // =========================================================================
    // Helpers
    // =========================================================================

    /**
     * Get the absolute center coordinates of a diagram object,
     * accounting for all parent offsets in nested hierarchies.
     * @param {Object} obj - JArchi diagram object proxy
     * @returns {{ x: number, y: number }}
     */
    function getAbsoluteCenter(obj) {
        var b = obj.bounds;
        var x = b.x + b.width / 2;
        var y = b.y + b.height / 2;
        $(obj).parents().each(function (p) {
            try {
                var pb = p.bounds;
                if (pb) {
                    x += pb.x;
                    y += pb.y;
                }
            } catch (e) { /* top-level has no bounds */ }
        });
        return { x: x, y: y };
    }

    /**
     * Get the absolute top-left coordinates of a diagram object.
     * @param {Object} obj - JArchi diagram object proxy
     * @returns {{ x: number, y: number }}
     */
    function getAbsoluteOrigin(obj) {
        var b = obj.bounds;
        var x = b.x;
        var y = b.y;
        $(obj).parents().each(function (p) {
            try {
                var pb = p.bounds;
                if (pb) {
                    x += pb.x;
                    y += pb.y;
                }
            } catch (e) { /* top-level has no bounds */ }
        });
        return { x: x, y: y };
    }

    /**
     * Determine which side of a node a port should be placed on
     * based on the relative position of the other endpoint.
     * @param {Object} srcCenter - {x, y} absolute center of the source
     * @param {Object} tgtCenter - {x, y} absolute center of the target
     * @param {boolean} isSource - true if determining port side for the source node
     * @returns {string} ELK port side: "NORTH", "SOUTH", "EAST", "WEST"
     */
    function inferPortSide(srcCenter, tgtCenter, isSource) {
        var dx = tgtCenter.x - srcCenter.x;
        var dy = tgtCenter.y - srcCenter.y;

        if (Math.abs(dx) > Math.abs(dy)) {
            // Primarily horizontal relationship
            if (isSource) {
                return dx > 0 ? "EAST" : "WEST";
            } else {
                return dx > 0 ? "WEST" : "EAST";
            }
        } else {
            // Primarily vertical relationship
            if (isSource) {
                return dy > 0 ? "SOUTH" : "NORTH";
            } else {
                return dy > 0 ? "NORTH" : "SOUTH";
            }
        }
    }

    /**
     * Get a display name for a diagram object.
     * @param {Object} obj - JArchi diagram object proxy
     * @returns {string}
     */
    function getDisplayName(obj) {
        var name = "";
        try {
            if (obj.name && obj.name.trim()) {
                name = obj.name;
            } else if (obj.concept && obj.concept.name && obj.concept.name.trim()) {
                name = obj.concept.name;
            }
        } catch (e) { /* ignore */ }
        return name || "";
    }

    // =========================================================================
    // Build ELK Graph
    // =========================================================================

    /**
     * Convert a JArchi view into an ELK JSON graph.
     *
     * @param {Object} view - JArchi view (archimate-diagram-model)
     * @param {Object} options - Layout options from the dialog
     * @param {string} options.hierarchy - "flat" or "hierarchical"
     * @param {string} options.portAssignment - "direction", "type", or "none"
     * @param {string} options.portConstraints - ELK port constraint value
     * @returns {{ graph: Object, maps: { nodeMap: Object, edgeMap: Object } }}
     */
    function buildElkGraph(view, options) {
        var nodeMap = {};   // jArchi obj ID → { elkNode, jarchiObj }
        var edgeMap = {};   // connection ID → { elkEdge, jarchiConn }
        var portCounter = 0;
        var edgeCounter = 0;

        var useHierarchy = (options.hierarchy === "hierarchical");
        var portAssignment = options.portAssignment || "direction";
        var portConstraints = options.portConstraints || "FIXED_SIDE";

        /**
         * Process a single diagram object into an ELK node.
         * @param {Object} obj - JArchi diagram object
         * @returns {Object|null} ELK node or null if skipped
         */
        function createElkNode(obj) {
            var b = obj.bounds;
            if (!b) return null;

            var elkNode = {
                id: obj.id,
                width: b.width > 0 ? b.width : 120,
                height: b.height > 0 ? b.height : 55,
                ports: [],
                labels: [],
                layoutOptions: {}
            };

            var name = getDisplayName(obj);
            if (name) {
                elkNode.labels.push({ text: name });
            }

            // Set port constraints on the node
            if (portConstraints !== "FREE") {
                elkNode.layoutOptions["elk.portConstraints"] = portConstraints;
            }

            return elkNode;
        }

        /**
         * Recursively collect visual objects from a container.
         * @param {Object} container - JArchi view or diagram object with children
         * @param {Object} parentElkNode - Parent ELK node (or root graph)
         */
        function collectNodes(container, parentElkNode) {
            $(container).children().each(function (child) {
                // Skip if no bounds (some object types may not have visual bounds)
                var hasBounds = false;
                try { hasBounds = !!child.bounds; } catch (e) { /* ignore */ }
                if (!hasBounds) return;

                var elkNode = createElkNode(child);
                if (!elkNode) return;

                nodeMap[child.id] = { elkNode: elkNode, jarchiObj: child };

                // Check for nested children (groups, containers)
                var hasChildren = false;
                if (useHierarchy) {
                    $(child).children().each(function (grandchild) {
                        if (grandchild.bounds) {
                            hasChildren = true;
                        }
                    });
                }

                if (hasChildren && useHierarchy) {
                    // This is a container node — recurse
                    elkNode.children = [];
                    elkNode.edges = [];

                    // Add padding for the container
                    elkNode.layoutOptions["elk.padding"] = "[top=30,left=10,bottom=10,right=10]";

                    collectNodes(child, elkNode);
                }

                // Add to parent
                if (!parentElkNode.children) {
                    parentElkNode.children = [];
                }
                parentElkNode.children.push(elkNode);
            });
        }

        // --- Build the root graph ---
        var graph = {
            id: "root",
            children: [],
            edges: [],
            layoutOptions: {}
        };

        // Collect all nodes
        collectNodes(view, graph);

        // --- Collect all connections and create ports + edges ---
        // We need to find all connections in the view by traversing all objects
        var processedConnections = {};

        /**
         * Find the appropriate ELK parent for an edge.
         * The edge must be placed in the lowest common ancestor (LCA) of
         * its source and target nodes in the ELK hierarchy.
         * For flat layout, all edges go on the root graph.
         * @param {string} sourceId - Source node ID
         * @param {string} targetId - Target node ID
         * @returns {Object} The ELK node/graph to attach the edge to
         */
        function findEdgeContainer(sourceId, targetId) {
            if (!useHierarchy) return graph;

            // Walk up the parent chain for source and target to find LCA
            function getParentChain(objId) {
                var chain = [];
                var entry = nodeMap[objId];
                if (!entry) return chain;

                var current = entry.jarchiObj;
                $(current).parents().each(function (p) {
                    if (p.id && nodeMap[p.id]) {
                        chain.push(p.id);
                    }
                });
                return chain;
            }

            var srcChain = getParentChain(sourceId);
            var tgtChain = getParentChain(targetId);

            // Find LCA
            for (var i = 0; i < srcChain.length; i++) {
                for (var j = 0; j < tgtChain.length; j++) {
                    if (srcChain[i] === tgtChain[j]) {
                        return nodeMap[srcChain[i]].elkNode;
                    }
                }
            }

            return graph;
        }

        /**
         * Process connections for a diagram object.
         * @param {Object} obj - JArchi diagram object
         */
        function processConnections(obj) {
            // Get outgoing connections
            $(obj).outRels().each(function (conn) {
                if (processedConnections[conn.id]) return;
                processedConnections[conn.id] = true;

                var sourceObj = conn.source;
                var targetObj = conn.target;

                if (!sourceObj || !targetObj) return;
                if (!nodeMap[sourceObj.id] || !nodeMap[targetObj.id]) return;

                var srcEntry = nodeMap[sourceObj.id];
                var tgtEntry = nodeMap[targetObj.id];

                // --- Create ports ---
                var srcPortId = "port_" + (++portCounter);
                var tgtPortId = "port_" + (++portCounter);

                var srcPort = {
                    id: srcPortId,
                    width: 1,
                    height: 1,
                    layoutOptions: {}
                };

                var tgtPort = {
                    id: tgtPortId,
                    width: 1,
                    height: 1,
                    layoutOptions: {}
                };

                // Assign port sides based on strategy
                if (portAssignment === "direction") {
                    var srcCenter = getAbsoluteCenter(sourceObj);
                    var tgtCenter = getAbsoluteCenter(targetObj);

                    srcPort.layoutOptions["elk.port.side"] = inferPortSide(srcCenter, tgtCenter, true);
                    tgtPort.layoutOptions["elk.port.side"] = inferPortSide(srcCenter, tgtCenter, false);
                } else if (portAssignment === "type") {
                    // Group by relationship type — assign sides based on type
                    var relType = "";
                    try { relType = conn.type || ""; } catch (e) { /* ignore */ }

                    // Access relationships: typically flow downward
                    // Structural: typically left/right
                    if (relType.indexOf("access") >= 0 || relType.indexOf("serving") >= 0) {
                        srcPort.layoutOptions["elk.port.side"] = "SOUTH";
                        tgtPort.layoutOptions["elk.port.side"] = "NORTH";
                    } else if (relType.indexOf("composition") >= 0 || relType.indexOf("aggregation") >= 0) {
                        srcPort.layoutOptions["elk.port.side"] = "SOUTH";
                        tgtPort.layoutOptions["elk.port.side"] = "NORTH";
                    } else if (relType.indexOf("flow") >= 0 || relType.indexOf("triggering") >= 0) {
                        srcPort.layoutOptions["elk.port.side"] = "EAST";
                        tgtPort.layoutOptions["elk.port.side"] = "WEST";
                    } else {
                        // Default: let direction inference handle it
                        var sc = getAbsoluteCenter(sourceObj);
                        var tc = getAbsoluteCenter(targetObj);
                        srcPort.layoutOptions["elk.port.side"] = inferPortSide(sc, tc, true);
                        tgtPort.layoutOptions["elk.port.side"] = inferPortSide(sc, tc, false);
                    }
                }
                // "none" — no side assignment, ports remain free

                srcEntry.elkNode.ports.push(srcPort);
                tgtEntry.elkNode.ports.push(tgtPort);

                // --- Create edge ---
                var edgeId = "edge_" + (++edgeCounter);
                var elkEdge = {
                    id: edgeId,
                    sources: [srcPortId],
                    targets: [tgtPortId]
                };

                edgeMap[edgeId] = { elkEdge: elkEdge, jarchiConn: conn };

                // Place edge in the correct container (LCA for hierarchical)
                var container = findEdgeContainer(sourceObj.id, targetObj.id);
                if (!container.edges) {
                    container.edges = [];
                }
                container.edges.push(elkEdge);
            });

            // Recurse into children
            $(obj).children().each(function (child) {
                processConnections(child);
            });
        }

        // Process connections starting from view children
        $(view).children().each(function (child) {
            processConnections(child);
        });

        // Also process incoming relationships to catch any we missed
        $(view).children().each(function (child) {
            $(child).inRels().each(function (conn) {
                if (processedConnections[conn.id]) return;
                processedConnections[conn.id] = true;

                var sourceObj = conn.source;
                var targetObj = conn.target;

                if (!sourceObj || !targetObj) return;
                if (!nodeMap[sourceObj.id] || !nodeMap[targetObj.id]) return;

                var srcEntry = nodeMap[sourceObj.id];
                var tgtEntry = nodeMap[targetObj.id];

                var srcPortId = "port_" + (++portCounter);
                var tgtPortId = "port_" + (++portCounter);

                var srcPort = { id: srcPortId, width: 1, height: 1, layoutOptions: {} };
                var tgtPort = { id: tgtPortId, width: 1, height: 1, layoutOptions: {} };

                if (portAssignment === "direction") {
                    var srcCenter = getAbsoluteCenter(sourceObj);
                    var tgtCenter = getAbsoluteCenter(targetObj);
                    srcPort.layoutOptions["elk.port.side"] = inferPortSide(srcCenter, tgtCenter, true);
                    tgtPort.layoutOptions["elk.port.side"] = inferPortSide(srcCenter, tgtCenter, false);
                }

                srcEntry.elkNode.ports.push(srcPort);
                tgtEntry.elkNode.ports.push(tgtPort);

                var edgeId = "edge_" + (++edgeCounter);
                var elkEdge = { id: edgeId, sources: [srcPortId], targets: [tgtPortId] };
                edgeMap[edgeId] = { elkEdge: elkEdge, jarchiConn: conn };

                var container = findEdgeContainer(sourceObj.id, targetObj.id);
                if (!container.edges) container.edges = [];
                container.edges.push(elkEdge);
            });
        });

        return { graph: graph, maps: { nodeMap: nodeMap, edgeMap: edgeMap } };
    }

    // =========================================================================
    // Apply ELK Layout
    // =========================================================================

    /**
     * Apply ELK layout results back to the JArchi view.
     *
     * @param {Object} view - JArchi view
     * @param {Object} elkResult - ELK layout result (graph with positions)
     * @param {Object} maps - { nodeMap, edgeMap } from buildElkGraph
     * @param {Object} options - Layout options from dialog
     * @param {boolean} options.applyBendpoints - Whether to apply bendpoints
     * @param {boolean} options.setManualRouter - Whether to set router to manual
     * @param {boolean} options.preserveSizes - Whether to keep original element sizes
     * @param {string} options.connectionStyle - "none", "straight", "orthogonal", "curved"
     */
    function applyElkLayout(view, elkResult, maps, options) {
        var nodeMap = maps.nodeMap;
        var edgeMap = maps.edgeMap;

        // --- Apply node positions ---
        applyNodePositions(elkResult, nodeMap, options);

        // --- Apply bendpoints ---
        if (options.applyBendpoints !== false) {
            applyBendpoints(elkResult, edgeMap, nodeMap);
        }

        // --- Set view router type to manual (bendpoint) ---
        if (options.setManualRouter !== false) {
            var routerSet = false;
            // Try jArchi API first
            try {
                view.routerType = "manual";
                routerSet = true;
            } catch (e) { /* not available */ }
            // Fallback: EMF API via the underlying diagram model
            if (!routerSet) {
                try {
                    // CONNECTION_ROUTER_BENDPOINT = 0 (manual routing)
                    var viewId = view.id;
                    var models = Java.type("com.archimatetool.editor.model.IEditorModelManager").INSTANCE.getModels();
                    for (var mi = 0; mi < models.size(); mi++) {
                        var m = models.get(mi);
                        var eObj = m.eResource().getEObject(viewId);
                        if (eObj && Java.isJavaObject(eObj)) {
                            eObj.setConnectionRouterType(0);
                            routerSet = true;
                            break;
                        }
                    }
                } catch (e2) { /* ignore */ }
            }
            if (!routerSet) {
                console.log("  Note: Could not set router type to manual.");
            }
        }

        // --- Set connection line style ---
        if (options.connectionStyle && options.connectionStyle !== "none") {
            var styleMap = { "straight": 0, "curved": 1, "orthogonal": 2 };
            var style = styleMap[options.connectionStyle];
            if (style !== undefined) {
                for (var edgeId in edgeMap) {
                    if (edgeMap.hasOwnProperty(edgeId)) {
                        try {
                            edgeMap[edgeId].jarchiConn.setLineStyle(style);
                        } catch (e) { /* some connections may not support it */ }
                    }
                }
            }
        }
    }

    /**
     * Recursively apply node positions from ELK result.
     * @param {Object} elkNode - ELK node (may have children)
     * @param {Object} nodeMap - ID → { elkNode, jarchiObj }
     * @param {Object} options
     */
    function applyNodePositions(elkNode, nodeMap, options) {
        if (!elkNode.children) return;

        elkNode.children.forEach(function (child) {
            var entry = nodeMap[child.id];
            if (entry) {
                var obj = entry.jarchiObj;
                var b = obj.bounds;

                var newBounds = {
                    x: Math.round(child.x || 0),
                    y: Math.round(child.y || 0),
                    width: (options.preserveSizes !== false) ? b.width : Math.round(child.width || b.width),
                    height: (options.preserveSizes !== false) ? b.height : Math.round(child.height || b.height)
                };

                obj.bounds = newBounds;
            }

            // Recurse into children
            if (child.children) {
                applyNodePositions(child, nodeMap, options);
            }
        });
    }

    /**
     * Apply bendpoints from ELK edge sections to JArchi connections.
     * @param {Object} elkGraph - ELK result graph
     * @param {Object} edgeMap - edge ID → { elkEdge, jarchiConn }
     * @param {Object} nodeMap - node ID → { elkNode, jarchiObj }
     */
    function applyBendpoints(elkGraph, edgeMap, nodeMap) {
        // Collect all edges from the graph recursively, with container offsets
        var allEdges = [];
        collectEdges(elkGraph, allEdges, 0, 0);

        allEdges.forEach(function (edgeEntry) {
            var elkEdge = edgeEntry.edge;
            var containerOffsetX = edgeEntry.offsetX;
            var containerOffsetY = edgeEntry.offsetY;

            var entry = edgeMap[elkEdge.id];
            if (!entry) return;

            var conn = entry.jarchiConn;
            if (!conn) return;

            // Clear existing bendpoints
            try {
                conn.deleteAllBendpoints();
            } catch (e) {
                console.error("Failed to clear bendpoints: " + e);
                return;
            }

            // Process edge sections
            if (!elkEdge.sections || elkEdge.sections.length === 0) return;

            // Get absolute centers of source and target AFTER position update
            var srcCenter = getAbsoluteCenter(conn.source);
            var tgtCenter = getAbsoluteCenter(conn.target);

            var bpIndex = 0;

            elkEdge.sections.forEach(function (section) {
                // Collect all points: startPoint + bendPoints + endPoint
                var points = [];

                if (section.startPoint) {
                    points.push(section.startPoint);
                }

                if (section.bendPoints) {
                    section.bendPoints.forEach(function (bp) {
                        points.push(bp);
                    });
                }

                if (section.endPoint) {
                    points.push(section.endPoint);
                }

                // Convert each point to a JArchi relative bendpoint.
                // ELK section coordinates are relative to the edge's container.
                // Add the container offset to get absolute coordinates.
                // Skip the very first and very last point if they are close to element centers
                // (they represent the connection anchors, not true bendpoints).
                for (var i = 0; i < points.length; i++) {
                    var pt = points[i];
                    // Convert container-relative to absolute coordinates
                    var absX = pt.x + containerOffsetX;
                    var absY = pt.y + containerOffsetY;

                    // Check if this point is essentially at the source or target center
                    // (within the element bounds) — if so, skip it as an anchor point
                    if (i === 0) {
                        var distToSrc = Math.sqrt(
                            Math.pow(absX - srcCenter.x, 2) + Math.pow(absY - srcCenter.y, 2)
                        );
                        var srcSize = Math.max(conn.source.bounds.width, conn.source.bounds.height) / 2;
                        if (distToSrc < srcSize + 5) continue;
                    }

                    if (i === points.length - 1) {
                        var distToTgt = Math.sqrt(
                            Math.pow(absX - tgtCenter.x, 2) + Math.pow(absY - tgtCenter.y, 2)
                        );
                        var tgtSize = Math.max(conn.target.bounds.width, conn.target.bounds.height) / 2;
                        if (distToTgt < tgtSize + 5) continue;
                    }

                    // Convert absolute coordinates to JArchi relative bendpoint format
                    var relBp = {
                        startX: Math.round(absX - srcCenter.x),
                        startY: Math.round(absY - srcCenter.y),
                        endX: Math.round(absX - tgtCenter.x),
                        endY: Math.round(absY - tgtCenter.y)
                    };

                    try {
                        conn.addRelativeBendpoint(relBp, bpIndex);
                        bpIndex++;
                    } catch (e) {
                        console.error("Failed to add bendpoint: " + e);
                    }
                }
            });
        });
    }

    /**
     * Recursively collect all edges from an ELK graph,
     * tracking the absolute offset of each edge's container
     * for correct coordinate conversion in hierarchical layouts.
     * @param {Object} elkNode - ELK node/graph
     * @param {Array} result - accumulated { edge, offsetX, offsetY } objects
     * @param {number} offsetX - accumulated X offset from root
     * @param {number} offsetY - accumulated Y offset from root
     */
    function collectEdges(elkNode, result, offsetX, offsetY) {
        offsetX = offsetX || 0;
        offsetY = offsetY || 0;

        if (elkNode.edges) {
            elkNode.edges.forEach(function (e) {
                result.push({ edge: e, offsetX: offsetX, offsetY: offsetY });
            });
        }
        if (elkNode.children) {
            elkNode.children.forEach(function (child) {
                // Child nodes add their position to the offset for any edges inside them
                var childOffsetX = offsetX + (child.x || 0);
                var childOffsetY = offsetY + (child.y || 0);
                collectEdges(child, result, childOffsetX, childOffsetY);
            });
        }
    }

    // =========================================================================
    // Build Layout Options
    // =========================================================================

    /**
     * Build ELK layoutOptions object from the dialog options.
     * @param {Object} options - Options from the dialog
     * @returns {Object} ELK layout options
     */
    function buildLayoutOptions(options) {
        var lo = {};

        // Algorithm
        lo["elk.algorithm"] = options.algorithm || "layered";

        // Direction
        if (options.direction) {
            lo["elk.direction"] = options.direction;
        }

        // Edge routing
        if (options.edgeRouting) {
            lo["elk.edgeRouting"] = options.edgeRouting;
        }

        // Spacing
        if (options.nodeNodeSpacing) {
            lo["elk.spacing.nodeNode"] = String(options.nodeNodeSpacing);
        }
        if (options.edgeEdgeSpacing) {
            lo["elk.spacing.edgeEdge"] = String(options.edgeEdgeSpacing);
        }
        if (options.edgeNodeSpacing) {
            lo["elk.spacing.edgeNode"] = String(options.edgeNodeSpacing);
        }
        if (options.componentSpacing) {
            lo["elk.spacing.componentComponent"] = String(options.componentSpacing);
        }
        if (options.padding) {
            lo["elk.padding"] = "[top=" + options.padding + ",left=" + options.padding +
                ",bottom=" + options.padding + ",right=" + options.padding + "]";
        }

        // Aspect ratio
        if (options.aspectRatio) {
            lo["elk.aspectRatio"] = String(options.aspectRatio);
        }

        // Separate connected components
        if (options.separateComponents !== undefined) {
            lo["elk.separateConnectedComponents"] = String(options.separateComponents);
        }

        // Port alignment
        if (options.portAlignment) {
            lo["elk.portAlignment.default"] = options.portAlignment;
        }

        // Port spacing
        if (options.portSpacing) {
            lo["elk.spacing.portPort"] = String(options.portSpacing);
        }

        // --- Layered-specific ---
        if (options.algorithm === "layered") {
            if (options.betweenLayerSpacing) {
                lo["elk.layered.spacing.nodeNodeBetweenLayers"] = String(options.betweenLayerSpacing);
            }
            if (options.edgeNodeBetweenLayers) {
                lo["elk.layered.spacing.edgeNodeBetweenLayers"] = String(options.edgeNodeBetweenLayers);
            }
            if (options.mergeEdges !== undefined) {
                lo["elk.layered.mergeEdges"] = String(options.mergeEdges);
            }
            if (options.crossingMinimization) {
                lo["elk.layered.crossingMinimization.strategy"] = options.crossingMinimization;
            }
            if (options.nodePlacement) {
                lo["elk.layered.nodePlacement.strategy"] = options.nodePlacement;
            }
            if (options.layeringStrategy) {
                lo["elk.layered.layering.strategy"] = options.layeringStrategy;
            }
            if (options.compaction) {
                lo["elk.layered.compaction.postCompaction.strategy"] = options.compaction;
            }
            if (options.wrapping) {
                lo["elk.layered.wrapping.strategy"] = options.wrapping;
            }
            if (options.feedbackEdges !== undefined) {
                lo["elk.layered.feedbackEdges"] = String(options.feedbackEdges);
            }
        }

        // --- Stress-specific ---
        if (options.algorithm === "stress") {
            if (options.stressDesiredEdgeLength) {
                lo["elk.stress.desiredEdgeLength"] = String(options.stressDesiredEdgeLength);
            }
            if (options.stressIterations) {
                lo["elk.stress.iterations"] = String(options.stressIterations);
            }
        }

        // --- Force-specific ---
        if (options.algorithm === "force") {
            if (options.forceIterations) {
                lo["elk.force.iterations"] = String(options.forceIterations);
            }
            if (options.forceRepulsivePower) {
                lo["elk.force.repulsivePower"] = String(options.forceRepulsivePower);
            }
        }

        // --- MrTree-specific ---
        if (options.algorithm === "mrtree") {
            if (options.mrtreeWeighting) {
                lo["elk.mrtree.weighting"] = options.mrtreeWeighting;
            }
            if (options.mrtreeSearchOrder) {
                lo["elk.mrtree.searchOrder"] = options.mrtreeSearchOrder;
            }
        }

        return lo;
    }

    // =========================================================================
    // Export
    // =========================================================================

    var elkLayoutEngine = {
        buildElkGraph: buildElkGraph,
        applyElkLayout: applyElkLayout,
        buildLayoutOptions: buildLayoutOptions
    };

    if (typeof globalThis !== "undefined") globalThis.elkLayoutEngine = elkLayoutEngine;
    if (typeof module !== "undefined" && module.exports) module.exports = elkLayoutEngine;

})();
