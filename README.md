# Moondown

A refined cross-platform Markdown editor powered by the npm `moondown` package and Tauri 2.

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
