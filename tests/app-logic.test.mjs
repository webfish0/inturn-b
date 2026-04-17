import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { analyzePlantUmlText, resolveShortcutAction, sanitizeWorkspaceSnapshot } = require("../app-logic.js");

test("analyzePlantUmlText reports unmatched fragments", () => {
  const result = analyzePlantUmlText(`
@startuml
actor User
loop retry
User -> API: call
@enduml
  `);

  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /missing a matching end/i);
  assert.equal(result.errors[0].line, 4);
});

test("analyzePlantUmlText warns about implicit participants", () => {
  const result = analyzePlantUmlText(`
@startuml
User -> API: call
@enduml
  `);

  assert.equal(result.errors.length, 0);
  assert.equal(result.warnings.length, 2);
  assert.match(result.warnings[0].message, /not declared explicitly/i);
});

test("resolveShortcutAction ignores export shortcuts while typing", () => {
  const action = resolveShortcutAction(
    {
      key: "s",
      metaKey: true,
      shiftKey: true,
      target: { tagName: "textarea", isContentEditable: false }
    },
    { activeTab: "editor" }
  );

  assert.equal(action, null);
});

test("resolveShortcutAction maps apply and tab shortcuts", () => {
  assert.equal(
    resolveShortcutAction(
      { key: "Enter", metaKey: true, target: { tagName: "div", isContentEditable: false } },
      { activeTab: "editor" }
    ),
    "apply-sequence"
  );

  assert.equal(
    resolveShortcutAction(
      { key: "3", altKey: true, target: { tagName: "div", isContentEditable: false } },
      { activeTab: "editor" }
    ),
    "switch-c4"
  );

  assert.equal(
    resolveShortcutAction(
      { key: "P", metaKey: true, shiftKey: true, target: { tagName: "div", isContentEditable: false } },
      { activeTab: "editor" }
    ),
    "export-png"
  );
});

test("sanitizeWorkspaceSnapshot clamps layout values", () => {
  const snapshot = sanitizeWorkspaceSnapshot({
    activeTab: "invalid",
    previewScale: 12,
    leftPanelWidth: 1,
    rightPanelWidth: 900,
    topRowHeight: "bad",
    sequenceSource: "@startuml\n@enduml",
    c4Source: "@startuml\n@enduml"
  });

  assert.deepEqual(snapshot, {
    version: 1,
    activeTab: "editor",
    previewScale: 2,
    leftPanelWidth: 220,
    rightPanelWidth: 520,
    topRowHeight: 620,
    sequenceSource: "@startuml\n@enduml",
    c4Source: "@startuml\n@enduml"
  });
});
