# inturn – PlantUML Sequence Diagram Editor

**inturn** is a browser-based editor for [PlantUML](https://plantuml.com/) sequence diagrams. It runs entirely client-side with no backend, no build step, and no installation required – just open `index.html` in a modern browser.

---

## Features

- **Live diagram preview** – Renders a sequence diagram as SVG in real time as you type or click.
- **Tool panel** – Point-and-click insertion of participants (actor, boundary, control, entity, database), messages (synchronous, asynchronous, create, destroy), notes, and logic fragments (alt, opt, loop, group, par, …).
- **Properties panel** – Edit attributes of the selected element (label, arrow type, color, note position, fragment guard, etc.) without touching the source text.
- **Text panel** – Native `<textarea>` PlantUML source editor kept in two-way sync with the visual model.
- **Direct manipulation** – Drag to reorder participants and messages, retarget message endpoints, move notes, and resize fragments.
- **Inline editing** – Double-click any label in the diagram to edit it in place.
- **Export** – Download the current diagram as **SVG**, **PNG**, or **JPEG** entirely client-side.
- **File I/O** – Open / save `.puml` / `.plantuml` / `.iuml` files via the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) with a fallback for browsers that do not support it.
- **Undo / Redo** – Full command history.
- **Keyboard shortcuts** – `Ctrl/Cmd` + `N` (new), `O` (open), `S` (save), `Shift+S` (save as), `Z` / `Shift+Z` (undo/redo), `P` (export PNG), `V` (export SVG).

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | Vanilla HTML5, CSS3, JavaScript (ES2020+) |
| Rendering | Custom in-memory model → generated SVG (no remote calls) |
| Editor | Native `<textarea>` with model synchronization |
| State | In-memory JS state object with explicit render cycle |
| Build | None – static single-file app |
| Tests | [Playwright](https://playwright.dev/) (planned) |

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Modern browser | Chrome 89+, Edge 89+, Firefox 90+, Safari 15+ |
| Optional: local HTTP server | Only needed if your browser blocks `file://` access for certain APIs (e.g. File System Access API works best over `http://`) |

No Node.js, npm, Python, or any other runtime is required to *use* the app.
A local server is only recommended for the best file-save experience; the app still works when opened directly as a file.

---

## Running Locally

### Option A – Open directly in the browser (simplest)

```bash
# 1. Clone the repository
git clone https://github.com/webfish0/inturn-b.git
cd inturn-b

# 2. Open index.html in your browser
open index.html          # macOS
start index.html         # Windows
xdg-open index.html      # Linux
```

> **Note:** Some browsers restrict certain web APIs (e.g. clipboard, File System Access) on `file://` URLs. If you notice issues with file saving, use Option B.

### Option B – Serve with a local HTTP server (recommended)

Any static file server will work. Examples:

```bash
# Python 3
python3 -m http.server 8080

# Node.js (npx – no install required)
npx serve .

# VS Code
# Install the "Live Server" extension, then right-click index.html → "Open with Live Server"
```

Then navigate to `http://localhost:8080` (or the port shown by your server) and open `index.html`.

---

## Project Structure

```
inturn-b/
├── index.html   # Complete application (UI, state, rendering, export)
├── PLAN.md      # Architecture & delivery plan (source of truth for design decisions)
└── README.md    # This file
```

The app is intentionally kept as a single file for zero-dependency portability. A planned refactor (tracked in `PLAN.md`) will split it into `app.js`, `state.js`, `dsl.js`, `renderer.js`, `export.js`, and `ui/*` modules.

---

## Basic Usage

1. **Start a new diagram** – Click **New** in the toolbar or press `Ctrl/Cmd+N`. A starter `@startuml … @enduml` template loads automatically.
2. **Add participants** – Use the **Tool Panel** on the left to add actors, boundaries, controls, entities, or databases.
3. **Add messages** – Select two participants and insert a synchronous/asynchronous/create/destroy message from the Tool Panel.
4. **Add notes and fragments** – Use the Tool Panel to attach notes or wrap messages in logic blocks (alt, opt, loop, …).
5. **Edit text directly** – The **Text Panel** at the bottom always reflects the current diagram source. You can type or paste valid PlantUML sequence syntax there; the diagram updates on every keystroke.
6. **Select and edit** – Click any element in the diagram to open its attributes in the **Properties Panel** on the right.
7. **Export** – Click **Export SVG**, **Export PNG**, or **Export JPEG** in the toolbar.
8. **Save** – Click **Save** (`Ctrl/Cmd+S`) to write to a `.puml` file via the File System Access API (or download a file in unsupported browsers).

---

## Troubleshooting

| Symptom | Solution |
|---|---|
| **"Save" does nothing** | Your browser may not support the File System Access API. Use a Chromium-based browser (Chrome, Edge) or serve the app over `http://` (Option B above). The app falls back to a file-download link automatically. |
| **Diagram does not update** | Make sure the text in the Text Panel starts with `@startuml` and ends with `@enduml`. Check the browser console (`F12`) for parse errors. |
| **Export PNG/JPEG is blank** | This can happen when the SVG contains external resources that are blocked by the browser's `<canvas>` CORS policy. Ensure the diagram uses only built-in shapes (no remote images). |
| **File chooser does not open** | Pop-up blockers can suppress the file picker. Check your browser's notification bar for a blocked pop-up warning. |
| **App looks broken on mobile** | The layout is optimized for desktop-width viewports (≥ 900 px). On narrow screens, the Properties Panel collapses into a bottom drawer; use the toggle button to show/hide it. |

---

## Contributing

1. Fork the repository and create a feature branch.
2. Make your changes in `index.html` (or the modular files once the refactor lands).
3. Test your changes manually in at least one Chromium-based browser.
4. Open a pull request against `master` with a clear description of the change.

Playwright-based automated UI tests are planned (see `PLAN.md`). Once they are in place, run them before submitting a PR:

```bash
# (Future – not yet available)
npx playwright test
```

---

## License

See repository for license information.
