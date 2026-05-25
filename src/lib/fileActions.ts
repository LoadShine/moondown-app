import type { ExportFormat } from './exporters';
import { invoke } from '@tauri-apps/api/core';

export interface OpenedMarkdownFile {
  content: string;
  filePath: string | null;
  name: string;
}

export interface SaveMarkdownInput {
  content: string;
  filePath: string | null;
  suggestedName: string;
  defaultDirectory?: string;
  forceSaveAs?: boolean;
}

export interface FolderTreeNode {
  id: string;
  name: string;
  path: string;
  kind: 'directory' | 'file';
  children?: FolderTreeNode[];
}

const markdownFilters = [
  {
    name: 'Markdown and Text',
    extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'],
  },
];

const exportFilters: Record<ExportFormat, { name: string; extensions: string[] }> = {
  markdown: { name: 'Markdown', extensions: ['md'] },
  txt: { name: 'Plain Text', extensions: ['txt'] },
  html: { name: 'HTML', extensions: ['html'] },
  docx: { name: 'Word Document', extensions: ['docx'] },
  jpg: { name: 'JPEG Image', extensions: ['jpg'] },
  epub: { name: 'EPUB Book', extensions: ['epub'] },
};

export const isDesktopRuntime = () =>
  typeof window !== 'undefined' &&
  (
    '__TAURI_INTERNALS__' in window ||
    '__TAURI__' in window ||
    window.location.protocol === 'tauri:' ||
    navigator.userAgent.includes('Tauri')
  );

export const titleFromPath = (filePath: string | null, fallback = 'Untitled') => {
  if (!filePath) return fallback;
  const name = filePath.split(/[\\/]/).pop() || fallback;
  return name.replace(/\.(md|markdown|mdown|mkd|txt)$/i, '') || fallback;
};

export const safeFileName = (value: string) => {
  const cleaned = value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/\.+$/g, '');
  return cleaned || 'Untitled';
};

export async function openMarkdownFile(): Promise<OpenedMarkdownFile | null> {
  if (!isDesktopRuntime()) return openInBrowser();

  const [{ open }, { readTextFile }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/plugin-fs'),
  ]);

  const selected = await open({ multiple: false, filters: markdownFilters });
  if (!selected || Array.isArray(selected)) return null;

  await allowFsPath(selected, false);
  const content = await readTextFile(selected);
  return { content, filePath: selected, name: titleFromPath(selected) };
}

export async function openFileAtPath(filePath: string): Promise<OpenedMarkdownFile> {
  if (!isDesktopRuntime()) {
    throw new Error('Opening folder files requires the desktop app.');
  }
  await allowFsPath(filePath, false);
  const { readTextFile } = await import('@tauri-apps/plugin-fs');
  const content = await readTextFile(filePath);
  return { content, filePath, name: titleFromPath(filePath) };
}

export async function openSystemMarkdownFile(urlOrPath: string): Promise<OpenedMarkdownFile | null> {
  const filePath = pathFromFileUrl(urlOrPath);
  if (!filePath || !isMarkdownFile(filePath)) return null;
  return openFileAtPath(filePath);
}

export async function saveMarkdownFile(input: SaveMarkdownInput): Promise<string | null> {
  if (!isDesktopRuntime()) {
    return saveBlobInBrowser(new Blob([input.content], { type: 'text/markdown;charset=utf-8' }), input.suggestedName);
  }

  const [{ save }, { writeTextFile }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/plugin-fs'),
  ]);

  let targetPath = input.forceSaveAs ? null : input.filePath;
  if (!targetPath) {
    targetPath = await save({
      defaultPath: await defaultPath(input.suggestedName, input.defaultDirectory),
      filters: markdownFilters,
    });
  }
  if (!targetPath) return null;
  await allowFsPath(targetPath, false);
  await writeTextFile(targetPath, input.content);
  return targetPath;
}

export async function openMarkdownFolder(): Promise<string | null> {
  if (!isDesktopRuntime()) {
    throw new Error('Opening folders is available in the desktop app.');
  }
  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({ directory: true, multiple: false });
  if (!selected || Array.isArray(selected)) return null;
  await allowFsPath(selected, true);
  return selected;
}

export async function chooseDirectory(): Promise<string | null> {
  if (!isDesktopRuntime()) return window.prompt('Directory path')?.trim() || null;
  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({ directory: true, multiple: false });
  if (!selected || Array.isArray(selected)) return null;
  await allowFsPath(selected, true);
  return selected;
}

export async function readFolderTree(rootPath: string, maxDepth = 8): Promise<FolderTreeNode[]> {
  if (!isDesktopRuntime()) return [];
  const [{ readDir }, { join }] = await Promise.all([
    import('@tauri-apps/plugin-fs'),
    import('@tauri-apps/api/path'),
  ]);

  const visit = async (directory: string, depth: number): Promise<FolderTreeNode[]> => {
    if (depth > maxDepth) return [];
    const entries = await readDir(directory);
    const nodes = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory || isMarkdownFile(entry.name))
        .sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name))
        .map(async (entry) => {
          const entryPath = await join(directory, entry.name);
          if (entry.isDirectory) {
            return {
              id: entryPath,
              name: entry.name,
              path: entryPath,
              kind: 'directory' as const,
              children: await visit(entryPath, depth + 1),
            };
          }
          return { id: entryPath, name: entry.name, path: entryPath, kind: 'file' as const };
        }),
    );
    return nodes;
  };

  return visit(rootPath, 1);
}

export async function exportFile(format: ExportFormat, blob: Blob, suggestedName: string): Promise<string | null> {
  if (!isDesktopRuntime()) return saveBlobInBrowser(blob, suggestedName);

  const [{ save }, { writeFile }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/plugin-fs'),
  ]);
  const targetPath = await save({
    defaultPath: suggestedName,
    filters: [exportFilters[format]],
  });
  if (!targetPath) return null;
  await allowFsPath(targetPath, false);
  await writeFile(targetPath, new Uint8Array(await blob.arrayBuffer()));
  return targetPath;
}

export async function importSettingsFile(): Promise<string | null> {
  if (!isDesktopRuntime()) return openTextFileInBrowser('.json,application/json');

  const [{ open }, { readTextFile }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/plugin-fs'),
  ]);
  const selected = await open({ multiple: false, filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (!selected || Array.isArray(selected)) return null;
  await allowFsPath(selected, false);
  return readTextFile(selected);
}

export async function exportSettingsFile(content: string): Promise<string | null> {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  if (!isDesktopRuntime()) return saveBlobInBrowser(blob, 'moondown-settings.json');

  const [{ save }, { writeTextFile }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/plugin-fs'),
  ]);
  const targetPath = await save({
    defaultPath: 'moondown-settings.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (!targetPath) return null;
  await allowFsPath(targetPath, false);
  await writeTextFile(targetPath, content);
  return targetPath;
}

async function allowFsPath(path: string, recursive: boolean): Promise<void> {
  if (!isDesktopRuntime()) return;
  await invoke('allow_fs_path', { path, recursive });
}

async function defaultPath(fileName: string, directory?: string): Promise<string> {
  const safeName = ensureExtension(safeFileName(fileName), 'md');
  if (!directory || !isDesktopRuntime()) return safeName;
  try {
    const { join } = await import('@tauri-apps/api/path');
    return join(directory, safeName);
  } catch {
    return safeName;
  }
}

function ensureExtension(name: string, extension: string): string {
  return name.toLowerCase().endsWith(`.${extension}`) ? name : `${name}.${extension}`;
}

function isMarkdownFile(name: string): boolean {
  return /\.(md|markdown|mdown|mkd|txt)$/i.test(name);
}

function pathFromFileUrl(urlOrPath: string): string | null {
  const trimmed = urlOrPath.trim();
  if (!trimmed) return null;

  if (!trimmed.startsWith('file://')) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'file:') return null;
    const decodedPath = decodeURIComponent(url.pathname);
    if (/^\/[A-Za-z]:/.test(decodedPath)) return decodedPath.slice(1);
    return decodedPath;
  } catch {
    return null;
  }
}

const openInBrowser = (): Promise<OpenedMarkdownFile | null> =>
  new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.mdown,.mkd,.txt,text/markdown,text/plain';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Unable to read the selected file.'));
      reader.onload = () => resolve({
        content: String(reader.result ?? ''),
        filePath: null,
        name: file.name.replace(/\.(md|markdown|mdown|mkd|txt)$/i, ''),
      });
      reader.readAsText(file);
    };
    input.click();
  });

const openTextFileInBrowser = (accept: string): Promise<string | null> =>
  new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Unable to read the selected file.'));
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.readAsText(file);
    };
    input.click();
  });

function saveBlobInBrowser(blob: Blob, suggestedName: string): null {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = suggestedName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return null;
}
