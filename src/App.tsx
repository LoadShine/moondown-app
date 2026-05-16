import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AIStreamHandler } from 'moondown';
import { ChevronDown, ChevronRight, FileText, Folder, X } from 'lucide-react';
import MoondownEditor, { type MoondownEditorHandle } from './components/MoondownEditor';
import {
  chooseDirectory,
  exportFile,
  exportSettingsFile,
  isDesktopRuntime,
  openFileAtPath,
  openMarkdownFile,
  openMarkdownFolder,
  readFolderTree,
  saveMarkdownFile,
  importSettingsFile,
  type FolderTreeNode,
} from './lib/fileActions';
import { exportMarkdown, type ExportFormat, sanitizeExportName } from './lib/exporters';
import { deriveTitle, getMarkdownMetrics } from './lib/markdown';
import {
  defaultSettings,
  loadSettings,
  parseSettingsJson,
  saveSettings,
  serializeSettings,
  type EditorSettings,
  type ThemeMode,
} from './lib/settings';

interface DocumentState {
  content: string;
  filePath: string | null;
  dirty: boolean;
  updatedAt: number;
}

type MenuAction =
  | 'new-document'
  | 'open-file'
  | 'open-folder'
  | 'save'
  | 'save-as'
  | 'settings'
  | 'toggle-tree'
  | 'toggle-syntax'
  | 'theme-system'
  | 'theme-light'
  | 'theme-dark'
  | `export-${ExportFormat}`;

const DRAFT_KEY = 'moondown-app.current-document.v2';

const copy = {
  en: {
    settings: 'Settings',
    close: 'Close',
    writing: 'Writing',
    ai: 'AI',
    files: 'Files',
    appearance: 'Appearance',
    language: 'Language',
    theme: 'Theme',
    accent: 'Accent color',
    markers: 'Hide Markdown markers',
    font: 'Font size',
    width: 'Line width',
    wrap: 'Word wrap',
    spellcheck: 'Spellcheck',
    autosave: 'Restore draft on launch',
    aiEnabled: 'Enable AI assist',
    provider: 'Provider',
    baseUrl: 'Base URL',
    model: 'Model',
    apiKey: 'API key',
    savePath: 'Default save path',
    startupFolder: 'Default startup folder',
    reopen: 'Open startup folder on launch',
    choose: 'Choose',
    importSettings: 'Import settings',
    exportSettings: 'Export settings',
    reset: 'Reset',
    noFolder: 'No folder open',
  },
  'zh-CN': {
    settings: '设置',
    close: '关闭',
    writing: '写作',
    ai: 'AI',
    files: '文件',
    appearance: '外观',
    language: '语言',
    theme: '主题',
    accent: '主题色',
    markers: '隐藏 Markdown 标记',
    font: '字号',
    width: '行宽',
    wrap: '自动换行',
    spellcheck: '拼写检查',
    autosave: '启动时恢复草稿',
    aiEnabled: '启用 AI 辅助',
    provider: '服务商',
    baseUrl: 'Base URL',
    model: '模型',
    apiKey: 'API Key',
    savePath: '默认保存路径',
    startupFolder: '默认打开文件夹',
    reopen: '启动时打开该文件夹',
    choose: '选择',
    importSettings: '导入设置',
    exportSettings: '导出设置',
    reset: '重置',
    noFolder: '未打开文件夹',
  },
};

function loadDraft(): DocumentState {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) throw new Error('empty');
    const parsed = JSON.parse(raw) as Partial<DocumentState>;
    return {
      content: typeof parsed.content === 'string' ? parsed.content : '',
      filePath: typeof parsed.filePath === 'string' ? parsed.filePath : null,
      dirty: Boolean(parsed.dirty),
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return { content: '', filePath: null, dirty: false, updatedAt: Date.now() };
  }
}

export default function App() {
  const editorRef = useRef<MoondownEditorHandle>(null);
  const [settings, setSettings] = useState<EditorSettings>(() => loadSettings());
  const [documentState, setDocumentState] = useState<DocumentState>(() =>
    settings.autosave ? loadDraft() : { content: '', filePath: null, dirty: false, updatedAt: Date.now() },
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [folderRoot, setFolderRoot] = useState('');
  const [folderTree, setFolderTree] = useState<FolderTreeNode[]>([]);
  const [folderTreeVisible, setFolderTreeVisible] = useState(false);
  const [notice, setNotice] = useState('');

  const resolvedTheme = useResolvedTheme(settings.themeMode);
  const metrics = useMemo(() => getMarkdownMetrics(documentState.content), [documentState.content]);
  const title = useMemo(() => deriveTitle(documentState.content, documentState.filePath), [documentState.content, documentState.filePath]);
  const labels = copy[settings.language];
  const statusText = notice || `${metrics.words} words · ${metrics.characters} chars · ${documentState.dirty ? 'edited' : 'saved'}`;

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.setProperty('--accent', settings.accentColor);
    document.documentElement.style.setProperty('--editor-font-size', `${settings.editorFontSize}px`);
    document.documentElement.style.setProperty('--editor-line-width', `${settings.editorLineWidth}px`);
  }, [resolvedTheme, settings.accentColor, settings.editorFontSize, settings.editorLineWidth]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (settings.autosave) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(documentState));
    } else {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [documentState, settings.autosave]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 2200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!settings.openStartupFolder || !settings.startupFolderPath || !isDesktopRuntime()) return;
    void loadFolder(settings.startupFolderPath);
    // Startup folder should only be opened once at launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateSettings = useCallback((patch: Partial<EditorSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  const createDocument = useCallback(() => {
    setDocumentState({ content: '', filePath: null, dirty: false, updatedAt: Date.now() });
    requestAnimationFrame(() => editorRef.current?.focus());
  }, []);

  const openFile = useCallback(async () => {
    try {
      const opened = await openMarkdownFile();
      if (!opened) return;
      setDocumentState({ content: opened.content, filePath: opened.filePath, dirty: false, updatedAt: Date.now() });
      setNotice('Opened');
      requestAnimationFrame(() => editorRef.current?.focus());
    } catch (error) {
      setNotice(messageFromError(error));
    }
  }, []);

  const loadFolder = useCallback(async (rootPath?: string) => {
    try {
      const selected = rootPath ?? await openMarkdownFolder();
      if (!selected) return;
      const tree = await readFolderTree(selected);
      setFolderRoot(selected);
      setFolderTree(tree);
      setFolderTreeVisible(true);
      setNotice('Folder opened');
    } catch (error) {
      setNotice(messageFromError(error));
    }
  }, []);

  const openTreeFile = useCallback(async (filePath: string) => {
    try {
      const opened = await openFileAtPath(filePath);
      setDocumentState({ content: opened.content, filePath: opened.filePath, dirty: false, updatedAt: Date.now() });
      setNotice('Opened');
      requestAnimationFrame(() => editorRef.current?.focus());
    } catch (error) {
      setNotice(messageFromError(error));
    }
  }, []);

  const saveCurrentDocument = useCallback(async (forceSaveAs = false) => {
    try {
      const filePath = await saveMarkdownFile({
        content: documentState.content,
        filePath: documentState.filePath,
        suggestedName: `${title}.md`,
        defaultDirectory: settings.defaultSavePath,
        forceSaveAs,
      });
      if (filePath === null && isDesktopRuntime()) {
        setNotice('Save cancelled');
        return;
      }
      setDocumentState((current) => ({ ...current, filePath: filePath ?? current.filePath, dirty: false, updatedAt: Date.now() }));
      setNotice('Saved');
    } catch (error) {
      setNotice(messageFromError(error));
    }
  }, [documentState.content, documentState.filePath, settings.defaultSavePath, title]);

  const exportCurrentDocument = useCallback(async (format: ExportFormat) => {
    try {
      const result = await exportMarkdown(format, documentState.content, title);
      const suggestedName = sanitizeExportName(title, result.extension);
      const path = await exportFile(format, result.blob, suggestedName);
      if (path === null && isDesktopRuntime()) {
        setNotice('Export cancelled');
        return;
      }
      setNotice(`Exported ${format.toUpperCase()}`);
    } catch (error) {
      setNotice(messageFromError(error));
    }
  }, [documentState.content, title]);

  const handleMenuAction = useCallback((action: MenuAction) => {
    if (action === 'new-document') createDocument();
    else if (action === 'open-file') void openFile();
    else if (action === 'open-folder') void loadFolder();
    else if (action === 'save') void saveCurrentDocument(false);
    else if (action === 'save-as') void saveCurrentDocument(true);
    else if (action === 'settings') setSettingsOpen(true);
    else if (action === 'toggle-tree') setFolderTreeVisible((visible) => !visible);
    else if (action === 'toggle-syntax') updateSettings({ hideMarkdownSyntax: !settings.hideMarkdownSyntax });
    else if (action === 'theme-system' || action === 'theme-light' || action === 'theme-dark') {
      updateSettings({ themeMode: action.replace('theme-', '') as ThemeMode });
    } else if (action.startsWith('export-')) {
      void exportCurrentDocument(action.replace('export-', '') as ExportFormat);
    }
  }, [
    createDocument,
    exportCurrentDocument,
    loadFolder,
    openFile,
    saveCurrentDocument,
    settings.hideMarkdownSyntax,
    updateSettings,
  ]);

  useEffect(() => {
    if (!isDesktopRuntime()) return;
    let unlisten: (() => void) | undefined;
    void import('@tauri-apps/api/event').then(({ listen }) =>
      listen<MenuAction>('moondown-menu', (event) => handleMenuAction(event.payload)).then((cleanup) => {
        unlisten = cleanup;
      }),
    );
    return () => unlisten?.();
  }, [handleMenuAction]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = event.metaKey || event.ctrlKey;
      if (!command) return;
      const key = event.key.toLowerCase();
      if (key === ',') {
        event.preventDefault();
        setSettingsOpen(true);
      } else if (key === 'n') {
        event.preventDefault();
        createDocument();
      } else if (key === 'o' && event.shiftKey) {
        event.preventDefault();
        void loadFolder();
      } else if (key === 'o') {
        event.preventDefault();
        void openFile();
      } else if (key === 's') {
        event.preventDefault();
        void saveCurrentDocument(event.shiftKey);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [createDocument, loadFolder, openFile, saveCurrentDocument]);

  const aiStreamHandler = useMemo<AIStreamHandler>(() => {
    return (systemPrompt, userPrompt, signal) => {
      if (!settings.aiEnabled || !settings.aiApiKey || !settings.aiBaseUrl || !settings.aiModel) {
        setSettingsOpen(true);
        return emptyAIStream();
      }
      return requestAIStream(settings, systemPrompt, userPrompt, signal);
    };
  }, [settings]);

  return (
    <main className={`blank-shell ${folderTreeVisible && folderTree.length > 0 ? 'with-tree' : ''}`}>
      <div className="window-drag-layer" data-tauri-drag-region />

      {folderTreeVisible && folderTree.length > 0 && (
        <aside className="folder-tree" aria-label="Folder tree">
          <div className="folder-root" title={folderRoot}>{folderRoot || labels.noFolder}</div>
          <FolderTree nodes={folderTree} activePath={documentState.filePath} onOpenFile={openTreeFile} />
        </aside>
      )}

      <section className="writing-pane" aria-label="Markdown editor">
        <MoondownEditor
          ref={editorRef}
          value={documentState.content}
          theme={resolvedTheme}
          locale={settings.language}
          placeholder=""
          hideMarkdownSyntax={settings.hideMarkdownSyntax}
          focusOnMount
          onAIStream={aiStreamHandler}
          onChange={(content) => setDocumentState((current) => ({
            ...current,
            content,
            dirty: true,
            updatedAt: Date.now(),
          }))}
        />
      </section>

      <div className="status-line" aria-live="polite">{statusText}</div>

      {settingsOpen && (
        <SettingsSheet
          labels={labels}
          settings={settings}
          onChange={updateSettings}
          onClose={() => {
            setSettingsOpen(false);
            requestAnimationFrame(() => editorRef.current?.focus());
          }}
          onChooseDefaultSavePath={async () => {
            const path = await chooseDirectory();
            if (path) updateSettings({ defaultSavePath: path });
          }}
          onChooseStartupFolder={async () => {
            const path = await chooseDirectory();
            if (path) updateSettings({ startupFolderPath: path });
          }}
          onImportSettings={async () => {
            try {
              const raw = await importSettingsFile();
              if (raw) setSettings(parseSettingsJson(raw));
            } catch (error) {
              setNotice(messageFromError(error));
            }
          }}
          onExportSettings={async () => {
            try {
              await exportSettingsFile(serializeSettings(settings));
              setNotice('Settings exported');
            } catch (error) {
              setNotice(messageFromError(error));
            }
          }}
          onReset={() => setSettings(defaultSettings)}
        />
      )}
    </main>
  );
}

function FolderTree({
  nodes,
  activePath,
  onOpenFile,
}: {
  nodes: FolderTreeNode[];
  activePath: string | null;
  onOpenFile: (path: string) => void;
}) {
  return (
    <ul className="folder-branch">
      {nodes.map((node) => (
        <FolderTreeItem key={node.id} node={node} activePath={activePath} onOpenFile={onOpenFile} />
      ))}
    </ul>
  );
}

function FolderTreeItem({
  node,
  activePath,
  onOpenFile,
}: {
  node: FolderTreeNode;
  activePath: string | null;
  onOpenFile: (path: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const isDirectory = node.kind === 'directory';
  const isActive = node.path === activePath;
  return (
    <li>
      <button
        type="button"
        className={`tree-row ${isActive ? 'active' : ''}`}
        onClick={() => (isDirectory ? setOpen((value) => !value) : onOpenFile(node.path))}
        title={node.path}
      >
        {isDirectory ? (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <FileText size={14} />}
        {isDirectory && <Folder size={14} />}
        <span>{node.name}</span>
      </button>
      {isDirectory && open && node.children && (
        <FolderTree nodes={node.children} activePath={activePath} onOpenFile={onOpenFile} />
      )}
    </li>
  );
}

function SettingsSheet({
  labels,
  settings,
  onChange,
  onClose,
  onChooseDefaultSavePath,
  onChooseStartupFolder,
  onImportSettings,
  onExportSettings,
  onReset,
}: {
  labels: typeof copy.en;
  settings: EditorSettings;
  onChange: (patch: Partial<EditorSettings>) => void;
  onClose: () => void;
  onChooseDefaultSavePath: () => void;
  onChooseStartupFolder: () => void;
  onImportSettings: () => void;
  onExportSettings: () => void;
  onReset: () => void;
}) {
  return (
    <div className="settings-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="settings-sheet" role="dialog" aria-modal="true" aria-label={labels.settings}>
        <header className="settings-header">
          <h1>{labels.settings}</h1>
          <button type="button" className="ghost-icon" aria-label={labels.close} onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="settings-grid">
          <section>
            <h2>{labels.appearance}</h2>
            <label>
              <span>{labels.theme}</span>
              <select value={settings.themeMode} onChange={(event) => onChange({ themeMode: event.target.value as ThemeMode })}>
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <label>
              <span>{labels.accent}</span>
              <input type="color" value={settings.accentColor} onChange={(event) => onChange({ accentColor: event.target.value })} />
            </label>
            <label>
              <span>{labels.language}</span>
              <select value={settings.language} onChange={(event) => onChange({ language: event.target.value === 'zh-CN' ? 'zh-CN' : 'en' })}>
                <option value="en">English</option>
                <option value="zh-CN">中文</option>
              </select>
            </label>
          </section>

          <section>
            <h2>{labels.writing}</h2>
            <Toggle label={labels.markers} checked={settings.hideMarkdownSyntax} onChange={(checked) => onChange({ hideMarkdownSyntax: checked })} />
            <Toggle label={labels.wrap} checked={settings.wordWrap} onChange={(checked) => onChange({ wordWrap: checked })} />
            <Toggle label={labels.spellcheck} checked={settings.spellcheck} onChange={(checked) => onChange({ spellcheck: checked })} />
            <Toggle label={labels.autosave} checked={settings.autosave} onChange={(checked) => onChange({ autosave: checked })} />
            <label>
              <span>{labels.font}</span>
              <input type="range" min="14" max="26" value={settings.editorFontSize} onChange={(event) => onChange({ editorFontSize: Number(event.target.value) })} />
            </label>
            <label>
              <span>{labels.width}</span>
              <input type="range" min="560" max="1080" step="20" value={settings.editorLineWidth} onChange={(event) => onChange({ editorLineWidth: Number(event.target.value) })} />
            </label>
          </section>

          <section>
            <h2>{labels.files}</h2>
            <PathControl label={labels.savePath} value={settings.defaultSavePath} onChoose={onChooseDefaultSavePath} chooseLabel={labels.choose} />
            <PathControl label={labels.startupFolder} value={settings.startupFolderPath} onChoose={onChooseStartupFolder} chooseLabel={labels.choose} />
            <Toggle label={labels.reopen} checked={settings.openStartupFolder} onChange={(checked) => onChange({ openStartupFolder: checked })} />
            <div className="button-row">
              <button type="button" onClick={onImportSettings}>{labels.importSettings}</button>
              <button type="button" onClick={onExportSettings}>{labels.exportSettings}</button>
              <button type="button" onClick={onReset}>{labels.reset}</button>
            </div>
          </section>

          <section>
            <h2>{labels.ai}</h2>
            <Toggle label={labels.aiEnabled} checked={settings.aiEnabled} onChange={(checked) => onChange({ aiEnabled: checked })} />
            <label>
              <span>{labels.provider}</span>
              <input value={settings.aiProvider} onChange={(event) => onChange({ aiProvider: event.target.value })} />
            </label>
            <label>
              <span>{labels.baseUrl}</span>
              <input value={settings.aiBaseUrl} onChange={(event) => onChange({ aiBaseUrl: event.target.value })} />
            </label>
            <label>
              <span>{labels.model}</span>
              <input value={settings.aiModel} onChange={(event) => onChange({ aiModel: event.target.value })} />
            </label>
            <label>
              <span>{labels.apiKey}</span>
              <input type="password" value={settings.aiApiKey} onChange={(event) => onChange({ aiApiKey: event.target.value })} />
            </label>
          </section>
        </div>
      </section>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function PathControl({
  label,
  value,
  onChoose,
  chooseLabel,
}: {
  label: string;
  value: string;
  onChoose: () => void;
  chooseLabel: string;
}) {
  return (
    <label>
      <span>{label}</span>
      <div className="path-control">
        <input value={value} readOnly />
        <button type="button" onClick={onChoose}>{chooseLabel}</button>
      </div>
    </label>
  );
}

function useResolvedTheme(themeMode: ThemeMode) {
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() =>
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return;
    const listener = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? 'dark' : 'light');
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  return themeMode === 'system' ? systemTheme : themeMode;
}

async function requestAIStream(
  settings: EditorSettings,
  systemPrompt: string,
  userPrompt: string,
  signal: AbortSignal,
): Promise<ReadableStream<string>> {
  if (!settings.aiApiKey || !settings.aiBaseUrl || !settings.aiModel) {
    throw new Error('AI settings are incomplete.');
  }

  const response = await fetch(settings.aiBaseUrl, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${settings.aiApiKey}`,
    },
    body: JSON.stringify({
      model: settings.aiModel,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`AI request failed with ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  return new ReadableStream<string>({
    async pull(controller) {
      const { value, done } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') {
          controller.close();
          return;
        }
        try {
          const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) controller.enqueue(content);
        } catch {
          controller.enqueue(data);
        }
      }
    },
    cancel() {
      reader.cancel().catch(() => undefined);
    },
  });
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : 'Operation failed';
}

function emptyAIStream(): Promise<ReadableStream<string>> {
  return Promise.resolve(new ReadableStream<string>({
    start(controller) {
      controller.close();
    },
  }));
}
