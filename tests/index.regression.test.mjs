import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function createStyle() {
  const values = new Map();
  return {
    setProperty(name, value) {
      values.set(name, String(value));
    },
    getPropertyValue(name) {
      return values.get(name) || "";
    }
  };
}

function createElement(tagName = "div") {
  const style = createStyle();
  return {
    tagName: String(tagName).toUpperCase(),
    children: [],
    dataset: {},
    style,
    className: "",
    textContent: "",
    innerHTML: "",
    value: "",
    checked: false,
    hidden: false,
    disabled: false,
    placeholder: "",
    title: "",
    scrollLeft: 0,
    scrollTop: 0,
    width: 0,
    height: 0,
    addEventListener() {},
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    removeChild(child) {
      this.children = this.children.filter((entry) => entry !== child);
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 1200, height: 800 };
    },
    setAttribute(name, value) {
      this[name] = String(value);
    },
    getAttribute(name) {
      return this[name] || "";
    },
    focus() {},
    select() {},
    remove() {},
    click() {},
    contains() {
      return false;
    },
    classList: {
      toggle() {},
      add() {},
      remove() {}
    }
  };
}

function loadApp(sharedStorage = new Map()) {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const match = html.match(/<script>([\s\S]*)<\/script>\s*<\/body>/);
  assert.ok(match, "Expected inline script in index.html");
  const source = match[1].replace(/\binit\(\);\s*$/, "");

  const storage = sharedStorage;
  const elements = new Map();
  const document = {
    title: "inturn",
    body: createElement("body"),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement());
      return elements.get(id);
    },
    createElement(tagName) {
      return createElement(tagName);
    },
    querySelectorAll() {
      return [];
    },
    addEventListener() {}
  };

  const sandbox = {
    console,
    Blob,
    URL: {
      createObjectURL() {
        return "blob:mock";
      },
      revokeObjectURL() {}
    },
    TextEncoder,
    TextDecoder,
    Uint8Array,
    setTimeout(fn) {
      if (typeof fn === "function") fn();
      return 1;
    },
    clearTimeout() {},
    btoa(value) {
      return Buffer.from(value, "binary").toString("base64");
    },
    atob(value) {
      return Buffer.from(value, "base64").toString("binary");
    },
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
      removeItem(key) {
        storage.delete(key);
      }
    },
    sessionStorage: {
      getItem() {
        return null;
      },
      setItem() {},
      removeItem() {}
    },
    navigator: {},
    location: { href: "https://example.test/", search: "", pathname: "/", hash: "" },
    history: { replaceState() {} },
    document,
    getComputedStyle(node) {
      return node.style;
    },
    confirm() {
      return true;
    }
  };
  sandbox.window = sandbox;
  sandbox.window.addEventListener = () => {};
  sandbox.window.removeEventListener = () => {};
  sandbox.window.innerWidth = 1440;
  sandbox.window.innerHeight = 900;
  sandbox.Image = class MockImage {};

  const exportSource = `${source}
globalThis.__app = {
  state,
  STARTER_TEMPLATES,
  populateTemplateOptions,
  syncTemplateUi,
  getStarterTemplate,
  cloneTemplateModel,
  applyTemplateSnapshot,
  resetDiagram,
  hydrateWorkspaceUiState,
  applyWorkspaceLayoutState,
  persistWorkspaceUiState,
  persistWorkspaceDraft,
  restoreWorkspaceDraft,
  clearWorkspaceDraft,
  serializePlantUml,
  parsePlantUml,
  applyPlantUmlText,
  savePlantUmlSource,
  exportModelSnapshot,
  activeDiagramFileName,
  switchTab
};
globalThis.__elements = {
  textArea,
  c4SourceText,
  templateSelect,
  mainLayout,
  statusEl,
  c4Status,
  workspaceBanner,
  workspaceBannerText
};`;

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(new URL("../app-logic.js", import.meta.url), "utf8"), sandbox, { filename: "app-logic.js" });
  vm.runInContext(exportSource, sandbox, { filename: "index.html" });
  return { app: sandbox.__app, elements: sandbox.__elements, storage, sandbox };
}

test("starter template selection applies the chosen model", () => {
  const { app } = loadApp();
  app.populateTemplateOptions();
  app.state.workspace.selectedTemplateId = "starter-async";
  app.resetDiagram({ skipAutosave: true });

  assert.equal(app.state.participants.length, 4);
  assert.equal(app.state.messages.length, 5);
  assert.equal(app.state.autoNumber.enabled, true);
  assert.equal(app.state.autoNumber.start, 10);
  assert.equal(app.state.fragments[0].kind, "loop");
});

test("parses AI-style multi-line notes and group fragments", () => {
  const { app } = loadApp();
  const parsed = app.parsePlantUml(`
@startuml
participant User
participant API
group retry flow
User -> API: Submit request
note right of API
  Validate the payload
  Return a detailed error
end note
end
@enduml
  `);

  assert.equal(parsed.fragments.length, 1);
  assert.equal(parsed.fragments[0].kind, "group");
  assert.equal(parsed.notes.length, 1);
  assert.equal(parsed.notes[0].targetId, "p2");
  assert.equal(parsed.notes[0].text, "Validate the payload\nReturn a detailed error");
});

test("serializes multi-line notes as PlantUML note blocks", () => {
  const { app } = loadApp();
  app.applyPlantUmlText(`
@startuml
participant User
participant API
User -> API: Submit request
note right of API
  Validate the payload
  Return a detailed error
end note
@enduml
  `);

  const serialized = app.serializePlantUml();
  assert.match(serialized, /note right of API\n  Validate the payload\n  Return a detailed error\nend note/);
});

test("workspace draft persistence restores recovered text and banner state", () => {
  const { app, elements, storage } = loadApp();
  app.resetDiagram({ skipAutosave: true });
  elements.textArea.value = "@startuml\nactor User\nUser -> UI: draft change\n@enduml";

  app.persistWorkspaceDraft("typing");
  app.applyTemplateSnapshot("starter-login", { skipAutosave: true });
  const restored = app.restoreWorkspaceDraft();

  assert.equal(restored, true);
  assert.match(elements.textArea.value, /draft change/);
  assert.equal(app.state.workspace.bannerMode, "restored");
  assert.ok(storage.get("sequence-diagram-editor-workspace-draft-v1"));
});

test("workspace UI state persists preview scale, active tab, and template", () => {
  const storage = new Map();
  const { app, elements } = loadApp(storage);
  app.state.previewScale = 1.6;
  app.state.activeTab = "c4";
  app.state.workspace.selectedTemplateId = "starter-login";
  elements.mainLayout.style.setProperty("--left-panel-width", "312px");
  elements.mainLayout.style.setProperty("--right-panel-width", "390px");
  elements.mainLayout.style.setProperty("--top-row-height", "58%");

  app.persistWorkspaceUiState();

  const { app: restoredApp, elements: restoredElements } = loadApp(storage);
  restoredApp.hydrateWorkspaceUiState();
  restoredApp.applyWorkspaceLayoutState();

  assert.equal(restoredApp.state.previewScale, 1.6);
  assert.equal(restoredApp.state.activeTab, "c4");
  assert.equal(restoredApp.state.workspace.selectedTemplateId, "starter-login");
  assert.equal(restoredElements.mainLayout.style.getPropertyValue("--left-panel-width"), "312px");
  assert.equal(restoredElements.mainLayout.style.getPropertyValue("--right-panel-width"), "390px");
  assert.equal(restoredElements.mainLayout.style.getPropertyValue("--top-row-height"), "58.0%");
  assert.ok(storage.get("sequence-diagram-editor-workspace-ui-v1"));
});

test("save source exports the active diagram text for editor and C4 tabs", () => {
  const { app, elements, sandbox } = loadApp();
  const downloads = [];
  sandbox.downloadBlob = (content, name, mime) => {
    downloads.push({ content, name, mime });
  };

  app.resetDiagram({ skipAutosave: true });
  elements.textArea.value = "@startuml\nactor User\n@enduml";
  app.state.activeTab = "editor";
  app.savePlantUmlSource();

  elements.c4SourceText.value = "@startuml\nPerson(user, User)\n@enduml";
  app.state.activeTab = "c4";
  app.savePlantUmlSource();

  assert.equal(downloads.length, 2);
  assert.equal(downloads[0].name, "diagram.puml");
  assert.match(String(downloads[0].content), /actor User/);
  assert.equal(downloads[1].name, "c4-diagram.puml");
  assert.match(String(downloads[1].content), /Person\(user, User\)/);
});
