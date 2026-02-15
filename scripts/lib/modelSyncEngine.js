/**
 * @name modelSyncEngine
 * @description Matching, diffing, and apply engine for CSV/JSON model synchronization.
 *   Supports create, update, and delete operations with dry-run preview. Uses a
 *   deterministic matching cascade (ID > external key > name+type) and generates
 *   row-level audit reports.
 * @version 1.0.0
 * @author Thomas Rohde
 * @lastModifiedDate 2026-02-15
 */
(function () {
    "use strict";
    if (typeof globalThis !== "undefined" && typeof globalThis.modelSyncEngine !== "undefined") return;

    var BufferedReader = Java.type("java.io.BufferedReader");
    var InputStreamReader = Java.type("java.io.InputStreamReader");
    var FileInputStream = Java.type("java.io.FileInputStream");
    var OutputStreamWriter = Java.type("java.io.OutputStreamWriter");
    var FileOutputStream = Java.type("java.io.FileOutputStream");
    var BufferedWriter = Java.type("java.io.BufferedWriter");
    var Files = Java.type("java.nio.file.Files");
    var Paths = Java.type("java.nio.file.Paths");
    var JString = Java.type("java.lang.String");

    // =================================================================
    // CSV Parser (reuses parseCsvLine logic from Import from CSV.ajs)
    // =================================================================

    function parseCsvLine(line) {
        var fields = [];
        var current = "";
        var inQuotes = false;
        var i = 0;

        while (i < line.length) {
            var ch = line.charAt(i);
            if (inQuotes) {
                if (ch === '"') {
                    if (i + 1 < line.length && line.charAt(i + 1) === '"') {
                        current += '"';
                        i += 2;
                    } else {
                        inQuotes = false;
                        i++;
                    }
                } else {
                    current += ch;
                    i++;
                }
            } else {
                if (ch === '"') {
                    inQuotes = true;
                    i++;
                } else if (ch === ',') {
                    fields.push(current);
                    current = "";
                    i++;
                } else {
                    current += ch;
                    i++;
                }
            }
        }
        fields.push(current);
        return fields;
    }

    function csvEscape(value) {
        if (value === null || value === undefined) return "";
        var str = String(value);
        if (str.indexOf(",") !== -1 || str.indexOf('"') !== -1 || str.indexOf("\n") !== -1 || str.indexOf("\r") !== -1) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    }

    // =================================================================
    // File Parsing
    // =================================================================

    function parseCsvFile(filePath) {
        var lines = [];
        var reader = new BufferedReader(new InputStreamReader(new FileInputStream(filePath), "UTF-8"));
        try {
            var physicalLine;
            var pending = null;
            while ((physicalLine = reader.readLine()) !== null) {
                var line = String(physicalLine);
                if (pending !== null) {
                    pending += "\n" + line;
                } else {
                    pending = line;
                }
                var quoteCount = 0;
                for (var q = 0; q < pending.length; q++) {
                    if (pending.charAt(q) === '"') {
                        if (q + 1 < pending.length && pending.charAt(q + 1) === '"') {
                            q++;
                        } else {
                            quoteCount++;
                        }
                    }
                }
                if (quoteCount % 2 === 0) {
                    lines.push(pending);
                    pending = null;
                }
            }
            if (pending !== null) {
                lines.push(pending);
            }
        } finally {
            reader.close();
        }

        if (lines.length < 2) {
            return { error: "CSV file is empty or has only a header row." };
        }

        var header = parseCsvLine(lines[0]);
        var headerNorm = header.map(function (h) { return h.trim().toLowerCase(); });

        // Detect format: elements or relationships
        var isElements = headerNorm[0] === "name" && headerNorm[1] === "type";
        var isRelationships = headerNorm[0] === "source" &&
            (headerNorm.indexOf("type") !== -1) &&
            (headerNorm.indexOf("target") !== -1);

        if (!isElements && !isRelationships) {
            return { error: "Unrecognized CSV format. Expected element (Name,Type,...) or relationship (Source,Type,Target,...) headers.\n\nFound: " + header.join(",") };
        }

        var rows = [];
        for (var i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            var fields = parseCsvLine(lines[i]);
            var row = {};
            for (var c = 0; c < header.length; c++) {
                row[header[c].trim()] = c < fields.length ? fields[c] : "";
            }
            row._rowNum = i + 1;
            rows.push(row);
        }

        return {
            headers: header.map(function (h) { return h.trim(); }),
            headerNorm: headerNorm,
            rows: rows,
            format: isElements ? "elements" : "relationships"
        };
    }

    function parseJsonFile(filePath) {
        var path = Paths.get(filePath);
        if (!Files.exists(path)) {
            return { error: "File not found: " + filePath };
        }

        try {
            var content = new JString(Files.readAllBytes(path), "UTF-8");
            var data = JSON.parse(String(content));

            if (!data.format || data.format !== "archimate-sync") {
                return { error: "Invalid JSON format. Expected { \"format\": \"archimate-sync\", ... }" };
            }

            return {
                elements: data.elements || [],
                relationships: data.relationships || [],
                format: "json"
            };
        } catch (e) {
            return { error: "Failed to parse JSON: " + e.toString() };
        }
    }

    // =================================================================
    // Record Normalization
    // =================================================================

    function normalizeRecords(rawData) {
        var elements = [];
        var relationships = [];

        if (rawData.format === "json") {
            // JSON records are already structured
            for (var i = 0; i < rawData.elements.length; i++) {
                var je = rawData.elements[i];
                elements.push({
                    _rowNum: i + 1,
                    _source: "json",
                    id: je.id || "",
                    name: je.name || "",
                    type: je.type || "",
                    documentation: je.documentation || "",
                    properties: je.properties || {}
                });
            }
            for (var i = 0; i < rawData.relationships.length; i++) {
                var jr = rawData.relationships[i];
                relationships.push({
                    _rowNum: i + 1,
                    _source: "json",
                    id: jr.id || "",
                    name: jr.name || "",
                    type: jr.type || "",
                    sourceId: jr.sourceId || "",
                    sourceName: jr.sourceName || "",
                    targetId: jr.targetId || "",
                    targetName: jr.targetName || ""
                });
            }
        } else if (rawData.format === "elements") {
            var headerNorm = rawData.headerNorm;
            for (var i = 0; i < rawData.rows.length; i++) {
                var row = rawData.rows[i];
                var props = {};
                // Extract ext: properties
                for (var h = 0; h < rawData.headers.length; h++) {
                    var hdr = rawData.headers[h];
                    if (hdr.toLowerCase().indexOf("ext:") === 0) {
                        var propKey = hdr.substring(4).trim();
                        if (propKey && row[hdr]) {
                            props[propKey] = row[hdr];
                        }
                    }
                }

                var nameCol = findCol(rawData.headers, "Name");
                var typeCol = findCol(rawData.headers, "Type");
                var idCol = findCol(rawData.headers, "ID");
                var docCol = findCol(rawData.headers, "Documentation");

                elements.push({
                    _rowNum: row._rowNum,
                    _source: "csv",
                    id: idCol ? (row[idCol] || "").trim() : "",
                    name: nameCol ? (row[nameCol] || "").trim() : "",
                    type: typeCol ? (row[typeCol] || "").trim() : "",
                    documentation: docCol ? (row[docCol] || "").trim() : "",
                    properties: props
                });
            }
        } else if (rawData.format === "relationships") {
            for (var i = 0; i < rawData.rows.length; i++) {
                var row = rawData.rows[i];
                var srcCol = findCol(rawData.headers, "Source");
                var srcIdCol = findCol(rawData.headers, "Source ID");
                var typeCol = findCol(rawData.headers, "Type");
                var tgtCol = findCol(rawData.headers, "Target");
                var tgtIdCol = findCol(rawData.headers, "Target ID");
                var nameCol = findCol(rawData.headers, "Name");
                var idCol = findCol(rawData.headers, "ID");

                relationships.push({
                    _rowNum: row._rowNum,
                    _source: "csv",
                    id: idCol ? (row[idCol] || "").trim() : "",
                    name: nameCol ? (row[nameCol] || "").trim() : "",
                    type: typeCol ? (row[typeCol] || "").trim() : "",
                    sourceId: srcIdCol ? (row[srcIdCol] || "").trim() : "",
                    sourceName: srcCol ? (row[srcCol] || "").trim() : "",
                    targetId: tgtIdCol ? (row[tgtIdCol] || "").trim() : "",
                    targetName: tgtCol ? (row[tgtCol] || "").trim() : ""
                });
            }
        }

        return { elements: elements, relationships: relationships };
    }

    function findCol(headers, name) {
        for (var i = 0; i < headers.length; i++) {
            if (headers[i].toLowerCase() === name.toLowerCase()) return headers[i];
        }
        return null;
    }

    // =================================================================
    // Model Index
    // =================================================================

    function buildModelIndex(options) {
        options = options || {};
        var externalKeyProp = options.externalKeyProp || "";

        var index = {
            elementsById: {},
            elementsByExternalKey: {},
            elementsByNameType: {},
            relationshipsById: {},
            relationshipsByKey: {}
        };

        $("element").each(function (el) {
            index.elementsById[el.id] = el;

            // External key
            if (externalKeyProp) {
                var keyVal = el.prop(externalKeyProp);
                if (keyVal && keyVal.trim()) {
                    index.elementsByExternalKey[keyVal.trim()] = el;
                }
            }

            // Name+type index
            var nameKey = (el.name || "").trim().toLowerCase() + "|" + el.type;
            if (!index.elementsByNameType[nameKey]) {
                index.elementsByNameType[nameKey] = [];
            }
            index.elementsByNameType[nameKey].push(el);
        });

        $("relationship").each(function (rel) {
            index.relationshipsById[rel.id] = rel;

            var key = (rel.source ? rel.source.id : "") + "|" +
                rel.type + "|" +
                (rel.target ? rel.target.id : "") + "|" +
                (rel.name || "").trim().toLowerCase();
            if (!index.relationshipsByKey[key]) {
                index.relationshipsByKey[key] = [];
            }
            index.relationshipsByKey[key].push(rel);
        });

        return index;
    }

    // =================================================================
    // Diff Plan Generation
    // =================================================================

    function generateDiffPlan(records, index, config) {
        config = config || {};
        var mode = config.mode || "create-update";
        var externalKeyProp = config.externalKeyProp || "";
        var allowNameTypeMatch = config.allowNameTypeMatch || false;

        var plan = {
            mode: mode,
            toCreate: [],
            toUpdate: [],
            toDelete: [],
            toSkip: [],
            ambiguous: [],
            summary: { createCount: 0, updateCount: 0, deleteCount: 0, skipCount: 0, ambiguousCount: 0 }
        };

        // Track which model elements are "seen" (for delete mode)
        var seenElementIds = {};

        // Collect types present in input
        var inputTypes = {};
        for (var i = 0; i < records.elements.length; i++) {
            inputTypes[records.elements[i].type] = true;
        }

        // --- Process elements ---
        for (var i = 0; i < records.elements.length; i++) {
            var rec = records.elements[i];
            var match = matchElement(rec, index, externalKeyProp, allowNameTypeMatch);

            if (match.status === "matched") {
                seenElementIds[match.element.id] = true;

                if (mode === "create") {
                    plan.toSkip.push({
                        _rowNum: rec._rowNum,
                        record: rec,
                        matchedBy: match.matchedBy,
                        element: match.element,
                        reason: "Already exists (create-only mode)"
                    });
                    plan.summary.skipCount++;
                } else {
                    // Check for differences
                    var changes = computeElementChanges(rec, match.element);
                    if (changes.length > 0) {
                        plan.toUpdate.push({
                            _rowNum: rec._rowNum,
                            record: rec,
                            matchedBy: match.matchedBy,
                            element: match.element,
                            changes: changes
                        });
                        plan.summary.updateCount++;
                    } else {
                        plan.toSkip.push({
                            _rowNum: rec._rowNum,
                            record: rec,
                            matchedBy: match.matchedBy,
                            element: match.element,
                            reason: "No changes detected"
                        });
                        plan.summary.skipCount++;
                    }
                }
            } else if (match.status === "ambiguous") {
                plan.ambiguous.push({
                    _rowNum: rec._rowNum,
                    record: rec,
                    matchCount: match.candidates.length,
                    candidates: match.candidates
                });
                plan.summary.ambiguousCount++;
            } else {
                // Not found — create
                plan.toCreate.push({
                    _rowNum: rec._rowNum,
                    record: rec
                });
                plan.summary.createCount++;
            }
        }

        // --- Delete mode: find model elements not in input ---
        if (mode === "create-update-delete") {
            $("element").each(function (el) {
                if (seenElementIds[el.id]) return;
                if (!inputTypes[el.type]) return;

                var viewCount = $(el).viewRefs().size();
                var relCount = $(el).rels().size();

                plan.toDelete.push({
                    element: el,
                    viewCount: viewCount,
                    relCount: relCount
                });
                plan.summary.deleteCount++;
            });
        }

        // --- Process relationships ---
        var relPlan = processRelationships(records.relationships, index, config, plan);
        plan.relToCreate = relPlan.toCreate;
        plan.relToUpdate = relPlan.toUpdate;
        plan.relToSkip = relPlan.toSkip;
        plan.relAmbiguous = relPlan.ambiguous;
        plan.summary.relCreateCount = relPlan.toCreate.length;
        plan.summary.relUpdateCount = relPlan.toUpdate.length;
        plan.summary.relSkipCount = relPlan.toSkip.length;
        plan.summary.relAmbiguousCount = relPlan.ambiguous.length;

        return plan;
    }

    function matchElement(rec, index, externalKeyProp, allowNameTypeMatch) {
        // 1. Match by ID
        if (rec.id) {
            var byId = index.elementsById[rec.id];
            if (byId) {
                return { status: "matched", element: byId, matchedBy: "ID" };
            }
        }

        // 2. Match by external key property
        if (externalKeyProp && rec.properties && rec.properties[externalKeyProp]) {
            var keyVal = rec.properties[externalKeyProp].trim();
            var byKey = index.elementsByExternalKey[keyVal];
            if (byKey) {
                return { status: "matched", element: byKey, matchedBy: "External Key (" + externalKeyProp + ")" };
            }
        }

        // 3. Match by name+type (opt-in only)
        if (allowNameTypeMatch && rec.name && rec.type) {
            var nameKey = rec.name.trim().toLowerCase() + "|" + rec.type;
            var candidates = index.elementsByNameType[nameKey];
            if (candidates && candidates.length === 1) {
                return { status: "matched", element: candidates[0], matchedBy: "Name+Type" };
            }
            if (candidates && candidates.length > 1) {
                return { status: "ambiguous", candidates: candidates };
            }
        }

        return { status: "not-found" };
    }

    function computeElementChanges(rec, existing) {
        var changes = [];

        if (rec.name && rec.name !== (existing.name || "")) {
            changes.push({ field: "name", oldValue: existing.name || "", newValue: rec.name });
        }

        if (rec.documentation && rec.documentation !== (existing.documentation || "")) {
            changes.push({ field: "documentation", oldValue: existing.documentation || "", newValue: rec.documentation });
        }

        // Property changes
        if (rec.properties) {
            var propKeys = Object.keys(rec.properties);
            for (var p = 0; p < propKeys.length; p++) {
                var key = propKeys[p];
                var newVal = rec.properties[key];
                var oldVal = existing.prop(key) || "";
                if (newVal !== oldVal) {
                    changes.push({ field: "property:" + key, oldValue: oldVal, newValue: newVal });
                }
            }
        }

        return changes;
    }

    function processRelationships(relRecords, index, config, elementPlan) {
        var result = { toCreate: [], toUpdate: [], toSkip: [], ambiguous: [] };
        var mode = config.mode || "create-update";

        for (var i = 0; i < relRecords.length; i++) {
            var rec = relRecords[i];

            // Match by ID
            if (rec.id && index.relationshipsById[rec.id]) {
                var existing = index.relationshipsById[rec.id];
                if (mode === "create") {
                    result.toSkip.push({
                        _rowNum: rec._rowNum,
                        record: rec,
                        matchedBy: "ID",
                        relationship: existing,
                        reason: "Already exists (create-only mode)"
                    });
                } else {
                    var changes = [];
                    if (rec.name && rec.name !== (existing.name || "")) {
                        changes.push({ field: "name", oldValue: existing.name || "", newValue: rec.name });
                    }
                    if (changes.length > 0) {
                        result.toUpdate.push({
                            _rowNum: rec._rowNum,
                            record: rec,
                            matchedBy: "ID",
                            relationship: existing,
                            changes: changes
                        });
                    } else {
                        result.toSkip.push({
                            _rowNum: rec._rowNum,
                            record: rec,
                            matchedBy: "ID",
                            relationship: existing,
                            reason: "No changes detected"
                        });
                    }
                }
                continue;
            }

            // Resolve source and target
            var sourceEl = resolveRelEndpoint(rec.sourceId, rec.sourceName, index);
            var targetEl = resolveRelEndpoint(rec.targetId, rec.targetName, index);

            if (!sourceEl) {
                result.ambiguous.push({
                    _rowNum: rec._rowNum,
                    record: rec,
                    reason: "Source not found: " + (rec.sourceName || rec.sourceId)
                });
                continue;
            }
            if (!targetEl) {
                result.ambiguous.push({
                    _rowNum: rec._rowNum,
                    record: rec,
                    reason: "Target not found: " + (rec.targetName || rec.targetId)
                });
                continue;
            }

            // Check for existing relationship with same key
            var relKey = sourceEl.id + "|" + rec.type + "|" + targetEl.id + "|" + (rec.name || "").trim().toLowerCase();
            var existing = index.relationshipsByKey[relKey];
            if (existing && existing.length > 0) {
                result.toSkip.push({
                    _rowNum: rec._rowNum,
                    record: rec,
                    matchedBy: "Key (source+type+target+name)",
                    relationship: existing[0],
                    reason: "Already exists"
                });
                continue;
            }

            // Create
            result.toCreate.push({
                _rowNum: rec._rowNum,
                record: rec,
                resolvedSource: sourceEl,
                resolvedTarget: targetEl
            });
        }

        return result;
    }

    function resolveRelEndpoint(id, name, index) {
        if (id) {
            var byId = index.elementsById[id];
            if (byId) return byId;
        }
        if (name) {
            // Try by name (any type)
            var nameKey = name.trim().toLowerCase();
            var keys = Object.keys(index.elementsByNameType);
            for (var k = 0; k < keys.length; k++) {
                if (keys[k].indexOf(nameKey + "|") === 0) {
                    var candidates = index.elementsByNameType[keys[k]];
                    if (candidates.length === 1) return candidates[0];
                }
            }
        }
        return null;
    }

    // =================================================================
    // Apply Diff Plan
    // =================================================================

    function applyDiffPlan(plan, index) {
        var outcomes = {
            elementsCreated: 0,
            elementsUpdated: 0,
            elementsDeleted: 0,
            relsCreated: 0,
            relsUpdated: 0,
            failed: 0,
            details: []
        };

        // 1. Create elements
        for (var i = 0; i < plan.toCreate.length; i++) {
            var item = plan.toCreate[i];
            try {
                var newEl = model.createElement(item.record.type, item.record.name);
                if (item.record.documentation) {
                    newEl.documentation = item.record.documentation;
                }
                if (item.record.properties) {
                    var propKeys = Object.keys(item.record.properties);
                    for (var p = 0; p < propKeys.length; p++) {
                        newEl.prop(propKeys[p], item.record.properties[propKeys[p]]);
                    }
                }
                // Register in index for relationship resolution
                index.elementsById[newEl.id] = newEl;
                var nameKey = (newEl.name || "").trim().toLowerCase() + "|" + newEl.type;
                if (!index.elementsByNameType[nameKey]) {
                    index.elementsByNameType[nameKey] = [];
                }
                index.elementsByNameType[nameKey].push(newEl);

                outcomes.elementsCreated++;
                outcomes.details.push({
                    _rowNum: item._rowNum,
                    action: "created",
                    name: item.record.name,
                    type: item.record.type,
                    newId: newEl.id
                });
            } catch (e) {
                outcomes.failed++;
                outcomes.details.push({
                    _rowNum: item._rowNum,
                    action: "failed",
                    name: item.record.name,
                    type: item.record.type,
                    error: e.toString()
                });
            }
        }

        // 2. Update elements
        for (var i = 0; i < plan.toUpdate.length; i++) {
            var item = plan.toUpdate[i];
            try {
                var el = item.element;
                for (var c = 0; c < item.changes.length; c++) {
                    var change = item.changes[c];
                    if (change.field === "name") {
                        el.name = change.newValue;
                    } else if (change.field === "documentation") {
                        el.documentation = change.newValue;
                    } else if (change.field.indexOf("property:") === 0) {
                        var propKey = change.field.substring(9);
                        el.prop(propKey, change.newValue);
                    }
                }
                outcomes.elementsUpdated++;
                outcomes.details.push({
                    _rowNum: item._rowNum,
                    action: "updated",
                    name: el.name,
                    type: el.type,
                    id: el.id,
                    changeCount: item.changes.length
                });
            } catch (e) {
                outcomes.failed++;
                outcomes.details.push({
                    _rowNum: item._rowNum,
                    action: "failed",
                    name: item.record.name,
                    type: item.record.type,
                    error: e.toString()
                });
            }
        }

        // 3. Delete elements
        if (plan.toDelete) {
            for (var i = 0; i < plan.toDelete.length; i++) {
                var item = plan.toDelete[i];
                try {
                    var name = item.element.name || "(unnamed)";
                    var type = item.element.type;
                    var id = item.element.id;
                    item.element.delete();
                    outcomes.elementsDeleted++;
                    outcomes.details.push({
                        action: "deleted",
                        name: name,
                        type: type,
                        id: id
                    });
                } catch (e) {
                    outcomes.failed++;
                    outcomes.details.push({
                        action: "failed",
                        name: item.element.name || "(unnamed)",
                        type: item.element.type,
                        error: e.toString()
                    });
                }
            }
        }

        // 4. Create relationships
        if (plan.relToCreate) {
            for (var i = 0; i < plan.relToCreate.length; i++) {
                var item = plan.relToCreate[i];
                try {
                    // Re-resolve endpoints (may have been created in step 1)
                    var sourceEl = item.resolvedSource || resolveRelEndpoint(
                        item.record.sourceId, item.record.sourceName, index);
                    var targetEl = item.resolvedTarget || resolveRelEndpoint(
                        item.record.targetId, item.record.targetName, index);

                    if (!sourceEl || !targetEl) {
                        outcomes.failed++;
                        outcomes.details.push({
                            _rowNum: item._rowNum,
                            action: "failed",
                            name: item.record.name || "",
                            type: item.record.type,
                            error: "Could not resolve source or target"
                        });
                        continue;
                    }

                    var newRel = model.createRelationship(item.record.type, item.record.name || "", sourceEl, targetEl);
                    outcomes.relsCreated++;
                    outcomes.details.push({
                        _rowNum: item._rowNum,
                        action: "rel-created",
                        name: item.record.name || "",
                        type: item.record.type,
                        newId: newRel.id
                    });
                } catch (e) {
                    outcomes.failed++;
                    outcomes.details.push({
                        _rowNum: item._rowNum,
                        action: "failed",
                        name: item.record.name || "",
                        type: item.record.type,
                        error: e.toString()
                    });
                }
            }
        }

        // 5. Update relationships
        if (plan.relToUpdate) {
            for (var i = 0; i < plan.relToUpdate.length; i++) {
                var item = plan.relToUpdate[i];
                try {
                    var rel = item.relationship;
                    for (var c = 0; c < item.changes.length; c++) {
                        var change = item.changes[c];
                        if (change.field === "name") {
                            rel.name = change.newValue;
                        }
                    }
                    outcomes.relsUpdated++;
                    outcomes.details.push({
                        _rowNum: item._rowNum,
                        action: "rel-updated",
                        name: rel.name || "",
                        type: rel.type,
                        id: rel.id
                    });
                } catch (e) {
                    outcomes.failed++;
                    outcomes.details.push({
                        _rowNum: item._rowNum,
                        action: "failed",
                        name: item.record.name || "",
                        type: item.record.type,
                        error: e.toString()
                    });
                }
            }
        }

        return outcomes;
    }

    // =================================================================
    // Report Generation
    // =================================================================

    function generateReport(plan, outcomes, path) {
        var writer = new BufferedWriter(new OutputStreamWriter(new FileOutputStream(path), "UTF-8"));
        try {
            writer.write("Row,Action,Name,Type,ID,Matched By,Changes,Error");
            writer.newLine();

            // Created elements
            for (var i = 0; i < outcomes.details.length; i++) {
                var d = outcomes.details[i];
                var row = [
                    d._rowNum || "",
                    d.action,
                    csvEscape(d.name || ""),
                    csvEscape(d.type || ""),
                    d.newId || d.id || "",
                    d.matchedBy || "",
                    d.changeCount || "",
                    csvEscape(d.error || "")
                ];
                writer.write(row.join(","));
                writer.newLine();
            }

            // Skipped
            var allSkipped = (plan.toSkip || []).concat(plan.relToSkip || []);
            for (var i = 0; i < allSkipped.length; i++) {
                var s = allSkipped[i];
                var name = s.record ? (s.record.name || "") : "";
                var type = s.record ? (s.record.type || "") : "";
                var id = s.element ? s.element.id : (s.relationship ? s.relationship.id : "");
                writer.write([
                    s._rowNum || "",
                    "skipped",
                    csvEscape(name),
                    csvEscape(type),
                    id,
                    s.matchedBy || "",
                    "",
                    csvEscape(s.reason || "")
                ].join(","));
                writer.newLine();
            }

            // Ambiguous
            var allAmbiguous = (plan.ambiguous || []).concat(plan.relAmbiguous || []);
            for (var i = 0; i < allAmbiguous.length; i++) {
                var a = allAmbiguous[i];
                var name = a.record ? (a.record.name || "") : "";
                var type = a.record ? (a.record.type || "") : "";
                writer.write([
                    a._rowNum || "",
                    "ambiguous",
                    csvEscape(name),
                    csvEscape(type),
                    "",
                    "",
                    a.matchCount || "",
                    csvEscape(a.reason || (a.matchCount + " candidates"))
                ].join(","));
                writer.newLine();
            }
        } finally {
            writer.close();
        }
    }

    // =================================================================
    // Public API
    // =================================================================

    var modelSyncEngine = {
        parseCsvFile: parseCsvFile,
        parseJsonFile: parseJsonFile,
        normalizeRecords: normalizeRecords,
        buildModelIndex: buildModelIndex,
        generateDiffPlan: generateDiffPlan,
        applyDiffPlan: applyDiffPlan,
        generateReport: generateReport
    };

    if (typeof globalThis !== "undefined") globalThis.modelSyncEngine = modelSyncEngine;
    if (typeof module !== "undefined" && module.exports) module.exports = modelSyncEngine;
})();
