(function (global, factory) {
  const exported = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = exported;
  }
  global.InturnAppLogic = exported;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const FRAGMENT_KEYWORDS = new Set(["loop", "alt", "opt", "par"]);

  function unquotePlantToken(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (text.startsWith("\"") && text.endsWith("\"")) {
      return text.slice(1, -1).replace(/\\"/g, "\"").trim();
    }
    return text;
  }

  function isQuotedPlantToken(value) {
    const text = String(value || "").trim();
    return text.startsWith("\"") && text.endsWith("\"");
  }

  function parseParticipantDeclarationLine(line) {
    const match = String(line || "").trim().match(/^(participant|actor|boundary|control|entity|database)\s+(.+)$/i);
    if (!match) return null;

    const keyword = match[1].toLowerCase();
    const rest = match[2].trim();
    const declMatch = rest.match(/^("[^"]+"|[\w.-]+)(?:\s+as\s+("[^"]+"|[\w .-]+))?$/i);
    if (!declMatch) return null;

    const firstRaw = String(declMatch[1] || "").trim();
    const secondRaw = String(declMatch[2] || "").trim();
    const firstValue = unquotePlantToken(firstRaw);
    const secondValue = unquotePlantToken(secondRaw);
    if (!firstValue) return null;

    const firstQuoted = isQuotedPlantToken(firstRaw);
    const secondQuoted = isQuotedPlantToken(secondRaw);
    let displayName = firstValue;
    let alias = null;

    if (secondRaw) {
      if (firstQuoted && !secondQuoted) {
        displayName = firstValue;
        alias = secondValue;
      } else if (!firstQuoted && secondQuoted) {
        displayName = secondValue;
        alias = firstValue;
      } else {
        displayName = firstValue;
        alias = secondValue;
      }
    }

    return {
      type: keyword === "participant" ? "entity" : keyword,
      alias,
      displayName,
      referenceName: alias || displayName
    };
  }

  function parseMessageLine(line) {
    const text = String(line || "").trim();
    if (!text) return null;

    const arrowMatch = text.match(/--x|-->|->>|->/);
    if (!arrowMatch || arrowMatch.index == null) return null;

    const arrow = arrowMatch[0];
    const fromRaw = text.slice(0, arrowMatch.index).trim();
    const remainder = text.slice(arrowMatch.index + arrow.length).trim();
    if (!fromRaw || !remainder) return null;

    const colonIndex = remainder.indexOf(":");
    const toRaw = (colonIndex >= 0 ? remainder.slice(0, colonIndex) : remainder).trim();
    const label = colonIndex >= 0 ? remainder.slice(colonIndex + 1).trim() : "";
    if (!toRaw) return null;

    return {
      from: unquotePlantToken(fromRaw),
      arrow,
      to: unquotePlantToken(toRaw),
      label
    };
  }

  function parseNoteTargetName(rawTarget) {
    const text = String(rawTarget || "").trim();
    if (!text) return "";
    const noLeadingOf = text.replace(/^of\s+/i, "").trim();
    const firstTarget = noLeadingOf.split(",")[0].trim();
    return unquotePlantToken(firstTarget);
  }

  function pushDiagnostic(collection, severity, line, message) {
    collection.push({ severity, line, message });
  }

  function analyzePlantUmlText(source) {
    const text = String(source || "");
    const diagnostics = [];
    const declaredParticipants = new Set();
    const fragmentStack = [];
    let hasStart = false;
    let hasEnd = false;

    const lines = text.split(/\r?\n/);
    lines.forEach((rawLine, index) => {
      const lineNumber = index + 1;
      const line = rawLine.trim();
      if (!line) return;

      if (line === "@startuml") {
        hasStart = true;
        return;
      }

      if (line === "@enduml") {
        hasEnd = true;
        return;
      }

      if (line.startsWith("'") || line.startsWith("!") || line.toLowerCase().startsWith("title ")) {
        return;
      }

      const participantDecl = parseParticipantDeclarationLine(line);
      if (participantDecl) {
        declaredParticipants.add(participantDecl.referenceName);
        declaredParticipants.add(participantDecl.displayName);
        return;
      }

      const firstWord = line.split(/\s+/, 1)[0].toLowerCase();
      if (FRAGMENT_KEYWORDS.has(firstWord)) {
        fragmentStack.push({ kind: firstWord, line: lineNumber });
        return;
      }

      if (line.toLowerCase() === "end") {
        if (!fragmentStack.length) {
          pushDiagnostic(diagnostics, "error", lineNumber, "Unexpected 'end' without an open fragment.");
        } else {
          fragmentStack.pop();
        }
        return;
      }

      const parsedMessage = parseMessageLine(line);
      if (parsedMessage) {
        if (!declaredParticipants.has(parsedMessage.from)) {
          pushDiagnostic(diagnostics, "warning", lineNumber, 'Message source "' + parsedMessage.from + '" is not declared explicitly.');
        }
        if (!declaredParticipants.has(parsedMessage.to)) {
          pushDiagnostic(diagnostics, "warning", lineNumber, 'Message target "' + parsedMessage.to + '" is not declared explicitly.');
        }
        return;
      }

      const noteMatch = line.match(/^note\s+(left|right|over)(?:\s+of)?\s+(.+?)\s*:\s*(.*)$/i);
      if (noteMatch) {
        const targetName = parseNoteTargetName(noteMatch[2]);
        if (targetName && !declaredParticipants.has(targetName)) {
          pushDiagnostic(diagnostics, "warning", lineNumber, 'Note target "' + targetName + '" is not declared explicitly.');
        }
      }
    });

    if (!hasStart) {
      pushDiagnostic(diagnostics, "warning", 1, "PlantUML source is missing @startuml.");
    }

    if (!hasEnd) {
      pushDiagnostic(diagnostics, "warning", Math.max(1, lines.length), "PlantUML source is missing @enduml.");
    }

    while (fragmentStack.length) {
      const open = fragmentStack.pop();
      pushDiagnostic(diagnostics, "error", open.line, 'Fragment "' + open.kind + '" is missing a matching end.');
    }

    return {
      diagnostics,
      errors: diagnostics.filter((item) => item.severity === "error"),
      warnings: diagnostics.filter((item) => item.severity === "warning")
    };
  }

  function clampNumber(value, min, max, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
  }

  function sanitizeWorkspaceSnapshot(raw) {
    let parsed = raw;
    if (typeof raw === "string") parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    return {
      version: 1,
      activeTab: ["editor", "ai", "c4"].includes(parsed.activeTab) ? parsed.activeTab : "editor",
      previewScale: clampNumber(parsed.previewScale, 0.5, 2, 1),
      leftPanelWidth: clampNumber(parsed.leftPanelWidth, 220, 520, 280),
      rightPanelWidth: clampNumber(parsed.rightPanelWidth, 260, 520, 340),
      topRowHeight: clampNumber(parsed.topRowHeight, 220, 1400, 620),
      sequenceSource: typeof parsed.sequenceSource === "string" ? parsed.sequenceSource : "",
      c4Source: typeof parsed.c4Source === "string" ? parsed.c4Source : ""
    };
  }

  function isEditableTarget(target) {
    if (!target || typeof target !== "object") return false;
    const tagName = String(target.tagName || "").toLowerCase();
    return Boolean(target.isContentEditable) || tagName === "input" || tagName === "textarea" || tagName === "select";
  }

  function resolveShortcutAction(event, context) {
    const details = event || {};
    const activeTab = (context && context.activeTab) || "editor";
    const key = String(details.key || "").toLowerCase();
    const hasModifier = Boolean(details.metaKey || details.ctrlKey);
    const editable = isEditableTarget(details.target);

    if (!hasModifier && !details.altKey) return null;

    if (details.altKey && !hasModifier && !details.shiftKey) {
      if (key === "1") return "switch-editor";
      if (key === "2") return "switch-ai";
      if (key === "3") return "switch-c4";
      return null;
    }

    if (!hasModifier) return null;
    if (editable && key !== "enter") return null;

    if (!details.shiftKey && key === "n") return "new";
    if (key === "enter") return activeTab === "c4" ? "apply-c4" : "apply-sequence";
    if (details.shiftKey && key === "s") return "export-svg";
    if (details.shiftKey && key === "p") return "export-png";
    if (details.shiftKey && key === "j") return "export-jpeg";
    return null;
  }

  return {
    analyzePlantUmlText,
    parseMessageLine,
    parseNoteTargetName,
    parseParticipantDeclarationLine,
    resolveShortcutAction,
    sanitizeWorkspaceSnapshot,
    unquotePlantToken
  };
});
