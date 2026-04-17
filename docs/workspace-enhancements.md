# Workspace Persistence And Templates

## Problem Analysis

The current editor is strong at direct manipulation, but it still has avoidable workflow breaks:

- A refresh or accidental tab close can discard work because the app does not recover the last local draft.
- Every new diagram starts from the same example, which slows users down when they want a more specific starting point.
- Layout choices such as zoom and panel sizing reset between sessions, forcing repeated setup.
- The toolbar exports images but does not provide a fast way to save the editable PlantUML source locally.
- There was no repeatable regression coverage for persistence behavior, so changes in the single-file app could easily break recovery flows unnoticed.

## Requirements

1. The editor must provide a starter template picker with at least three useful sequence-diagram starting points.
2. Applying a starter template must replace the current editor model, update PlantUML text, and preserve a clear indication of which template is active.
3. The editor must autosave the active sequence workspace locally during normal editing and rendering.
4. On reload, the editor must restore the most recent local draft and surface that recovery state to the user.
5. Users must be able to discard the recovered draft and return to the currently selected starter template.
6. The editor must remember workspace preferences locally: active tab, preview zoom, selected starter template, and editor panel sizes.
7. Users must be able to save the current PlantUML source locally from the toolbar and via keyboard shortcut.
8. Keyboard shortcuts must support fast editing for the current app surface:
   `Cmd/Ctrl+N` reset current diagram
   `Cmd/Ctrl+S` save PlantUML source
   `Cmd/Ctrl+Enter` apply PlantUML text
   `Delete`/`Backspace` remove the selected editor item when focus is not inside a field

## Test Design

### Automated regression coverage

- Starter template application:
  verify the selected template snapshot populates participants, messages, fragments, and auto-numbering as expected.
- Draft persistence and recovery:
  verify a locally saved draft restores editable text and marks the workspace as recovered.
- UI preference persistence:
  verify saved zoom, active tab, selected template, and panel sizes round-trip through local storage.
- Source save behavior:
  verify save uses the active editor source for both the sequence editor and the C4 tab.

### Manual browser checks

- Load each starter template from the toolbar and confirm the diagram, source text, and numbering controls all update together.
- Refresh the page after editing the text panel without applying; confirm the draft returns and the recovery banner appears.
- Discard the recovered draft; confirm the banner clears and the selected starter template becomes the live document.
- Resize the editor panels and change zoom, refresh the page, and confirm the layout is retained.
- Use `Cmd/Ctrl+S` in both the sequence editor and C4 tab and confirm the browser downloads `.puml` files with the expected contents.
