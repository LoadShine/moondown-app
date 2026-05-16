# Moondown

A refined cross-platform Markdown editor powered by the npm `moondown` package and Tauri 2.

Moondown opens as a blank writing sheet with hidden title text, native menu commands, optional folder tree navigation, and a quiet lower-right status line. Settings live behind the app menu and include AI, language, theme, editor behavior, default save path, startup folder, and settings import/export.

Supported exports: Markdown, TXT, HTML, Word `.docx`, JPG, and EPUB.

## Development

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm test:app
pnpm build
pnpm tauri build --bundles app
```

GitHub Actions builds the web bundle and desktop artifacts for macOS, Windows, and Linux.
