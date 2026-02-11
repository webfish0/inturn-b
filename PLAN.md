# Sequence Diagram Editor (PlantUML) – Architecture and Delivery Plan

Status
- Scope confirmed: v1 supports PlantUML Sequence diagrams only
- Runtime: 100% client-side web app, no backend
- Current implementation: single-file app (`index.html`) with custom SVG renderer and PlantUML-compatible text sync
- Rendering: local SVG generation from in-memory model (no remote calls)
- Export: SVG, PNG, and JPEG fully client-side
- Testing: manual interaction validation in browser; Playwright plan retained as next phase

Objectives
- Provide an in-browser editor for PlantUML sequence diagrams featuring:
  - Main View Panel: Live diagram render (SVG) with direct manipulation handles
  - Tool Panel: Add participants, notes, messages, and logic fragments (loop, alt, opt, par)
  - Properties Panel: Edit attributes of selected item (label, type, from/to endpoints, note position, note vertical offset, fragment start/end)
  - Text Panel: PlantUML source editor kept in real-time sync with the model
  - Export: SVG, PNG, and JPEG export entirely client-side
  - In-place editing: Double-click labels in the visualization to edit without leaving canvas context
  - Drag interactions:
    - Reorder participants and message order
    - Drag message endpoints to change source/destination participants
    - Drag notes horizontally to retarget and vertically by free offset
    - Drag fragments to move ranges and resize via top/bottom handles
    - Drag messages into and out of logic containers to expand/contract membership
- Enable UI test strategy that an LLM agent can execute via the browser

Non-Goals (v1)
- Other diagram types (Class, Activity, etc.)
- Collaboration/multi-user editing
- Backend or remote renderers
- Full PlantUML DSL coverage beyond core Sequence constructs

Tech Stack
- UI: Vanilla HTML/CSS/JS (current implementation: single-file `index.html`)
- Rendering: In-memory sequence model -> generated SVG
- Editor: Native textarea with model synchronization
- State management: In-memory JS state object with explicit render cycle
- Build: Static hosting, no build tool required
- Tests: Playwright for UI automation, LLM-oriented test checklists, accessibility checks

High-Level Architecture
- View Layer
  - MainView: Displays rendered diagram (SVG)
  - ToolPanel: UI buttons/menus to insert and manipulate sequence elements
  - PropertiesPanel: Form bound to selected model element
  - TextPanel: Native textarea synchronized with DiagramModel
  - AppShell: Layout, routing of events between panels and state
- Model Layer
  - DiagramModel: In-memory representation of sequence diagram
  - SelectionModel: Current selection (item id, caret position ranges)
  - Mappers: DSL <-> Model round trip (idempotent as possible)
  - Validation: Lifeline ordering, fragment nesting correctness, dangling participant detection
- Rendering Layer
  - SVGRenderer: Model-driven SVG generation for participants/messages/notes/fragments
- IO Layer
  - FileManager: File System Access API + fallback
  - Exporter: SVG/PNG export utilities
- Controller/Actions
  - Commands: addParticipant, addMessage, addNote, wrapFragment, deleteItem, updateProperty, duplicateItem, swapMessageDirection, reorderParticipant, wrapSelectionInFragment
  - Undo/Redo: simple stack (v1 required)

Data Flow
1) User interaction (tool click, property edit, text change) triggers Command
2) Command mutates DiagramModel via Store, emits change event
3) Store publishes updates to:
   - TextPanel (sync DSL)
   - Renderer (recompile to SVG)
   - PropertiesPanel (reload selected item state)
   - MainView (re-render SVG, preserve viewport where possible)

Module Boundaries
- Current footprint:
  - `index.html`: UI layout, state, drag interactions, inline editing, parse/serialize, and export handlers
- Planned modular split (next refactor):
  - `app.js`, `state.js`, `dsl.js`, `renderer.js`, `export.js`, `ui/*`

UI Layout Wireframes
Note: ASCII wireframes use relative proportions and data-testid annotations.

Wireframe – Desktop layout

+-------------------------------------------------------------------------------------+
| App Toolbar [data-testid=app-toolbar]                                               |
| [New] [Open] [Save] [Export SVG] [Export PNG] [Undo] [Redo] [Settings]              |
+---------------------------+--------------------------------------+------------------+
| Tool Panel                | Main View Panel                      | Properties Panel |
| [data-testid=tool-panel]  | [data-testid=main-view]              | [data-testid=props-panel]  |
|                           |                                      |                  |
| + Participants            | +----------------------------------+ | + General        |
|   - Add Actor             | | Rendered SVG (pan/zoom)          | | Name: [      ]  |
|   - Add Boundary          | | [data-testid=render-svg]         | | Type: [select]  |
|   - Add Control           | +----------------------------------+ | Lifeline: [..]   |
|   - Add Entity            |                                      | Stereotype: [ ]  |
|   - Add Database          |                                      | Color: [     ]   |
|                           |                                      | + Message        |
| + Messages                |                                      | Label: [      ]  |
|   - Synchronous           |                                      | Arrow: [select]  |
|   - Asynchronous          |                                      | Return: [     ]  |
|   - Create                |                                      | + Note           |
|   - Destroy               |                                      | Text: [      ]   |
|                           |                                      | Position: [..]   |
| + Fragments               |                                      | + Fragment       |
|   - alt / opt / loop      |                                      | Type: [select]   |
|   - group / critical      |                                      | Guard: [      ]  |
|   - par / break / ref     |                                      |                  |
| + Notes                   |                                      |                  |
|   - Note left/right       |                                      |                  |
+---------------------------+--------------------------------------+------------------+
| Text Panel [data-testid=text-panel]                                                |
| @startuml ... @enduml (native textarea editor)                                     |
+-------------------------------------------------------------------------------------+

Responsive behavior
- Narrow screens: Properties Panel becomes a bottom drawer toggled by a button.
- Main View takes precedence; Text Panel collapsible.

Key Interactions
- Tool actions add model elements, update selection, then regenerate preview and PlantUML text.
- Selecting an SVG element updates the properties panel and item list state without replacing the SVG DOM, preserving reliable double-click editing.
- Double-click on participant/message/note/fragment labels opens an inline editor at the click position.
- Dragging message endpoint handles updates `fromId` and `toId` directly.
- Dragging a message row vertically reorders message sequence; fragment ranges remap to preserve logic structure.
- Dragging a message into a fragment area expands that fragment to include the message.
- Dragging a message out of a fragment contracts (or removes) that fragment when no longer containing the moved message.
- Dragging fragment resize handles updates start and end message indices.
- Dragging notes updates target participant (x-axis) and free vertical offset (y-axis).
- Right-click on a message opens an arrow context menu:
  - Reverse direction
  - Change arrow color
  - Toggle dotted style
  - Menu closes after action, on outside left click, and on Escape
- Text edits re-parse DSL and rebuild model; selection can be inferred from text caret line.

PlantUML Rendering (Local)
- Use local model-driven SVG generation
  - API concept: `buildSvg(diagramModel)` -> SVG string
- SVG to PNG flow (client-side):
  - Option A: drawImage on canvas from SVG data URL then canvas.toBlob
  - Option B: OffscreenCanvas for performance, fallback to Canvas
- Performance:
  - Re-render on model change; selection-only actions avoid full redraw when possible
  - Use incremental UI updates for item selection and property sync
- Security:
  - No remote calls required for rendering path
  - Sanitize any external text before embedding in SVG labels

Model to DSL and DSL to Model
- Model schema (simplified):
  - participants: [{id, name, type, stereotype?, color?, lifelineStyle?, numberingEnabled?}]
  - messages: [{id, fromId, toId, label, arrowType, color, dotted}]
  - notes: [{id, targetId?, text, position, offsetY}]
  - fragments: [{id, kind, label, startIndex, endIndex}]
  - lifelines derived from participants
- DSL serialization
  - participants -> actor/boundary/control/entity/database declarations
  - messages -> A -> B: label
  - message styling -> comment line `' style color=#RRGGBB dotted=0|1` after message
  - notes -> Note over/left/right of target
  - note vertical offset -> comment line `' note-offset <int>` after note
  - fragments -> alt/opt/loop blocks with guards
- Parsing strategy:
  - Use a tolerant line-by-line parser recognizing common constructs with region-based incremental reparse (only changed lines/blocks)
  - Maintain per-node source maps for precise selection highlighting and error surfacing
  - Parse comment metadata for style/offset; keep backward compatibility with `' note-row`
- Round trip approach:
  - Prefer model as source of truth; regenerate DSL from model on command actions
  - When user edits text, re-parse and update model (best-effort); mark unknown nodes as opaque blocks that survive serialization

Export Design
- Export SVG:
  - Current render SVG string downloaded as .svg with UTF-8 and xml declaration; filenames derived from diagram title
- Export PNG:
  - Convert SVG to Image, draw to Canvas, toBlob, then download as .png
- Export JPEG:
  - Convert SVG to Image, draw on white canvas background, toBlob as `.jpeg`
- Resolution:
  - Current implementation exports raster images at 2x scale
- Determinism:
  - Use same compile input as Text Panel content to avoid drift

File I/O
- Primary: File System Access API
  - New: initialize empty template (@startuml ... @enduml)
  - Open: showOpenFilePicker (".puml", ".plantuml", ".iuml")
  - Save/Save As: createWritable and write text
- Fallback (browsers without FSA):
  - Open: Input[type=file] to read file text
  - Save: Blob download (anchor with download attribute)
- Autosave (optional): LocalStorage snapshot of last working document with timestamp
- Optional: Shareable read-only link via query-string encoded (lz-string) document when hosted statically (no backend)

Accessibility and UX
- Keyboard shortcuts:
  - Cmd/Ctrl+N, O, S, Shift+S, Z, Shift+Z, P (export PNG), V (export SVG)
- Focus management:
  - Toolbar, Tool Panel, Properties inputs, Editor all tabbable with labels
- High contrast mode, prefers-color-scheme support
- Persistent UI state: last open panel sizes with CSS grid and splitter drag handles; remember zoom level and last-used tool
- Templates/snippets: quick palette with searchable common flows (CRUD, login, async job); starter template picker on New
- Participant reorder: drag/drop list in Tool Panel or up/down arrows
- Context menu behavior: always closes on action, Escape, and outside left click

Error Handling
- Render errors:
  - Show inline diagnostic panel with PlantUML error output
  - Highlight approximate range in Text Panel with jump-to-line
- Parse errors:
  - Mark gutter with icon; preserve text, do not destructively modify
- Linting:
  - Flag common sequence issues (dangling participant references, unmatched fragments) with non-blocking warnings
- IO errors:
  - Toast banners with retry actions

Command API (examples)
- addParticipant(type, name)
- addMessage(fromId, toId, label, arrowType, style)
- insertMessageAfterSelection(arrowType)
- addNote(targetId, text, position, offsetY)
- wrapFragment(kind, guard, selectionRange)
- updateProperty(itemId, key, value)
- deleteItem(itemId)
- duplicateItem(itemId)
- swapMessageDirection(messageId)
- setMessageStyle(messageId, {color, dotted})
- setMessageEndpoints(messageId, fromId, toId)
- reorderParticipant(participantId, direction)
- resizeFragment(fragmentId, startIndex, endIndex)
- ensureMessageInsideFragment(fragmentId, messageIndex)
- ensureMessageOutsideFragment(fragmentId, messageIndex)

Initial Tool Panel Actions to Support
- Participants: Actor, Boundary, Control, Entity, Database
- Messages: Synchronous (->), Asynchronous (->>), Return (-->), Create, Destroy
- Notes: Note left, Note right, Note over
- Fragments: loop, alt, opt, par
- View/Selection: Zoom in/out/reset, pan drag, scroll-to-selection

State Synchronization Rules
- Single source of truth: DiagramModel
- Text Panel modifies DiagramModel via debounced parsing
- Visual selection maps to model item id and text range
- Properties Panel two-way binds to selected model item
- Undo/Redo operates on model diffs (JSON patches or cloned snapshots)

WASM Packaging Considerations
- Current version does not require WASM
- Future option:
  - Introduce plantuml-wasm build for strict DSL fidelity
  - Run compile in Worker with lazy init and cache compiled assets

Security Policy
- No network fetch in renderer
- No remote includes in PlantUML; if present, notify user and skip
- Sandbox iframe (optional) for rendering step if needed to isolate SVG parsing

LLM-Oriented UI Test Strategy
- Goals:
  - Allow an LLM or script to deterministically drive the UI
  - Provide stable selectors and explicit step prompts
- Conventions:
  - All interactive elements have data-testid attributes:
    - app-toolbar, tool-panel, main-view, render-svg, props-panel, text-panel
    - toolbar-new, toolbar-open, toolbar-save, toolbar-export-svg, toolbar-export-png
    - tool-add-actor, tool-add-message-sync, tool-add-note-left, tool-wrap-alt, etc.
    - props-name-input, props-type-select, props-guard-input
  - Panels labeled with aria-label and headings for clarity
- Playwright Test Harness:
  - Launchs the static app with file:// scheme or via a simple static server
  - Example flows:
    1) Create diagram smoke:
       - Click [toolbar-new]
       - Click [tool-add-actor] twice; set names in [props-name-input]
       - Add message [tool-add-message-sync] from A to B; set label
       - Assert SVG contains expected participant names and message arrow
    2) Text sync:
       - Type into [text-panel] editor a valid PlantUML snippet
       - Assert model reflects participants count (via UI observable) and SVG updates
    3) Export:
       - Trigger [toolbar-export-png] with scale 2x
       - Intercept download event, validate file name and non-empty size
    4) Save/Load (fallback mode):
       - Use mock File System Access polyfill or stub to validate calls
    5) Inline edit:
       - Double-click message label in SVG; edit and assert text/props/model update
    6) Drag logic behavior:
       - Drag message into fragment and assert fragment expands; drag out and assert fragment contracts
    7) Context menu:
       - Right-click message, change arrow style, assert menu closes after action and outside click
    8) Golden render:
       - Compare SVG snapshot or checksum against known fixtures to detect regressions
  - Accessibility checks:
       - Axe/Playwright-axe to catch common issues
- LLM Test Plan Document:
  - Human-readable checklist describing step-by-step instructions and expected outcomes
  - Mirrors Playwright specs for easy cross-validation

Milestones and Acceptance Criteria
M1: Project skeleton and rendering
- App shell with four panels and toolbar
- Render default template to SVG from local model
- Basic error panel and state sync
Acceptance: Given default template, SVG renders locally without network

M2: Tools and Model
- Implement DiagramModel and basic commands: addParticipant, addMessage, addNote
- Selection mapping between SVG and model
- Properties panel editing for common fields; participant reorder; endpoint drag edits
Acceptance: Adding items via Tool Panel updates Text and SVG; editing properties updates both; participant reorder and endpoint drag reflect in text and SVG; notes support free vertical drag

M3: DSL round-trip
- Serialize model to PlantUML DSL
- Parse DSL to model with tolerant fallback
- Text edits update model and re-render
Acceptance: Simple scenes round-trip with stable serialization; message style and note offset comments are preserved; logic block start/end ranges remain coherent after drag reorder and drag in/out behavior

M4: Export and File I/O
- Export SVG, PNG, and JPEG
- File System Access API Save/Open with fallback
Acceptance: User can save .puml and export raster/vector formats offline; JPEG uses white background; filenames reflect diagram title

M5: Testing and Accessibility
- Playwright smoke tests; data-testid coverage; golden SVG fixtures
- LLM test plan document
- Basic a11y pass with Playwright-axe
Acceptance: CI passes tests; test plan covers inline edits, context-menu close rules, fragment resize, and drag in/out logic containers

Risks and Mitigations
- DSL parser tolerance:
  - Start with subset; preserve unknown blocks; incrementally expand coverage
- Drag/resize interaction complexity:
  - Keep deterministic index mapping functions for message moves and fragment updates
  - Add focused tests for drag into/out of fragment boundaries and fragment resize handles
- PNG fidelity:
  - Validate with multiple diagrams; offer scale controls
- JPEG visual quality:
  - Export on white background and tune quality parameter
- File System Access support:
  - Ensure robust fallback download/upload path

Open Questions (Post-v1)
- History visualization or timeline beyond basic undo/redo
- Snap-to-grid lifeline positioning (if we add more visual editing)
- Theming and custom styles for participants/messages
- Support additional PlantUML diagram types behind feature flags

Appendix: Example Minimal DSL Template
@startuml
actor User
boundary UI
User -> UI: click
@enduml

Appendix: Initial Data-TestIDs
- [data-testid=app-toolbar]
- [data-testid=tool-panel]
- [data-testid=main-view]
- [data-testid=render-svg]
- [data-testid=props-panel]
- [data-testid=text-panel]
- [data-testid=toolbar-new]
- [data-testid=toolbar-open]
- [data-testid=toolbar-save]
- [data-testid=toolbar-export-svg]
- [data-testid=toolbar-export-png]
- [data-testid=toolbar-export-jpeg]
- [data-testid=tool-add-actor]
- [data-testid=tool-add-boundary]
- [data-testid=tool-add-control]
- [data-testid=tool-add-entity]
- [data-testid=tool-add-database]
- [data-testid=tool-add-message-sync]
- [data-testid=tool-add-message-async]
- [data-testid=tool-add-message-return]
- [data-testid=tool-add-message-create]
- [data-testid=tool-add-message-destroy]
- [data-testid=tool-add-note-left]
- [data-testid=tool-add-note-right]
- [data-testid=tool-add-note-over]
- [data-testid=tool-wrap-alt]
- [data-testid=tool-wrap-opt]
- [data-testid=tool-wrap-loop]
- [data-testid=tool-zoom-in]
- [data-testid=tool-zoom-out]
- [data-testid=tool-zoom-reset]
- [data-testid=tool-reorder-up]
- [data-testid=tool-reorder-down]
- [data-testid=tool-duplicate]
- [data-testid=props-name-input]
- [data-testid=props-type-select]
- [data-testid=props-guard-input]
- [data-testid=context-menu]
- [data-testid=ctx-reverse-arrow]
- [data-testid=ctx-arrow-color]
- [data-testid=ctx-arrow-dotted]

Mermaid Wireframes (high-level layout)
Note: Avoiding double quotes and parentheses inside brackets per requirement.

flowchart LR
  A[App Toolbar] --- B[Tool Panel]
  A --- C[Main View Panel]
  A --- D[Properties Panel]
  E[Text Panel] --- C

classDef panel fill:#eef,stroke:#99c,stroke-width:1px
class B,C,D,E panel

Sequence of Core Interactions
1. User clicks tool-add-actor
2. Controller dispatches addParticipant
3. State updates DiagramModel and SelectionModel
4. DSL serializer regenerates text
5. SVG renderer regenerates visualization from model
6. Main View updates; Properties panel binds to new selection
7. User can double-click labels to edit inline or drag handles to update structure

Delivery Notes
- This plan is intentionally framework-light to minimize dependencies and keep interactions debuggable.
- Current implementation is single-file for fast iteration; modular split is planned once behavior stabilizes.
- PlantUML WASM remains an optional future enhancement for stricter full-DSL fidelity.
