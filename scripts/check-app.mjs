import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), '..');

const readText = (relativePath) =>
  fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const readJson = (relativePath) => JSON.parse(readText(relativePath));

const packageJson = readJson('package.json');
const failures = [];
const minimumMoondownVersion = [1, 0, 5];

const parseSemverRange = (range) => {
  const match = range?.match(/\d+\.\d+\.\d+/);
  return match ? match[0].split('.').map(Number) : null;
};

const isAtLeast = (version, minimum) => {
  if (!version) return false;
  for (let index = 0; index < minimum.length; index += 1) {
    if (version[index] > minimum[index]) return true;
    if (version[index] < minimum[index]) return false;
  }
  return true;
};

const requireFile = (relativePath) => {
  if (!fs.existsSync(path.join(rootDir, relativePath))) {
    failures.push(`${relativePath} must exist.`);
    return '';
  }
  return readText(relativePath);
};

if (!packageJson.dependencies?.moondown) failures.push('The app must depend on npm moondown.');
if (
  packageJson.dependencies?.moondown &&
  !isAtLeast(parseSemverRange(packageJson.dependencies.moondown), minimumMoondownVersion)
) {
  failures.push('The app must depend on moondown 1.0.5 or newer.');
}
if (!packageJson.dependencies?.['@tauri-apps/api']) failures.push('The app must depend on Tauri API.');
if (!packageJson.scripts?.build?.includes('vite build')) failures.push('The app must have a Vite production build.');

const appSource = requireFile('src/App.tsx');
const editorSource = requireFile('src/components/MoondownEditor.tsx');
const fileSource = requireFile('src/lib/fileActions.ts');
const settingsSource = requireFile('src/lib/settings.ts');
const markdownSource = requireFile('src/lib/markdown.ts');
const exportersSource = requireFile('src/lib/exporters.ts');
const providersSource = requireFile('src/lib/aiProviders.ts');
const stylesSource = requireFile('src/styles.css');
const tauriConfig = requireFile('src-tauri/tauri.conf.json');
const tauriLib = requireFile('src-tauri/src/lib.rs');
const capabilities = requireFile('src-tauri/capabilities/default.json');
const workflow = requireFile('.github/workflows/build.yml');
const lightLogo = requireFile('assets/logo_icon_LightMode.svg');
const darkLogo = requireFile('assets/logo_icon_DarkMode.svg');

if (appSource && !appSource.includes('createDocument')) failures.push('App.tsx must support creating documents.');
if (appSource && !appSource.includes('saveCurrentDocument')) failures.push('App.tsx must support saving the active document.');
if (appSource && appSource.includes('starterContent')) failures.push('App.tsx must not ship starter content; first launch must be a blank page.');
if (appSource && appSource.includes('className="topbar"')) failures.push('App.tsx must not render a visible topbar on first launch.');
if (appSource && appSource.includes('className="brand"')) failures.push('App.tsx must not render visible brand chrome on first launch.');
if (appSource && !appSource.includes('data-tauri-drag-region')) failures.push('App.tsx must include an invisible drag region for hiddenTitle windows.');
if (appSource && !appSource.includes('startDragging')) failures.push('App.tsx must call Tauri startDragging for hiddenTitle drag fallback.');
if (appSource && !appSource.includes('settings-sheet')) failures.push('App.tsx must expose a settings sheet opened from the menu.');
if (appSource && !appSource.includes('settings-nav')) failures.push('Settings must use categorized navigation instead of one piled grid.');
if (appSource && appSource.includes('settings-grid')) failures.push('Settings must not use the old piled settings grid.');
if (appSource && !appSource.includes('function CommandBar')) failures.push('App.tsx must expose common document actions in a command bar.');
if (appSource && !appSource.includes('commandBarOpen')) failures.push('App.tsx must hide/show the bottom command bar from state.');
if (appSource && !appSource.includes('className="command-tray-toggle"')) failures.push('App.tsx must put the command bar toggle in the app top-right corner.');
if (appSource && !appSource.includes('command-bar open')) failures.push('The command bar must render as a bottom tray that can be opened.');
if (appSource && appSource.includes('command-group--quick')) failures.push('The command bar must not keep old quick action buttons.');
if (appSource && appSource.includes('CommandIconButton')) failures.push('The command bar must only keep File, Export as, View, and Settings controls.');
if (appSource && appSource.includes('onOpenFile={() => void openFile()}')) failures.push('Settings must not be the primary place to open files.');
if (appSource && appSource.includes('onOpenFolder={() => void loadFolder()}')) failures.push('Settings must not be the primary place to open folders.');
if (appSource && appSource.includes('onExportFormat')) failures.push('Settings must not expose document export format buttons.');
if (appSource && appSource.includes('export-grid')) failures.push('Settings must not expose document export controls.');
if (appSource && !appSource.includes('ProviderPicker')) failures.push('AI settings must expose a built-in provider picker.');
if (appSource && !appSource.includes('onCloseRequested')) failures.push('App.tsx must intercept native close requests.');
if (appSource && !appSource.includes('.hide()')) failures.push('Closing the window must hide it instead of quitting the app.');
if (appSource && !appSource.includes('closeDesktopWindow')) failures.push('App.tsx must centralize desktop close handling.');
if (appSource && (appSource.includes('isFullscreen()') || appSource.includes('setFullscreen(false)'))) failures.push('Cmd+W must hide the window directly instead of first exiting fullscreen.');
if (appSource && !appSource.includes('clearTransientDocumentState')) failures.push('Window close and app quit must clear transient document state.');
if (appSource && !appSource.includes('findFirstMarkdownFile')) failures.push('Startup folders must open their first markdown file.');
if (appSource && !appSource.includes('function SearchReplacePanel')) failures.push('App.tsx must provide a custom search/replace panel.');
if (appSource && !appSource.includes('findExactMatches')) failures.push('Search must use simple exact-match scanning.');
if (appSource && !appSource.includes('replaceCurrentMatch')) failures.push('Replace must support replacing the active exact match.');
if (appSource && !appSource.includes('folder-tree')) failures.push('App.tsx must support a folder tree view.');
if (appSource && !appSource.includes('moondown-menu')) failures.push('App.tsx must listen for native menu events.');
if (appSource && !appSource.includes('exportCurrentDocument')) failures.push('App.tsx must support exporting the current document.');
if (editorSource && (!editorSource.includes("from 'moondown'") && !editorSource.includes('from "moondown"'))) {
  failures.push('MoondownEditor.tsx must import the editor from moondown.');
}
if (editorSource && !editorSource.includes('moondown/style.css')) failures.push('MoondownEditor.tsx must load moondown/style.css.');
if (editorSource && !editorSource.includes('focusOnMount')) failures.push('MoondownEditor.tsx must focus the blank editor on launch.');
if (editorSource && !editorSource.includes('toggleSyntaxHiding')) failures.push('MoondownEditor.tsx must support hiding markdown markers.');
if (appSource && !appSource.includes('wordWrap={settings.wordWrap}')) {
  failures.push('App.tsx must pass the word wrap setting into MoondownEditor.');
}
if (appSource && !appSource.includes('spellcheck={settings.spellcheck}')) {
  failures.push('App.tsx must pass the spellcheck setting into MoondownEditor.');
}
if (editorSource && !editorSource.includes('wordWrap: boolean')) {
  failures.push('MoondownEditor.tsx must accept a wordWrap prop.');
}
if (editorSource && !editorSource.includes('spellcheck: boolean')) {
  failures.push('MoondownEditor.tsx must accept a spellcheck prop.');
}
if (editorSource && editorSource.includes('spellCheck={false}')) {
  failures.push('MoondownEditor.tsx must not hard-code spellcheck off.');
}
if (editorSource && !editorSource.includes('installMoondownInteractionFixes')) {
  failures.push('MoondownEditor.tsx must install interaction fixes for table cell focus and controls.');
}
if (appSource && appSource.includes("import('@tauri-apps/api/core')")) {
  failures.push('App.tsx must not dynamically import @tauri-apps/api/core because it creates an ineffective Vite chunk split.');
}
if (appSource && appSource.includes("import('@tauri-apps/api/event')")) {
  failures.push('App.tsx must not dynamically import @tauri-apps/api/event because it creates an ineffective Vite chunk split.');
}
if (appSource && !appSource.includes("from '@tauri-apps/api/core'")) {
  failures.push('App.tsx must statically import Tauri invoke.');
}
if (appSource && !appSource.includes("from '@tauri-apps/api/event'")) {
  failures.push('App.tsx must statically import Tauri listen.');
}
if (fileSource && fileSource.includes("import('@tauri-apps/api/core')")) {
  failures.push('fileActions.ts must not dynamically import @tauri-apps/api/core because it creates an ineffective Vite chunk split.');
}
if (fileSource && !fileSource.includes("from '@tauri-apps/api/core'")) {
  failures.push('fileActions.ts must statically import Tauri invoke.');
}
if (fileSource && !fileSource.includes('@tauri-apps/plugin-dialog')) failures.push('fileActions.ts must use the Tauri dialog plugin.');
if (fileSource && !fileSource.includes('@tauri-apps/plugin-fs')) failures.push('fileActions.ts must use the Tauri fs plugin.');
if (fileSource && !fileSource.includes('openSystemMarkdownFile')) failures.push('fileActions.ts must open Markdown files launched by the OS.');
if (fileSource && !fileSource.includes('openMarkdownFolder')) failures.push('fileActions.ts must support opening folders.');
if (fileSource && !fileSource.includes('readFolderTree')) failures.push('fileActions.ts must recursively read folder trees.');
if (fileSource && !fileSource.includes('exportFile')) failures.push('fileActions.ts must support export save flows.');
if (fileSource && !fileSource.includes("invoke('allow_fs_path'")) failures.push('fileActions.ts must add user-selected paths to the runtime fs scope.');
if (settingsSource && !settingsSource.includes('defaultSavePath')) failures.push('settings.ts must persist a default save path.');
if (settingsSource && !settingsSource.includes('startupFolderPath')) failures.push('settings.ts must persist a startup folder.');
if (settingsSource && !settingsSource.includes('aiProvider')) failures.push('settings.ts must persist AI configuration.');
if (settingsSource && !settingsSource.includes('hideMarkdownSyntax')) failures.push('settings.ts must persist markdown marker visibility.');
if (stylesSource && !/\.switch-control\s+span\s*\{[^}]*pointer-events:\s*none/s.test(stylesSource)) {
  failures.push('Switch decoration spans must not intercept checkbox pointer events.');
}
if (stylesSource && !stylesSource.includes('.moondown-editor.word-wrap-off')) {
  failures.push('styles.css must define a no-wrap editor mode for the word wrap setting.');
}
if (markdownSource && !markdownSource.includes('getMarkdownMetrics')) failures.push('markdown.ts must expose document metrics.');
for (const format of ['markdown', 'txt', 'html', 'docx', 'jpg', 'epub']) {
  if (exportersSource && !exportersSource.includes(`'${format}'`) && !exportersSource.includes(`"${format}"`)) {
    failures.push(`exporters.ts must support ${format} export.`);
  }
}
if (providersSource) {
  const providerCount = Array.from(providersSource.matchAll(/\bid:\s*['"]/g)).length;
  if (providerCount < 40) failures.push(`AI settings must include at least 40 built-in providers; found ${providerCount}.`);
  for (const providerName of ['OpenAI', 'DeepSeek', 'Moonshot', 'Ollama', 'LM Studio']) {
    if (!providersSource.includes(providerName)) failures.push(`AI providers must include ${providerName}.`);
  }
}
if (tauriConfig && !tauriConfig.includes('com.loadshine.moondownapp')) failures.push('Tauri config must use the LoadShine app identifier.');
if (tauriConfig && !tauriConfig.includes(`"version": "${packageJson.version}"`)) {
  failures.push('Tauri config version must match package.json.');
}
if (tauriLib && !requireFile('src-tauri/Cargo.toml').includes(`version = "${packageJson.version}"`)) {
  failures.push('Cargo.toml package version must match package.json.');
}
if (tauriConfig && !tauriConfig.includes('"hiddenTitle": true')) failures.push('Tauri config must hide the macOS title text.');
if (tauriConfig && !tauriConfig.includes('fileAssociations')) failures.push('Tauri config must register Markdown file associations.');
if (tauriConfig && !tauriConfig.includes('"md"')) failures.push('Tauri file associations must include .md files.');
if (tauriConfig && !tauriConfig.includes('"rank": "Owner"')) failures.push('Markdown file associations must request Owner rank.');
if (tauriLib && !tauriLib.includes('MenuBuilder')) failures.push('Tauri Rust must build a native menu.');
if (tauriLib && !tauriLib.includes('moondown-menu')) failures.push('Tauri Rust must emit moondown-menu events.');
if (tauriLib && !tauriLib.includes('moondown-opened')) failures.push('Tauri Rust must emit OS-opened Markdown files.');
if (tauriLib && !tauriLib.includes('opened_urls')) failures.push('Tauri Rust must expose startup-opened Markdown files.');
if (tauriLib && !tauriLib.includes('allow_fs_path')) failures.push('Tauri Rust must expose runtime fs scope grants for user-selected files and folders.');
for (const menuId of ['close-window', 'find', 'replace']) {
  if (tauriLib && !tauriLib.includes(menuId)) failures.push(`Tauri menu must expose ${menuId}.`);
}
if (capabilities && !capabilities.includes('fs:allow-read-dir')) failures.push('Tauri capabilities must allow folder reads.');
if (capabilities && !capabilities.includes('core:window:allow-start-dragging')) failures.push('Tauri capabilities must allow hidden-title dragging.');
if (capabilities && !capabilities.includes('core:window:allow-hide')) failures.push('Tauri capabilities must allow close-to-hide behavior.');
if (capabilities && capabilities.includes('core:window:allow-is-fullscreen')) failures.push('Tauri capabilities must not allow unused fullscreen state checks.');
if (capabilities && capabilities.includes('core:window:allow-set-fullscreen')) failures.push('Tauri capabilities must not allow unused fullscreen mutations.');
if (workflow && !workflow.includes('tauri-apps/tauri-action')) failures.push('GitHub Actions must build Tauri artifacts.');
if (workflow && workflow.includes('tauri-apps/tauri-action@v1')) failures.push('GitHub Actions must not use nonexistent tauri-action@v1.');
if (workflow && !workflow.includes('tauri-apps/tauri-action@v0.6.2')) failures.push('GitHub Actions must pin a resolvable tauri-action version.');
if (workflow && workflow.includes('actions/checkout@v4')) failures.push('GitHub Actions must not use checkout@v4 because it runs on the deprecated Node 20 runtime.');
if (workflow && !workflow.includes('actions/checkout@v6')) failures.push('GitHub Actions must use checkout@v6.');
if (workflow && workflow.includes('actions/setup-node@v4')) failures.push('GitHub Actions must not use setup-node@v4 because it runs on the deprecated Node 20 runtime.');
if (workflow && !workflow.includes('actions/setup-node@v6')) failures.push('GitHub Actions must use setup-node@v6.');
if (workflow && !workflow.includes('node-version: 24')) failures.push('GitHub Actions must run Node.js 24.');
if (workflow && workflow.includes('pnpm/action-setup@v4')) failures.push('GitHub Actions must not use pnpm/action-setup@v4 because it runs on the deprecated Node 20 runtime.');
if (workflow && !workflow.includes('pnpm/action-setup@v6')) failures.push('GitHub Actions must use pnpm/action-setup@v6.');
if (lightLogo && !lightLogo.includes('app-icon-bg')) failures.push('Light logo must include a rounded-rectangle background.');
if (darkLogo && !darkLogo.includes('app-icon-bg')) failures.push('Dark logo must include a rounded-rectangle background.');
for (const dependency of ['markdown-it', 'docx', 'jszip']) {
  if (!packageJson.dependencies?.[dependency]) failures.push(`The app must depend on ${dependency} for export support.`);
}

if (failures.length > 0) {
  console.error('Moondown app check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Moondown app check passed.');
