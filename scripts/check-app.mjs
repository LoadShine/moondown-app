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
const tauriConfig = requireFile('src-tauri/tauri.conf.json');
const workflow = requireFile('.github/workflows/build.yml');

if (appSource && !appSource.includes('createDocument')) failures.push('App.tsx must support creating documents.');
if (appSource && !appSource.includes('saveCurrentDocument')) failures.push('App.tsx must support saving the active document.');
if (editorSource && (!editorSource.includes("from 'moondown'") && !editorSource.includes('from "moondown"'))) {
  failures.push('MoondownEditor.tsx must import the editor from moondown.');
}
if (editorSource && !editorSource.includes('moondown/style.css')) failures.push('MoondownEditor.tsx must load moondown/style.css.');
if (fileSource && !fileSource.includes('@tauri-apps/plugin-dialog')) failures.push('fileActions.ts must use the Tauri dialog plugin.');
if (fileSource && !fileSource.includes('@tauri-apps/plugin-fs')) failures.push('fileActions.ts must use the Tauri fs plugin.');
if (tauriConfig && !tauriConfig.includes('com.loadshine.moondownapp')) failures.push('Tauri config must use the LoadShine app identifier.');
if (workflow && !workflow.includes('tauri-apps/tauri-action')) failures.push('GitHub Actions must build Tauri artifacts.');

if (failures.length > 0) {
  console.error('Moondown app check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Moondown app check passed.');
