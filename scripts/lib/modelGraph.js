/**
 * @name modelGraph
 * @description Shared graph-building, Tarjan SCC detection, and BFS path finding
 *   over ArchiMate elements and relationships. Provides a directed graph abstraction
 *   suitable for cycle analysis and impact/dependency exploration.
 * @version 1.0.0
 * @author Thomas Rohde
 * @lastModifiedDate 2026-02-15
 */
(function () {
    "use strict";
    if (typeof globalThis !== "undefined" && typeof globalThis.modelGraph !== "undefined") return;

    // =================================================================
    // Element-to-layer mapping (58 ArchiMate element types)
    // =================================================================

    var ELEMENT_TO_LAYER = {
        "stakeholder": "motivation", "driver": "motivation", "assessment": "motivation",
        "goal": "motivation", "outcome": "motivation", "principle": "motivation",
        "requirement": "motivation", "constraint": "motivation", "meaning": "motivation",
        "value": "motivation",
        "resource": "strategy", "capability": "strategy", "course-of-action": "strategy",
        "value-stream": "strategy",
        "business-actor": "business", "business-role": "business",
        "business-collaboration": "business", "business-interface": "business",
        "business-process": "business", "business-function": "business",
        "business-interaction": "business", "business-event": "business",
        "business-service": "business", "business-object": "business",
        "contract": "business", "representation": "business", "product": "business",
        "application-component": "application", "application-collaboration": "application",
        "application-interface": "application", "application-function": "application",
        "application-process": "application", "application-interaction": "application",
        "application-event": "application", "application-service": "application",
        "data-object": "application",
        "node": "technology", "device": "technology", "system-software": "technology",
        "technology-collaboration": "technology", "technology-interface": "technology",
        "path": "technology", "communication-network": "technology",
        "technology-function": "technology", "technology-process": "technology",
        "technology-interaction": "technology", "technology-event": "technology",
        "technology-service": "technology", "artifact": "technology",
        "equipment": "physical", "facility": "physical",
        "distribution-network": "physical", "material": "physical",
        "work-package": "implementation", "deliverable": "implementation",
        "implementation-event": "implementation", "plateau": "implementation",
        "gap": "implementation"
    };

    // =================================================================
    // Relationship groups
    // =================================================================

    var RELATIONSHIP_GROUPS = {
        structural: [
            "composition-relationship", "aggregation-relationship",
            "assignment-relationship", "realization-relationship"
        ],
        dependency: [
            "serving-relationship", "access-relationship", "influence-relationship"
        ],
        dynamic: [
            "triggering-relationship", "flow-relationship"
        ],
        other: [
            "specialization-relationship", "association-relationship"
        ]
    };

    var DEFAULT_DEPENDENCY_TYPES = {};
    var groups = ["structural", "dependency", "dynamic"];
    for (var gi = 0; gi < groups.length; gi++) {
        var grp = RELATIONSHIP_GROUPS[groups[gi]];
        for (var ri = 0; ri < grp.length; ri++) {
            DEFAULT_DEPENDENCY_TYPES[grp[ri]] = true;
        }
    }

    // Human-readable relationship labels
    var RELATIONSHIP_LABELS = {
        "composition-relationship": "Composition",
        "aggregation-relationship": "Aggregation",
        "assignment-relationship": "Assignment",
        "realization-relationship": "Realization",
        "serving-relationship": "Serving",
        "access-relationship": "Access",
        "influence-relationship": "Influence",
        "triggering-relationship": "Triggering",
        "flow-relationship": "Flow",
        "specialization-relationship": "Specialization",
        "association-relationship": "Association"
    };

    // Layer display labels
    var LAYER_LABELS = {
        "motivation": "Motivation",
        "strategy": "Strategy",
        "business": "Business",
        "application": "Application",
        "technology": "Technology",
        "physical": "Physical",
        "implementation": "Implementation"
    };

    // All layers in order (for UI)
    var LAYER_ORDER = ["strategy", "business", "application", "technology", "physical", "motivation", "implementation"];

    // =================================================================
    // buildGraph
    // =================================================================

    /**
     * Build a directed graph from model elements and relationships.
     * @param {Object} options
     * @param {string} [options.scope="model"] - "model", "selection", or "layer"
     * @param {Object} [options.elements] - jArchi collection (when scope="selection")
     * @param {Object} [options.layerFilter] - { "business": true, ... } (when scope="layer")
     * @param {Object} [options.relationshipTypes] - { "serving-relationship": true, ... }
     * @returns {Object} Graph object
     */
    function buildGraph(options) {
        options = options || {};
        var scope = options.scope || "model";
        var relTypes = options.relationshipTypes || DEFAULT_DEPENDENCY_TYPES;

        var graph = {
            nodes: {},
            edges: {},
            adjacency: {},
            reverseAdj: {},
            nodeCount: 0,
            edgeCount: 0
        };

        // Step 1: Collect elements based on scope
        var elementCollection;
        if (scope === "selection" && options.elements) {
            elementCollection = options.elements;
        } else if (scope === "layer" && options.layerFilter) {
            // Build from all elements, filter by layer
            elementCollection = $("element");
        } else {
            elementCollection = $("element");
        }

        // Add nodes
        elementCollection.each(function (el) {
            var elType = el.type;
            var layer = ELEMENT_TO_LAYER[elType] || null;

            // Layer filter
            if (scope === "layer" && options.layerFilter && layer) {
                if (!options.layerFilter[layer]) return;
            }

            graph.nodes[el.id] = {
                id: el.id,
                name: el.name || "(unnamed)",
                type: elType,
                layer: layer,
                element: el
            };
            graph.adjacency[el.id] = [];
            graph.reverseAdj[el.id] = [];
            graph.nodeCount++;
        });

        // Step 2: Add edges from relationships
        var relCount = 0;
        $("relationship").each(function (rel) {
            relCount++;
            if (relCount % 500 === 0 && typeof log !== "undefined") {
                log.detail("  Processing relationship " + relCount + "...");
            }

            // Filter by type
            if (!relTypes[rel.type]) return;

            var sourceId = rel.source ? rel.source.id : null;
            var targetId = rel.target ? rel.target.id : null;

            // Both endpoints must be in the graph
            if (!sourceId || !targetId) return;
            if (!graph.nodes[sourceId] || !graph.nodes[targetId]) return;

            graph.edges[rel.id] = {
                id: rel.id,
                sourceId: sourceId,
                targetId: targetId,
                type: rel.type,
                relationship: rel
            };
            graph.adjacency[sourceId].push(rel.id);
            graph.reverseAdj[targetId].push(rel.id);
            graph.edgeCount++;
        });

        return graph;
    }

    // =================================================================
    // Tarjan's SCC algorithm (findSCCs)
    // =================================================================

    /**
     * Find strongly connected components with 2+ nodes using Tarjan's algorithm.
     * @param {Object} graph - Graph from buildGraph()
     * @returns {Array} Array of SCC objects: { nodes: [id,...], edges: [id,...] }
     */
    function findSCCs(graph) {
        var index = 0;
        var stack = [];
        var onStack = {};
        var nodeIndex = {};
        var nodeLowlink = {};
        var sccs = [];

        // Get all node IDs
        var nodeIds = Object.keys(graph.nodes);

        function strongconnect(v) {
            nodeIndex[v] = index;
            nodeLowlink[v] = index;
            index++;
            stack.push(v);
            onStack[v] = true;

            // Consider successors
            var outEdges = graph.adjacency[v] || [];
            for (var ei = 0; ei < outEdges.length; ei++) {
                var edge = graph.edges[outEdges[ei]];
                if (!edge) continue;
                var w = edge.targetId;

                if (nodeIndex[w] === undefined) {
                    // Not yet visited
                    strongconnect(w);
                    if (nodeLowlink[w] < nodeLowlink[v]) {
                        nodeLowlink[v] = nodeLowlink[w];
                    }
                } else if (onStack[w]) {
                    // On stack — part of current SCC
                    if (nodeIndex[w] < nodeLowlink[v]) {
                        nodeLowlink[v] = nodeIndex[w];
                    }
                }
            }

            // Root node — pop SCC
            if (nodeLowlink[v] === nodeIndex[v]) {
                var scc = [];
                var w;
                do {
                    w = stack.pop();
                    onStack[w] = false;
                    scc.push(w);
                } while (w !== v);

                if (scc.length >= 2) {
                    // Collect internal edges
                    var sccSet = {};
                    for (var si = 0; si < scc.length; si++) {
                        sccSet[scc[si]] = true;
                    }
                    var internalEdges = [];
                    for (var si = 0; si < scc.length; si++) {
                        var nid = scc[si];
                        var outE = graph.adjacency[nid] || [];
                        for (var ei = 0; ei < outE.length; ei++) {
                            var edge = graph.edges[outE[ei]];
                            if (edge && sccSet[edge.targetId]) {
                                internalEdges.push(outE[ei]);
                            }
                        }
                    }
                    sccs.push({ nodes: scc, edges: internalEdges });
                }
            }
        }

        for (var ni = 0; ni < nodeIds.length; ni++) {
            if (nodeIndex[nodeIds[ni]] === undefined) {
                strongconnect(nodeIds[ni]);
            }
        }

        return sccs;
    }

    // =================================================================
    // extractCyclePaths — find concrete cycle paths within one SCC
    // =================================================================

    /**
     * DFS within one SCC to find concrete cycle paths.
     * @param {Object} graph
     * @param {Object} scc - { nodes: [...], edges: [...] }
     * @param {number} [maxPaths=5]
     * @returns {Array} Array of { nodeIds: [...], edgeIds: [...] }
     */
    function extractCyclePaths(graph, scc, maxPaths) {
        maxPaths = maxPaths || 5;
        var paths = [];

        // Build SCC-local adjacency
        var sccSet = {};
        for (var i = 0; i < scc.nodes.length; i++) {
            sccSet[scc.nodes[i]] = true;
        }
        var localAdj = {};
        for (var i = 0; i < scc.nodes.length; i++) {
            localAdj[scc.nodes[i]] = [];
        }
        for (var i = 0; i < scc.edges.length; i++) {
            var edge = graph.edges[scc.edges[i]];
            if (edge) {
                localAdj[edge.sourceId].push(scc.edges[i]);
            }
        }

        // DFS from the first node to find cycles back to it
        var startNode = scc.nodes[0];

        function dfs(current, pathNodes, pathEdges, visited) {
            if (paths.length >= maxPaths) return;

            var outEdges = localAdj[current] || [];
            for (var ei = 0; ei < outEdges.length; ei++) {
                if (paths.length >= maxPaths) return;
                var edge = graph.edges[outEdges[ei]];
                if (!edge) continue;
                var next = edge.targetId;

                if (next === startNode && pathNodes.length >= 2) {
                    // Found a cycle
                    var cycleNodes = pathNodes.slice();
                    cycleNodes.push(next);
                    var cycleEdges = pathEdges.slice();
                    cycleEdges.push(outEdges[ei]);
                    paths.push({ nodeIds: cycleNodes, edgeIds: cycleEdges });
                    continue;
                }

                if (visited[next]) continue;
                if (pathNodes.length >= scc.nodes.length) continue;

                visited[next] = true;
                pathNodes.push(next);
                pathEdges.push(outEdges[ei]);
                dfs(next, pathNodes, pathEdges, visited);
                pathNodes.pop();
                pathEdges.pop();
                visited[next] = false;
            }
        }

        var visited = {};
        visited[startNode] = true;
        dfs(startNode, [startNode], [], visited);

        return paths;
    }

    // =================================================================
    // findPathsBFS — BFS path finding from seed nodes
    // =================================================================

    /**
     * BFS path finding from seed nodes.
     * @param {Object} graph
     * @param {Array} seedIds - Array of node IDs to start from
     * @param {Object} [options]
     * @param {string} [options.direction="downstream"] - "downstream", "upstream", or "both"
     * @param {number} [options.maxDepth=5]
     * @param {number} [options.maxPaths=500]
     * @returns {Array} Array of path objects
     */
    function findPathsBFS(graph, seedIds, options) {
        options = options || {};
        var direction = options.direction || "downstream";
        var maxDepth = options.maxDepth || 5;
        var maxPaths = options.maxPaths || 500;

        var paths = [];

        // Seed set for quick lookup
        var seedSet = {};
        for (var si = 0; si < seedIds.length; si++) {
            seedSet[seedIds[si]] = true;
        }

        function bfsDirection(dir) {
            for (var si = 0; si < seedIds.length; si++) {
                if (paths.length >= maxPaths) break;
                var seedId = seedIds[si];
                if (!graph.nodes[seedId]) continue;

                // Queue entries: { nodeId, pathNodes: [id,...], pathEdges: [id,...], depth }
                var queue = [{ nodeId: seedId, pathNodes: [seedId], pathEdges: [], depth: 0 }];
                var head = 0;

                while (head < queue.length && paths.length < maxPaths) {
                    var entry = queue[head++];
                    if (entry.depth >= maxDepth) {
                        // Record as endpoint at max depth
                        recordPath(entry, dir, seedId);
                        continue;
                    }

                    var adjList = dir === "downstream"
                        ? (graph.adjacency[entry.nodeId] || [])
                        : (graph.reverseAdj[entry.nodeId] || []);

                    var hasNext = false;
                    for (var ei = 0; ei < adjList.length; ei++) {
                        if (paths.length >= maxPaths) break;
                        var edge = graph.edges[adjList[ei]];
                        if (!edge) continue;
                        var nextId = dir === "downstream" ? edge.targetId : edge.sourceId;

                        // Cycle avoidance within current path
                        var inPath = false;
                        for (var pi = 0; pi < entry.pathNodes.length; pi++) {
                            if (entry.pathNodes[pi] === nextId) { inPath = true; break; }
                        }
                        if (inPath) continue;

                        hasNext = true;
                        var newPathNodes = entry.pathNodes.slice();
                        newPathNodes.push(nextId);
                        var newPathEdges = entry.pathEdges.slice();
                        newPathEdges.push(adjList[ei]);
                        queue.push({
                            nodeId: nextId,
                            pathNodes: newPathNodes,
                            pathEdges: newPathEdges,
                            depth: entry.depth + 1
                        });
                    }

                    if (!hasNext && entry.depth > 0) {
                        // Leaf endpoint
                        recordPath(entry, dir, seedId);
                    }
                }
            }
        }

        function recordPath(entry, dir, seedId) {
            if (paths.length >= maxPaths) return;
            var endpointId = entry.nodeId;
            var endNode = graph.nodes[endpointId];
            paths.push({
                nodeIds: entry.pathNodes,
                edgeIds: entry.pathEdges,
                length: entry.pathEdges.length,
                direction: dir,
                seedId: seedId,
                endpointId: endpointId,
                endpointName: endNode ? endNode.name : "(unknown)",
                endpointType: endNode ? endNode.type : "(unknown)",
                endpointLayer: endNode ? endNode.layer : null
            });
        }

        if (direction === "downstream" || direction === "both") {
            bfsDirection("downstream");
        }
        if (direction === "upstream" || direction === "both") {
            bfsDirection("upstream");
        }

        return paths;
    }

    // =================================================================
    // Utility functions
    // =================================================================

    function getLayer(elementType) {
        return ELEMENT_TO_LAYER[elementType] || null;
    }

    function getLayerLabel(layerName) {
        return LAYER_LABELS[layerName] || layerName || "(unknown)";
    }

    function getRelationshipLabel(relType) {
        return RELATIONSHIP_LABELS[relType] || relType || "(unknown)";
    }

    // =================================================================
    // Public API
    // =================================================================

    var modelGraph = {
        ELEMENT_TO_LAYER: ELEMENT_TO_LAYER,
        RELATIONSHIP_GROUPS: RELATIONSHIP_GROUPS,
        RELATIONSHIP_LABELS: RELATIONSHIP_LABELS,
        DEFAULT_DEPENDENCY_TYPES: DEFAULT_DEPENDENCY_TYPES,
        LAYER_ORDER: LAYER_ORDER,
        LAYER_LABELS: LAYER_LABELS,

        buildGraph: buildGraph,
        findSCCs: findSCCs,
        extractCyclePaths: extractCyclePaths,
        findPathsBFS: findPathsBFS,

        getLayer: getLayer,
        getLayerLabel: getLayerLabel,
        getRelationshipLabel: getRelationshipLabel
    };

    if (typeof globalThis !== "undefined") globalThis.modelGraph = modelGraph;
    if (typeof module !== "undefined" && module.exports) module.exports = modelGraph;
})();
