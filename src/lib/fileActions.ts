export interface OpenedMarkdownFile {
  content: string;
  filePath: string | null;
  name: string;
}

export interface SaveMarkdownInput {
  content: string;
  filePath: string | null;
  suggestedName: string;
  forceSaveAs?: boolean;
}

const markdownFilters = [
  {
    name: 'Markdown',
    extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'],
  },
];

export const isDesktopRuntime = () =>
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window || navigator.userAgent.includes('Tauri'));

export const titleFromPath = (filePath: string | null, fallback = 'Untitled') => {
  if (!filePath) return fallback;
  const name = filePath.split(/[\\/]/).pop() || fallback;
  return name.replace(/\.(md|markdown|mdown|mkd|txt)$/i, '') || fallback;
};

const safeFileName = (value: string) => {
  const cleaned = value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-');
  return cleaned || 'Untitled';
};

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
      reader.onload = () => {
        resolve({
          content: String(reader.result ?? ''),
          filePath: null,
          name: file.name.replace(/\.(md|markdown|mdown|mkd|txt)$/i, ''),
        });
      };
      reader.readAsText(file);
    };
    input.click();
  });

const saveInBrowser = ({ content, suggestedName }: SaveMarkdownInput) => {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeFileName(suggestedName).replace(/\.(md|markdown)$/i, '')}.md`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return null;
};

export async function openMarkdownFile(): Promise<OpenedMarkdownFile | null> {
  if (!isDesktopRuntime()) {
    return openInBrowser();
  }

  const [{ open }, { readTextFile }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/plugin-fs'),
  ]);

  const selected = await open({
    multiple: false,
    filters: markdownFilters,
  });

  if (!selected || Array.isArray(selected)) return null;

  const content = await readTextFile(selected);
  return {
    content,
    filePath: selected,
    name: titleFromPath(selected),
  };
}

export async function saveMarkdownFile(input: SaveMarkdownInput): Promise<string | null> {
  if (!isDesktopRuntime()) {
    return saveInBrowser(input);
  }

  const [{ save }, { writeTextFile }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/plugin-fs'),
  ]);

  let targetPath = input.forceSaveAs ? null : input.filePath;
  if (!targetPath) {
    targetPath = await save({
      defaultPath: `${safeFileName(input.suggestedName).replace(/\.(md|markdown)$/i, '')}.md`,
      filters: markdownFilters,
    });
  }

  if (!targetPath) return null;

  await writeTextFile(targetPath, input.content);
  return targetPath;
}
