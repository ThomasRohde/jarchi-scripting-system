/**
 * @module markdownRenderer
 * @description Renders Markdown text to styled HTML for display in SWT Browser.
 * Uses the vendored marked library for conversion and wraps output
 * in a full HTML document with embedded CSS.
 * @version 1.0.0
 */
(function () {
    "use strict";

    if (typeof globalThis !== "undefined" && typeof globalThis.markdownRenderer !== "undefined") return;

    var Files = Java.type("java.nio.file.Files");
    var Paths = Java.type("java.nio.file.Paths");
    var JString = Java.type("java.lang.String");

    var CSS = [
        "* { box-sizing: border-box; }",
        "body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
        "  font-size: 13px; line-height: 1.5; color: #333; padding: 16px;",
        "  margin: 0; background: #fff; }",
        "h1 { font-size: 20px; border-bottom: 1px solid #e1e4e8; padding-bottom: 6px; margin-top: 0; }",
        "h2 { font-size: 16px; border-bottom: 1px solid #e1e4e8; padding-bottom: 4px; }",
        "h3 { font-size: 14px; }",
        "code { background: #f6f8fa; padding: 2px 6px; border-radius: 3px; font-size: 12px; }",
        "pre { background: #f6f8fa; padding: 12px; border-radius: 6px; overflow-x: auto; }",
        "pre code { background: none; padding: 0; }",
        "table { border-collapse: collapse; width: 100%; margin: 12px 0; }",
        "th, td { border: 1px solid #d0d7de; padding: 6px 12px; text-align: left; }",
        "th { background: #f6f8fa; font-weight: 600; }",
        "blockquote { border-left: 3px solid #d0d7de; margin: 12px 0; padding: 4px 16px; color: #656d76; }",
        "ul, ol { padding-left: 24px; }",
        "a { color: #0969da; text-decoration: none; }",
        "hr { border: none; border-top: 1px solid #d0d7de; margin: 16px 0; }",
        "img { max-width: 100%; }"
    ].join("\n");

    /**
     * Render Markdown text to a full HTML document with embedded CSS.
     * @param {string} mdText - Markdown source text
     * @returns {string} Full HTML document string
     */
    function render(mdText) {
        if (!mdText) {
            return wrapHtml("<p style='color:#888;'>No help content available.</p>");
        }

        var htmlBody;
        if (typeof marked !== "undefined" && marked.parse) {
            try {
                htmlBody = marked.parse(mdText);
            } catch (e) {
                // Fallback: escape HTML and wrap in pre
                htmlBody = "<pre>" + escapeHtml(mdText) + "</pre>";
            }
        } else {
            // No marked available — render as preformatted text
            htmlBody = "<pre>" + escapeHtml(mdText) + "</pre>";
        }

        return wrapHtml(htmlBody);
    }

    /**
     * Read a Markdown file and render it to HTML.
     * @param {string} filePath - Absolute path to the .md file
     * @returns {string} Full HTML document string
     */
    function renderFile(filePath) {
        try {
            var path = Paths.get(filePath);
            if (!Files.exists(path)) {
                return wrapHtml("<p style='color:#888;'>Help file not found: " + escapeHtml(filePath) + "</p>");
            }
            var content = new JString(Files.readAllBytes(path), "UTF-8");
            return render(String(content));
        } catch (e) {
            return wrapHtml("<p style='color:#c00;'>Error reading help file: " + escapeHtml(String(e)) + "</p>");
        }
    }

    /**
     * Wrap HTML body content in a full document with CSS.
     * @param {string} body - HTML body content
     * @returns {string} Full HTML document
     */
    function wrapHtml(body) {
        return "<!DOCTYPE html><html><head><meta charset='utf-8'><style>" +
            CSS + "</style></head><body>" + body + "</body></html>";
    }

    /**
     * Basic HTML escaping.
     * @param {string} text
     * @returns {string}
     */
    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    var markdownRenderer = {
        render: render,
        renderFile: renderFile
    };

    if (typeof globalThis !== "undefined") globalThis.markdownRenderer = markdownRenderer;
    if (typeof module !== "undefined" && module.exports) module.exports = markdownRenderer;
})();
