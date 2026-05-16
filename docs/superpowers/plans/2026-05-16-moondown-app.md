# Moondown App Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the blank-paper Moondown desktop editor, fix CI, add native folder/file/export/settings workflows, and verify the macOS app.

**Architecture:** React owns editor, settings, folder tree, and menu action state. Focused `src/lib` modules provide file, export, folder, metrics, and settings behavior. Rust builds the native Tauri menu and forwards commands to the frontend.

**Tech Stack:** React 19, Vite 8, TypeScript 6, Tauri 2, `moondown@^1.0.0`, `markdown-it`, `docx`, `jszip`, official Tauri fs/dialog plugins, GitHub Actions with `tauri-apps/tauri-action@v0.6.2`.

---

### Task 1: Lock the regression checks

**Files:**
- Modify: `scripts/check-app.mjs`

- [ ] Add checks that fail while the app still has visible toolbar/sidebar chrome.
- [ ] Add checks for native menu events, settings sheet, folder opening, all export formats, hidden title, invisible drag strip, rounded logo background, and a resolvable Tauri action version.
- [ ] Run `pnpm test:app` and confirm it fails on the old implementation.

### Task 2: Build the native menu and CI fix

**Files:**
- Modify: `.github/workflows/build.yml`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `src-tauri/tauri.conf.json`

- [ ] Replace `tauri-apps/tauri-action@v1` with `tauri-apps/tauri-action@v0.6.2`.
- [ ] Add native menu items for file, folder, save, export, settings, theme, syntax hiding, and folder tree.
- [ ] Emit a single `moondown-menu` event with a string action payload.
- [ ] Grant fs permissions for reading folders and writing exported files.

### Task 3: Add focused app modules

**Files:**
- Create: `src/lib/settings.ts`
- Create: `src/lib/markdown.ts`
- Create: `src/lib/exporters.ts`
- Modify: `src/lib/fileActions.ts`

- [ ] Define persisted editor settings with safe defaults.
- [ ] Add Markdown metrics, title derivation, plain text stripping, and basic HTML rendering helpers.
- [ ] Add native/browser file open, folder open, recursive folder tree loading, save, export, settings import, and settings export helpers.
- [ ] Add export support for Markdown, TXT, HTML, DOCX, JPG, and EPUB.

### Task 4: Rebuild the writing surface

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/MoondownEditor.tsx`
- Modify: `src/styles.css`

- [ ] Remove the visible toolbar, brand bar, startup content, title input, outline rail, and card-like editor surface.
- [ ] Start with an empty document and focus the editor on launch.
- [ ] Add an invisible top drag region and a very subtle lower-right status line.
- [ ] Show the folder tree only after a folder is opened or the View menu asks for it.
- [ ] Add the settings sheet with all editor, file, AI, language, theme, import/export settings controls.
- [ ] Wire native menu events and keyboard shortcuts into app commands.

### Task 5: Update assets and docs

**Files:**
- Modify: `assets/logo_icon_LightMode.svg`
- Modify: `assets/logo_icon_DarkMode.svg`
- Modify: `README.md`

- [ ] Put the Moondown mark inside a rounded rectangle background.
- [ ] Update README with the blank-paper product shape and supported exports.

### Task 6: Verify and ship

**Files:**
- All changed files.

- [ ] Run `pnpm test:app`.
- [ ] Run `pnpm build`.
- [ ] Run `pnpm tauri build --bundles app`.
- [ ] Inspect the app in browser for blank first launch, settings, folder tree, exports, and responsive layout.
- [ ] Launch the macOS `.app` and test hidden-title dragging, typing, slash popup placement, table controls, file/folder operations, settings, exports, and save flows.
- [ ] Rebuild and smoke-test Tada macOS with npm Moondown.
- [ ] Commit, tag if needed, push `main` and tags.
