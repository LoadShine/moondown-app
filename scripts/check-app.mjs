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

const requireFile = (relativePath) => {
  if (!fs.existsSync(path.join(rootDir, relativePath))) {
    failures.push(`${relativePath} must exist.`);
    return '';
  }
  return readText(relativePath);
};

if (!packageJson.dependencies?.moondown) failures.push('The app must depend on npm moondown.');
if (!packageJson.dependencies?.['@tauri-apps/api']) failures.push('The app must depend on Tauri API.');
if (!packageJson.scripts?.build?.includes('vite build')) failures.push('The app must have a Vite production build.');

const appSource = requireFile('src/App.tsx');
const editorSource = requireFile('src/components/MoondownEditor.tsx');
const fileSource = requireFile('src/lib/fileActions.ts');
const settingsSource = requireFile('src/lib/settings.ts');
const markdownSource = requireFile('src/lib/markdown.ts');
const exportersSource = requireFile('src/lib/exporters.ts');
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
if (appSource && !appSource.includes('settings-sheet')) failures.push('App.tsx must expose a settings sheet opened from the menu.');
if (appSource && !appSource.includes('folder-tree')) failures.push('App.tsx must support a folder tree view.');
if (appSource && !appSource.includes('moondown-menu')) failures.push('App.tsx must listen for native menu events.');
if (appSource && !appSource.includes('exportCurrentDocument')) failures.push('App.tsx must support exporting the current document.');
if (editorSource && (!editorSource.includes("from 'moondown'") && !editorSource.includes('from "moondown"'))) {
  failures.push('MoondownEditor.tsx must import the editor from moondown.');
}
if (editorSource && !editorSource.includes('moondown/style.css')) failures.push('MoondownEditor.tsx must load moondown/style.css.');
if (editorSource && !editorSource.includes('focusOnMount')) failures.push('MoondownEditor.tsx must focus the blank editor on launch.');
if (editorSource && !editorSource.includes('toggleSyntaxHiding')) failures.push('MoondownEditor.tsx must support hiding markdown markers.');
if (editorSource && !editorSource.includes('installMoondownInteractionFixes')) {
  failures.push('MoondownEditor.tsx must install interaction fixes for table cell focus and controls.');
}
if (fileSource && !fileSource.includes('@tauri-apps/plugin-dialog')) failures.push('fileActions.ts must use the Tauri dialog plugin.');
if (fileSource && !fileSource.includes('@tauri-apps/plugin-fs')) failures.push('fileActions.ts must use the Tauri fs plugin.');
if (fileSource && !fileSource.includes('openMarkdownFolder')) failures.push('fileActions.ts must support opening folders.');
if (fileSource && !fileSource.includes('readFolderTree')) failures.push('fileActions.ts must recursively read folder trees.');
if (fileSource && !fileSource.includes('exportFile')) failures.push('fileActions.ts must support export save flows.');
if (fileSource && !fileSource.includes("invoke('allow_fs_path'")) failures.push('fileActions.ts must add user-selected paths to the runtime fs scope.');
if (settingsSource && !settingsSource.includes('defaultSavePath')) failures.push('settings.ts must persist a default save path.');
if (settingsSource && !settingsSource.includes('startupFolderPath')) failures.push('settings.ts must persist a startup folder.');
if (settingsSource && !settingsSource.includes('aiProvider')) failures.push('settings.ts must persist AI configuration.');
if (settingsSource && !settingsSource.includes('hideMarkdownSyntax')) failures.push('settings.ts must persist markdown marker visibility.');
if (markdownSource && !markdownSource.includes('getMarkdownMetrics')) failures.push('markdown.ts must expose document metrics.');
for (const format of ['markdown', 'txt', 'html', 'docx', 'jpg', 'epub']) {
  if (exportersSource && !exportersSource.includes(`'${format}'`) && !exportersSource.includes(`"${format}"`)) {
    failures.push(`exporters.ts must support ${format} export.`);
  }
}
if (tauriConfig && !tauriConfig.includes('com.loadshine.moondownapp')) failures.push('Tauri config must use the LoadShine app identifier.');
if (tauriConfig && !tauriConfig.includes('"hiddenTitle": true')) failures.push('Tauri config must hide the macOS title text.');
if (tauriLib && !tauriLib.includes('MenuBuilder')) failures.push('Tauri Rust must build a native menu.');
if (tauriLib && !tauriLib.includes('moondown-menu')) failures.push('Tauri Rust must emit moondown-menu events.');
if (tauriLib && !tauriLib.includes('allow_fs_path')) failures.push('Tauri Rust must expose runtime fs scope grants for user-selected files and folders.');
if (capabilities && !capabilities.includes('fs:allow-read-dir')) failures.push('Tauri capabilities must allow folder reads.');
if (capabilities && !capabilities.includes('core:window:allow-start-dragging')) failures.push('Tauri capabilities must allow hidden-title dragging.');
if (workflow && !workflow.includes('tauri-apps/tauri-action')) failures.push('GitHub Actions must build Tauri artifacts.');
if (workflow && workflow.includes('tauri-apps/tauri-action@v1')) failures.push('GitHub Actions must not use nonexistent tauri-action@v1.');
if (workflow && !workflow.includes('tauri-apps/tauri-action@v0.6.2')) failures.push('GitHub Actions must pin a resolvable tauri-action version.');
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
