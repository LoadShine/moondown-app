# Moondown App Redesign Spec

## Goal

Rebuild `moondown-app` into a distraction-free Tauri Markdown editor powered by the npm `moondown` package. The app must open like a blank sheet of paper: no visible toolbar, no brand bar, no sidebar, no cards, and no instructional copy. The only visible writing affordance on first launch is the editor cursor, plus an almost invisible single-line status readout in the lower-right corner.

## Product Shape

The default window uses macOS `hiddenTitle` and a frameless-feeling white canvas. A narrow invisible drag strip sits at the top so the window remains easy to move even though no title text is shown. App commands live in the native menu bar: new, open file, open folder, save, save as, exports, settings, theme, syntax hiding, and folder tree visibility. Keyboard shortcuts mirror the menu commands.

Opening a folder is the only action that reveals navigation chrome. The left side becomes a quiet tree view of Markdown/text files under the selected folder. Selecting a file opens it in the same blank writing surface. The tree can be hidden again from the View menu.

## Settings

Settings open from the native menu or `Cmd/Ctrl+,`. The settings sheet is the one place for configuration. It persists:

- AI provider, base URL, model, API key, and whether AI assist is enabled.
- Theme mode, accent color, editor font size, line width, spellcheck, word wrap, and markdown marker visibility.
- Language, default save path, startup folder, and whether to reopen that folder on launch.
- Import/export of the settings JSON.

## File Operations

The app supports native open/save for Markdown and text files, native folder open with recursive tree discovery, and browser fallbacks for development. Exports support Markdown, TXT, HTML, Word `.docx`, JPG, and EPUB. Exports use native save dialogs on desktop and downloads in the browser.

## Architecture

`src/App.tsx` owns document state, settings, menu events, folder tree visibility, and keyboard shortcuts. `src/components/MoondownEditor.tsx` remains the imperative wrapper around npm `moondown`. Pure modules under `src/lib` handle file actions, folder traversal, settings storage, Markdown stats, and exporters so they can be tested without React. The Rust Tauri layer creates the native menu and emits menu action events to the frontend.

## Visual Quality

The UI avoids decorative gradients, cards, and visible chrome on first launch. The canvas uses native system typography, generous whitespace, neutral color, and a rounded-rectangle logo asset for OS surfaces. Status text is low-contrast, single-line, borderless, and positioned so it cannot interfere with writing.

## Verification

Verification must include static integration checks, TypeScript build, web production build, Tauri macOS app build, browser visual smoke checks, and direct macOS app launch checks for both `moondown-app` and `tada`.
