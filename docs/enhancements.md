# Editor Diagnostics And Navigation Shortcuts

## Problem Analysis

The workspace branch already improved persistence and publishing, but two gaps remained in the editor flow:

- malformed PlantUML could still be applied without explaining what went wrong
- shortcut coverage was split across features, which made export and tab navigation harder to discover
- the enhancement set did not yet have a single repo-level summary that linked the shipped improvements together

## Requirements

1. Applying PlantUML with structural errors must not replace the current rendered diagram state.
2. The editor must show line-specific parse diagnostics for errors and warnings directly below the source controls.
3. Diagnostics must be actionable: selecting one moves focus to the matching source line.
4. Warnings for implicit participant references should still allow the source to apply so the editor stays flexible.
5. Keyboard shortcuts must support quick new/apply/export/navigation actions without hijacking normal typing in fields.
6. Primary editor actions should surface shortcut hints so users can learn them in context.
7. The repo must keep a durable enhancement log that points to the detailed requirement documents for each shipped improvement.

## Validation

### Automated

- `node --test tests/index.regression.test.mjs`
- `node --test tests/publish-change.test.mjs`
- `node --test tests/app-logic.test.mjs`
- `node tests/validate-index-html.mjs`

### Manual regression

- Apply invalid PlantUML and confirm the current diagram remains intact while diagnostics appear with line jumps.
- Apply valid PlantUML and confirm the diagnostics panel clears and the preview updates.
- Trigger the documented shortcuts and confirm save/template interactions still behave normally.
