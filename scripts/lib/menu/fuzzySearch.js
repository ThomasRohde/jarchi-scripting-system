/**
 * @module fuzzySearch
 * @description VS Code-style fuzzy search scorer for script descriptors.
 * Scores text matches with bonuses for prefix, consecutive, word boundary,
 * camelCase, and exact case matches. Searches across multiple descriptor
 * fields with configurable weights.
 * @version 1.0.0
 */
(function () {
    "use strict";

    if (typeof globalThis !== "undefined" && typeof globalThis.fuzzySearch !== "undefined") return;

    // Scoring constants
    var BONUS_PREFIX = 15;
    var BONUS_CONSECUTIVE = 5;
    var BONUS_WORD_BOUNDARY = 10;
    var BONUS_CAMEL_CASE = 8;
    var BONUS_EXACT_CASE = 1;
    var PENALTY_UNMATCHED = -0.5;

    // Field weights for multi-field search
    var FIELD_WEIGHTS = {
        title: 1.0,
        tags: 0.8,
        id: 0.6,
        category: 0.5,
        description: 0.4
    };

    /**
     * Check if a character is uppercase.
     * @param {string} ch
     * @returns {boolean}
     */
    function isUpper(ch) {
        return ch >= "A" && ch <= "Z";
    }

    /**
     * Check if a character is a word boundary character.
     * @param {string} ch
     * @returns {boolean}
     */
    function isSeparator(ch) {
        return ch === " " || ch === "-" || ch === "_" || ch === "." || ch === "/" || ch === "\\";
    }

    /**
     * Score a query against a single text string.
     * Returns null if no match, otherwise {score, matches[]}.
     *
     * @param {string} query - The search query (case-insensitive matching)
     * @param {string} text - The text to match against
     * @returns {Object|null} {score: number, matches: number[]} or null
     */
    function score(query, text) {
        if (!query || !text) return null;

        var queryLower = query.toLowerCase();
        var textLower = text.toLowerCase();
        var queryLen = queryLower.length;
        var textLen = textLower.length;

        if (queryLen === 0) return null;
        if (queryLen > textLen) return null;

        // Quick check: all query chars exist in text
        var qi = 0;
        for (var ti = 0; ti < textLen && qi < queryLen; ti++) {
            if (textLower[ti] === queryLower[qi]) qi++;
        }
        if (qi < queryLen) return null;

        // Dynamic programming to find best match positions
        // Use a greedy approach with backtracking for simplicity and performance
        var bestScore = -Infinity;
        var bestMatches = null;

        // Try matching from different starting positions
        var startPositions = [];
        for (var s = 0; s < textLen; s++) {
            if (textLower[s] === queryLower[0]) {
                startPositions.push(s);
            }
        }

        for (var sp = 0; sp < startPositions.length; sp++) {
            var matches = [];
            var totalScore = 0;
            var consecutive = 0;
            var matched = true;
            var qIdx = 0;

            for (var tIdx = startPositions[sp]; tIdx < textLen && qIdx < queryLen; tIdx++) {
                if (textLower[tIdx] === queryLower[qIdx]) {
                    matches.push(tIdx);
                    var charScore = 0;

                    // Prefix bonus: matching at the start of text
                    if (tIdx === 0 && qIdx === 0) {
                        charScore += BONUS_PREFIX;
                    }

                    // Consecutive bonus
                    if (matches.length > 1 && tIdx === matches[matches.length - 2] + 1) {
                        consecutive++;
                        charScore += BONUS_CONSECUTIVE * consecutive;
                    } else {
                        consecutive = 0;
                    }

                    // Word boundary bonus
                    if (tIdx > 0 && isSeparator(text[tIdx - 1])) {
                        charScore += BONUS_WORD_BOUNDARY;
                    }

                    // CamelCase bonus
                    if (tIdx > 0 && isUpper(text[tIdx]) && !isUpper(text[tIdx - 1])) {
                        charScore += BONUS_CAMEL_CASE;
                    }

                    // Exact case bonus
                    if (query[qIdx] === text[tIdx]) {
                        charScore += BONUS_EXACT_CASE;
                    }

                    totalScore += charScore;
                    qIdx++;
                }
            }

            if (qIdx < queryLen) {
                matched = false;
            }

            if (matched) {
                // Unmatched character penalty
                var unmatchedChars = textLen - queryLen;
                totalScore += unmatchedChars * PENALTY_UNMATCHED;

                if (totalScore > bestScore) {
                    bestScore = totalScore;
                    bestMatches = matches.slice();
                }
            }
        }

        if (bestMatches === null) return null;

        return {
            score: bestScore,
            matches: bestMatches
        };
    }

    /**
     * Search across all descriptors using fuzzy matching on multiple fields.
     * Returns results sorted by score descending, then title ascending.
     *
     * @param {string} query - The search query
     * @param {Object[]} descriptors - Array of ScriptDescriptor objects
     * @returns {Object[]} Array of {descriptor, score, fieldMatches} sorted by score desc
     */
    function search(query, descriptors) {
        if (!query || query.trim().length === 0) return [];

        var results = [];
        var trimmedQuery = query.trim();

        for (var i = 0; i < descriptors.length; i++) {
            var desc = descriptors[i];
            var bestScore = -Infinity;
            var fieldMatches = {};
            var hasMatch = false;

            // Score title
            var titleResult = score(trimmedQuery, desc.title || "");
            if (titleResult) {
                var weighted = titleResult.score * FIELD_WEIGHTS.title;
                fieldMatches.title = titleResult;
                if (weighted > bestScore) bestScore = weighted;
                hasMatch = true;
            }

            // Score tags (take best tag match)
            if (desc.tags && desc.tags.length > 0) {
                for (var t = 0; t < desc.tags.length; t++) {
                    var tagResult = score(trimmedQuery, desc.tags[t]);
                    if (tagResult) {
                        var tagWeighted = tagResult.score * FIELD_WEIGHTS.tags;
                        if (tagWeighted > bestScore) bestScore = tagWeighted;
                        fieldMatches.tags = tagResult;
                        hasMatch = true;
                    }
                }
            }

            // Score id
            var idResult = score(trimmedQuery, desc.id || "");
            if (idResult) {
                var idWeighted = idResult.score * FIELD_WEIGHTS.id;
                if (idWeighted > bestScore) bestScore = idWeighted;
                fieldMatches.id = idResult;
                hasMatch = true;
            }

            // Score category (joined)
            var catJoined = (desc.category || []).join(" > ");
            var catResult = score(trimmedQuery, catJoined);
            if (catResult) {
                var catWeighted = catResult.score * FIELD_WEIGHTS.category;
                if (catWeighted > bestScore) bestScore = catWeighted;
                fieldMatches.category = catResult;
                hasMatch = true;
            }

            // Score description
            var descResult = score(trimmedQuery, desc.description || "");
            if (descResult) {
                var descWeighted = descResult.score * FIELD_WEIGHTS.description;
                if (descWeighted > bestScore) bestScore = descWeighted;
                fieldMatches.description = descResult;
                hasMatch = true;
            }

            if (hasMatch) {
                results.push({
                    descriptor: desc,
                    score: bestScore,
                    fieldMatches: fieldMatches
                });
            }
        }

        // Sort by score desc, then title asc, then id asc
        results.sort(function (a, b) {
            var scoreDiff = b.score - a.score;
            if (Math.abs(scoreDiff) > 0.001) return scoreDiff;

            var titleCmp = (a.descriptor.title || "").toLowerCase()
                .localeCompare((b.descriptor.title || "").toLowerCase());
            if (titleCmp !== 0) return titleCmp;

            return (a.descriptor.id || "").localeCompare((b.descriptor.id || ""));
        });

        return results;
    }

    var fuzzySearch = {
        score: score,
        search: search
    };

    if (typeof globalThis !== "undefined") globalThis.fuzzySearch = fuzzySearch;
    if (typeof module !== "undefined" && module.exports) module.exports = fuzzySearch;
})();
