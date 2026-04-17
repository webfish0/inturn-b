import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

assert.match(html, /<script src="app-logic\.js"><\/script>/, "index.html should load the shared logic helper.");
assert.match(html, /id="editor-diagnostics"/, "index.html should include the editor diagnostics panel.");

const inlineScriptMatch = html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/);
assert.ok(inlineScriptMatch, "Expected to find the inline application script.");

new vm.Script(inlineScriptMatch[1], { filename: "index-inline.js" });
