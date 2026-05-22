import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { message } from '@tauri-apps/plugin-dialog';
import type { AIStreamHandler } from 'moondown';
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Download,
  EyeOff,
  FileText,
  FilePlus,
  Folder,
  FolderOpen,
  Languages,
  Moon,
  Palette,
  PanelLeft,
  PenLine,
  RotateCcw,
  Save,
  Search,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Sun,
  Upload,
  X,
  Monitor,
  Replace,
  type LucideIcon,
} from 'lucide-react';
import MoondownEditor, { type MoondownEditorHandle } from './components/MoondownEditor';
import {
  chooseDirectory,
  exportFile,
  exportSettingsFile,
  isDesktopRuntime,
  openFileAtPath,
  openMarkdownFile,
  openMarkdownFolder,
  openSystemMarkdownFile,
  readFolderTree,
  saveMarkdownFile,
  importSettingsFile,
  type FolderTreeNode,
} from './lib/fileActions';
import { AI_PROVIDERS, getAIProvider, type BuiltinAIProvider } from './lib/aiProviders';
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
  | 'close-window'
  | 'settings'
  | 'find'
  | 'replace'
  | 'toggle-tree'
  | 'toggle-syntax'
  | 'theme-system'
  | 'theme-light'
  | 'theme-dark'
  | `export-${ExportFormat}`;

type CommandMenuId = 'file' | 'export' | 'view';

const DRAFT_KEY = 'moondown-app.current-document.v2';

const copy = {
  en: {
    settings: 'Settings',
    close: 'Close',
    file: 'File',
    view: 'View',
    general: 'General',
    writing: 'Writing',
    ai: 'AI',
    files: 'Files',
    appearance: 'Appearance',
    importExport: 'Import & Export',
    advanced: 'Advanced',
    language: 'Language',
    theme: 'Theme',
    system: 'System',
    light: 'Light',
    dark: 'Dark',
    accent: 'Accent color',
    markers: 'Hide Markdown markers',
    font: 'Font size',
    width: 'Line width',
    wrap: 'Word wrap',
    spellcheck: 'Spellcheck',
    autosave: 'Restore draft on launch',
    aiEnabled: 'Enable AI assist',
    provider: 'Provider',
    chooseProvider: 'Choose provider',
    baseUrl: 'Base URL',
    model: 'Model',
    apiKey: 'API key',
    savePath: 'Default save path',
    startupFolder: 'Default startup folder',
    reopen: 'Open startup folder on launch',
    choose: 'Choose',
    new: 'New',
    openFile: 'Open file',
    openFolder: 'Open folder',
    save: 'Save',
    saveAs: 'Save as',
    find: 'Find',
    replace: 'Replace',
    folderTree: 'Folder tree',
    exportAs: 'Export as',
    exportMarkdown: 'Markdown',
    exportText: 'Text',
    exportHtml: 'HTML',
    exportWord: 'Word',
    exportImage: 'JPG',
    exportEpub: 'EPUB',
    importSettings: 'Import settings',
    exportSettings: 'Export settings',
    reset: 'Reset',
    noFolder: 'No folder open',
    localOnly: 'Local configuration',
  },
  'zh-CN': {
    settings: '设置',
    close: '关闭',
    file: '文件',
    view: '视图',
    general: '通用',
    writing: '写作',
    ai: 'AI',
    files: '文件',
    appearance: '外观',
    importExport: '导入与导出',
    advanced: '高级',
    language: '语言',
    theme: '主题',
    system: '跟随系统',
    light: '浅色',
    dark: '深色',
    accent: '主题色',
    markers: '隐藏 Markdown 标记',
    font: '字号',
    width: '行宽',
    wrap: '自动换行',
    spellcheck: '拼写检查',
    autosave: '启动时恢复草稿',
    aiEnabled: '启用 AI 辅助',
    provider: '服务商',
    chooseProvider: '选择服务商',
    baseUrl: 'Base URL',
    model: '模型',
    apiKey: 'API Key',
    savePath: '默认保存路径',
    startupFolder: '默认打开文件夹',
    reopen: '启动时打开该文件夹',
    choose: '选择',
    new: '新建',
    openFile: '打开文件',
    openFolder: '打开文件夹',
    save: '保存',
    saveAs: '另存为',
    find: '查找',
    replace: '替换',
    folderTree: '文件夹树',
    exportAs: '导出为',
    exportMarkdown: 'Markdown',
    exportText: '纯文本',
    exportHtml: 'HTML',
    exportWord: 'Word',
    exportImage: 'JPG',
    exportEpub: 'EPUB',
    importSettings: '导入设置',
    exportSettings: '导出设置',
    reset: '重置',
    noFolder: '未打开文件夹',
    localOnly: '本地配置',
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
  const [openCommandMenu, setOpenCommandMenu] = useState<CommandMenuId | null>(null);
  const [notice, setNotice] = useState('');

  const resolvedTheme = useResolvedTheme(settings.themeMode);
  const metrics = useMemo(() => getMarkdownMetrics(documentState.content), [documentState.content]);
  const title = useMemo(() => deriveTitle(documentState.content, documentState.filePath), [documentState.content, documentState.filePath]);
  const labels = copy[settings.language];
  const statusText = notice || `${metrics.words} words · ${metrics.characters} chars · ${documentState.dirty ? 'edited' : 'saved'}`;

  useDesktopWindowDragging();

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
    if (!openCommandMenu) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest('.command-bar')) {
        setOpenCommandMenu(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenCommandMenu(null);
      }
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [openCommandMenu]);

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

  const openSystemFile = useCallback(async (urlsOrPaths: string[]) => {
    try {
      for (const urlOrPath of urlsOrPaths) {
        const opened = await openSystemMarkdownFile(urlOrPath);
        if (!opened) continue;
        setDocumentState({ content: opened.content, filePath: opened.filePath, dirty: false, updatedAt: Date.now() });
        setNotice('Opened');
        requestAnimationFrame(() => editorRef.current?.focus());
        return;
      }
    } catch (error) {
      setNotice(messageFromError(error));
    }
  }, []);

  const saveCurrentDocument = useCallback(async (forceSaveAs = false): Promise<boolean> => {
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
        return false;
      }
      setDocumentState((current) => ({ ...current, filePath: filePath ?? current.filePath, dirty: false, updatedAt: Date.now() }));
      setNotice('Saved');
      return true;
    } catch (error) {
      setNotice(messageFromError(error));
      return false;
    }
  }, [documentState.content, documentState.filePath, settings.defaultSavePath, title]);

  const closeWindow = useCallback(async () => {
    if (documentState.dirty) {
      const saveLabel = settings.language === 'zh-CN' ? '保存' : 'Save';
      const discardLabel = settings.language === 'zh-CN' ? '不保存' : "Don't Save";
      const cancelLabel = settings.language === 'zh-CN' ? '取消' : 'Cancel';
      const result = isDesktopRuntime()
        ? await message(
          settings.language === 'zh-CN'
            ? '关闭前要保存当前文档吗？'
            : 'Save the current document before closing?',
          {
            title: 'Moondown',
            kind: 'warning',
            buttons: { yes: saveLabel, no: discardLabel, cancel: cancelLabel },
          },
        )
        : window.confirm(settings.language === 'zh-CN' ? '关闭前要保存当前文档吗？' : 'Save the current document before closing?')
          ? saveLabel
          : cancelLabel;

      if (result === saveLabel || result === 'Yes') {
        const saved = await saveCurrentDocument(false);
        if (!saved) return;
      } else if (result !== discardLabel && result !== 'No') {
        return;
      }
    }

    if (isDesktopRuntime()) {
      await closeDesktopWindow();
    }
  }, [documentState.dirty, saveCurrentDocument, settings.language]);

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
    else if (action === 'close-window') void closeWindow();
    else if (action === 'settings') setSettingsOpen(true);
    else if (action === 'find') editorRef.current?.openSearch();
    else if (action === 'replace') editorRef.current?.openReplace();
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
    closeWindow,
    settings.hideMarkdownSyntax,
    updateSettings,
  ]);

  const runCommandBarAction = useCallback((action: MenuAction) => {
    setOpenCommandMenu(null);
    handleMenuAction(action);
  }, [handleMenuAction]);

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
    if (!isDesktopRuntime()) return;
    let unlisten: (() => void) | undefined;

    void Promise.all([
      import('@tauri-apps/api/core'),
      import('@tauri-apps/api/event'),
    ]).then(([{ invoke }, { listen }]) => {
      void invoke<string[]>('opened_urls').then((urls) => openSystemFile(urls));
      void listen<string[]>('moondown-opened', (event) => openSystemFile(event.payload)).then((cleanup) => {
        unlisten = cleanup;
      });
    });

    return () => unlisten?.();
  }, [openSystemFile]);

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
      } else if (key === 'f' && !event.altKey) {
        event.preventDefault();
        editorRef.current?.openSearch();
      } else if (key === 'r' && !event.altKey) {
        event.preventDefault();
        editorRef.current?.openReplace();
      } else if (key === 'w' && !event.altKey) {
        event.preventDefault();
        void closeWindow();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeWindow, createDocument, loadFolder, openFile, saveCurrentDocument]);

  useEffect(() => {
    if (!isDesktopRuntime()) return;
    let unlisten: (() => void) | undefined;
    void getCurrentWindow().onCloseRequested(async (event) => {
      event.preventDefault();
      await closeWindow();
    }).then((cleanup) => {
      unlisten = cleanup;
    });
    return () => unlisten?.();
  }, [closeWindow]);

  const aiStreamHandler = useMemo<AIStreamHandler>(() => {
    return (systemPrompt, userPrompt, signal) => {
      const provider = getAIProvider(settings.aiProvider);
      const missingKey = provider.authMode !== 'none' && !settings.aiApiKey;
      if (!settings.aiEnabled || missingKey || !settings.aiBaseUrl || !settings.aiModel) {
        setSettingsOpen(true);
        return emptyAIStream();
      }
      return requestAIStream(settings, systemPrompt, userPrompt, signal);
    };
  }, [settings]);

  return (
    <main className={`blank-shell ${folderTreeVisible && folderTree.length > 0 ? 'with-tree' : ''}`}>
      <div className="window-drag-layer" data-tauri-drag-region />
      <CommandBar
        labels={labels}
        settings={settings}
        activeMenu={openCommandMenu}
        onToggleMenu={(menu) => setOpenCommandMenu((current) => current === menu ? null : menu)}
        onAction={runCommandBarAction}
      />

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

function CommandBar({
  labels,
  settings,
  activeMenu,
  onToggleMenu,
  onAction,
}: {
  labels: typeof copy.en;
  settings: EditorSettings;
  activeMenu: CommandMenuId | null;
  onToggleMenu: (menu: CommandMenuId) => void;
  onAction: (action: MenuAction) => void;
}) {
  return (
    <nav className="command-bar" aria-label="Common actions">
      <div className="command-group">
        <CommandMenuButton
          id="file"
          label={labels.file}
          icon={FileText}
          activeMenu={activeMenu}
          onToggleMenu={onToggleMenu}
        >
          <CommandMenuItem icon={FilePlus} label={labels.new} onClick={() => onAction('new-document')} />
          <CommandMenuItem icon={FileText} label={labels.openFile} onClick={() => onAction('open-file')} />
          <CommandMenuItem icon={FolderOpen} label={labels.openFolder} onClick={() => onAction('open-folder')} />
          <div className="command-menu-separator" />
          <CommandMenuItem icon={Save} label={labels.save} onClick={() => onAction('save')} />
          <CommandMenuItem icon={Download} label={labels.saveAs} onClick={() => onAction('save-as')} />
        </CommandMenuButton>

        <CommandMenuButton
          id="export"
          label={labels.exportAs}
          icon={Download}
          activeMenu={activeMenu}
          onToggleMenu={onToggleMenu}
        >
          <CommandMenuItem icon={FileText} label={labels.exportMarkdown} onClick={() => onAction('export-markdown')} />
          <CommandMenuItem icon={FileText} label={labels.exportText} onClick={() => onAction('export-txt')} />
          <CommandMenuItem icon={FileText} label={labels.exportHtml} onClick={() => onAction('export-html')} />
          <CommandMenuItem icon={FileText} label={labels.exportWord} onClick={() => onAction('export-docx')} />
          <CommandMenuItem icon={Download} label={labels.exportImage} onClick={() => onAction('export-jpg')} />
          <CommandMenuItem icon={Download} label={labels.exportEpub} onClick={() => onAction('export-epub')} />
        </CommandMenuButton>

        <CommandMenuButton
          id="view"
          label={labels.view}
          icon={PanelLeft}
          activeMenu={activeMenu}
          onToggleMenu={onToggleMenu}
        >
          <CommandMenuItem icon={PanelLeft} label={labels.folderTree} onClick={() => onAction('toggle-tree')} />
          <CommandMenuItem icon={EyeOff} label={labels.markers} onClick={() => onAction('toggle-syntax')} selected={settings.hideMarkdownSyntax} />
          <div className="command-menu-separator" />
          <CommandMenuItem icon={Monitor} label={labels.system} onClick={() => onAction('theme-system')} selected={settings.themeMode === 'system'} />
          <CommandMenuItem icon={Sun} label={labels.light} onClick={() => onAction('theme-light')} selected={settings.themeMode === 'light'} />
          <CommandMenuItem icon={Moon} label={labels.dark} onClick={() => onAction('theme-dark')} selected={settings.themeMode === 'dark'} />
        </CommandMenuButton>
      </div>

      <div className="command-divider" />

      <div className="command-group command-group--quick">
        <CommandIconButton icon={Save} label={labels.save} onClick={() => onAction('save')} />
        <CommandIconButton icon={Search} label={labels.find} onClick={() => onAction('find')} />
        <CommandIconButton icon={Replace} label={labels.replace} onClick={() => onAction('replace')} />
        <CommandIconButton icon={SettingsIcon} label={labels.settings} onClick={() => onAction('settings')} />
      </div>
    </nav>
  );
}

function CommandMenuButton({
  id,
  label,
  icon: Icon,
  activeMenu,
  onToggleMenu,
  children,
}: {
  id: CommandMenuId;
  label: string;
  icon: LucideIcon;
  activeMenu: CommandMenuId | null;
  onToggleMenu: (menu: CommandMenuId) => void;
  children: ReactNode;
}) {
  const isActive = activeMenu === id;

  return (
    <div className="command-menu-wrap">
      <button
        type="button"
        className={`command-menu-trigger ${isActive ? 'active' : ''}`}
        aria-haspopup="menu"
        aria-expanded={isActive}
        onClick={() => onToggleMenu(id)}
      >
        <Icon size={15} />
        <span>{label}</span>
        <ChevronDown size={13} />
      </button>
      {isActive && (
        <div className="command-menu" role="menu">
          {children}
        </div>
      )}
    </div>
  );
}

function CommandMenuItem({
  icon: Icon,
  label,
  selected = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" role="menuitem" className={selected ? 'selected' : ''} onClick={onClick}>
      <Icon size={15} />
      <span>{label}</span>
    </button>
  );
}

function CommandIconButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="command-icon-button" aria-label={label} title={label} onClick={onClick}>
      <Icon size={16} />
    </button>
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
  type SectionId = 'general' | 'appearance' | 'writing' | 'files' | 'ai' | 'importExport' | 'advanced';
  const [activeSection, setActiveSection] = useState<SectionId>('general');
  const sections: Array<{ id: SectionId; label: string; icon: LucideIcon }> = [
    { id: 'general', label: labels.general, icon: SlidersHorizontal },
    { id: 'appearance', label: labels.appearance, icon: Palette },
    { id: 'writing', label: labels.writing, icon: PenLine },
    { id: 'files', label: labels.files, icon: FolderOpen },
    { id: 'ai', label: labels.ai, icon: Bot },
    { id: 'importExport', label: labels.importExport, icon: Download },
    { id: 'advanced', label: labels.advanced, icon: Languages },
  ];
  const activeLabel = sections.find((section) => section.id === activeSection)?.label ?? labels.settings;

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

        <div className="settings-layout">
          <nav className="settings-nav" aria-label={labels.settings}>
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={activeSection === id ? 'active' : ''}
                onClick={() => setActiveSection(id)}
              >
                <Icon size={16} />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          <div className="settings-panel">
            <div className="settings-panel-title">
              <h2>{activeLabel}</h2>
              <span>{labels.localOnly}</span>
            </div>

            {activeSection === 'general' && (
              <div className="preference-group">
                <SegmentedControl
                  label={labels.language}
                  value={settings.language}
                  options={[
                    { value: 'en', label: 'English' },
                    { value: 'zh-CN', label: '中文' },
                  ]}
                  onChange={(value) => onChange({ language: value === 'zh-CN' ? 'zh-CN' : 'en' })}
                />
                <Toggle label={labels.autosave} checked={settings.autosave} onChange={(checked) => onChange({ autosave: checked })} />
                <Toggle label={labels.reopen} checked={settings.openStartupFolder} onChange={(checked) => onChange({ openStartupFolder: checked })} />
              </div>
            )}

            {activeSection === 'appearance' && (
              <div className="preference-group">
                <SegmentedControl
                  label={labels.theme}
                  value={settings.themeMode}
                  options={[
                    { value: 'system', label: labels.system },
                    { value: 'light', label: labels.light },
                    { value: 'dark', label: labels.dark },
                  ]}
                  onChange={(value) => onChange({ themeMode: value as ThemeMode })}
                />
                <FieldRow label={labels.accent}>
                  <div className="accent-control">
                    {['#365f53', '#3468c8', '#8e5ec6', '#b4554f', '#9a6b2f'].map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={settings.accentColor.toLowerCase() === color ? 'selected' : ''}
                        style={{ background: color }}
                        aria-label={color}
                        onClick={() => onChange({ accentColor: color })}
                      />
                    ))}
                    <input type="color" aria-label={labels.accent} value={settings.accentColor} onChange={(event) => onChange({ accentColor: event.target.value })} />
                  </div>
                </FieldRow>
              </div>
            )}

            {activeSection === 'writing' && (
              <div className="preference-group">
                <Toggle label={labels.markers} checked={settings.hideMarkdownSyntax} onChange={(checked) => onChange({ hideMarkdownSyntax: checked })} />
                <Toggle label={labels.wrap} checked={settings.wordWrap} onChange={(checked) => onChange({ wordWrap: checked })} />
                <Toggle label={labels.spellcheck} checked={settings.spellcheck} onChange={(checked) => onChange({ spellcheck: checked })} />
                <RangeControl label={labels.font} value={settings.editorFontSize} min={14} max={26} onChange={(value) => onChange({ editorFontSize: value })} />
                <RangeControl label={labels.width} value={settings.editorLineWidth} min={560} max={1080} step={20} onChange={(value) => onChange({ editorLineWidth: value })} />
              </div>
            )}

            {activeSection === 'files' && (
              <div className="preference-group">
                <PathControl label={labels.savePath} value={settings.defaultSavePath} onChoose={onChooseDefaultSavePath} chooseLabel={labels.choose} />
                <PathControl label={labels.startupFolder} value={settings.startupFolderPath} onChoose={onChooseStartupFolder} chooseLabel={labels.choose} />
              </div>
            )}

            {activeSection === 'ai' && (
              <div className="preference-group">
                <Toggle label={labels.aiEnabled} checked={settings.aiEnabled} onChange={(checked) => onChange({ aiEnabled: checked })} />
                <ProviderPicker
                  label={labels.chooseProvider}
                  providers={AI_PROVIDERS}
                  selectedId={settings.aiProvider}
                  onSelect={(provider) => onChange({
                    aiEnabled: true,
                    aiProvider: provider.id,
                    aiBaseUrl: provider.baseUrl,
                    aiModel: provider.defaultModel,
                  })}
                />
                <TextControl label={labels.baseUrl} value={settings.aiBaseUrl} onChange={(value) => onChange({ aiBaseUrl: value })} />
                <TextControl label={labels.model} value={settings.aiModel} onChange={(value) => onChange({ aiModel: value })} />
                <TextControl label={labels.apiKey} type="password" value={settings.aiApiKey} onChange={(value) => onChange({ aiApiKey: value })} />
              </div>
            )}

            {activeSection === 'importExport' && (
              <div className="preference-group">
                <div className="settings-action-grid">
                  <button type="button" onClick={onImportSettings}><Upload size={15} />{labels.importSettings}</button>
                  <button type="button" onClick={onExportSettings}><Download size={15} />{labels.exportSettings}</button>
                </div>
              </div>
            )}

            {activeSection === 'advanced' && (
              <div className="preference-group">
                <button type="button" className="reset-row" onClick={onReset}>
                  <RotateCcw size={16} />
                  <span>{labels.reset}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function ProviderPicker({
  label,
  providers,
  selectedId,
  onSelect,
}: {
  label: string;
  providers: BuiltinAIProvider[];
  selectedId: string;
  onSelect: (provider: BuiltinAIProvider) => void;
}) {
  const selectedProvider = getAIProvider(selectedId);

  return (
    <div className="settings-row provider-picker-row">
      <span>{label}</span>
      <div className="provider-picker">
        <div className="provider-current">
          <strong>{selectedProvider.name}</strong>
          <span>{selectedProvider.defaultModel}</span>
        </div>
        <div className="provider-grid" role="listbox" aria-label={label}>
          {providers.map((provider) => (
            <button
              key={provider.id}
              type="button"
              role="option"
              aria-selected={provider.id === selectedProvider.id}
              className={provider.id === selectedProvider.id ? 'selected' : ''}
              onClick={() => onSelect(provider)}
            >
              <span>{provider.name}</span>
              <small>{provider.region}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="settings-row toggle-row">
      <span>{label}</span>
      <span className="switch-control">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span />
      </span>
    </label>
  );
}

function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="settings-row">
      <span>{label}</span>
      {children}
    </div>
  );
}

function TextControl({
  label,
  value,
  type = 'text',
  onChange,
}: {
  label: string;
  value: string;
  type?: 'text' | 'password';
  onChange: (value: string) => void;
}) {
  return (
    <FieldRow label={label}>
      <input type={type} aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />
    </FieldRow>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <FieldRow label={label}>
      <div className="range-control">
        <input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
        <output>{value}</output>
      </div>
    </FieldRow>
  );
}

function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <FieldRow label={label}>
      <div className="segmented-control">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={option.value === value ? 'selected' : ''}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </FieldRow>
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
    <div className="settings-row">
      <span>{label}</span>
      <div className="path-control">
        <input value={value} readOnly aria-label={label} />
        <button type="button" onClick={onChoose}>{chooseLabel}</button>
      </div>
    </div>
  );
}

function useDesktopWindowDragging() {
  useEffect(() => {
    if (!isDesktopRuntime()) return;

    const interactiveSelector = [
      'a',
      'button',
      'input',
      'select',
      'textarea',
      '[contenteditable="true"]',
      '[role="button"]',
      '.cm-editor',
      '.folder-tree',
      '.settings-sheet',
    ].join(',');

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      const dragRegion = target?.closest('[data-tauri-drag-region]');
      if (!target || !dragRegion || target.closest(interactiveSelector)) return;

      event.preventDefault();
      void getCurrentWindow().startDragging().catch(() => undefined);
    };

    document.addEventListener('mousedown', handleMouseDown, true);
    return () => document.removeEventListener('mousedown', handleMouseDown, true);
  }, []);
}

async function closeDesktopWindow(): Promise<void> {
  const appWindow = getCurrentWindow();

  try {
    if (await appWindow.isFullscreen()) {
      await appWindow.setFullscreen(false);
      await waitForWindowTransition();
    }
  } catch {
    // Closing should continue even if a platform cannot report fullscreen state.
  }

  await appWindow.hide();
}

function waitForWindowTransition(ms = 240): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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
  const provider = getAIProvider(settings.aiProvider);
  if ((provider.authMode !== 'none' && !settings.aiApiKey) || !settings.aiBaseUrl || !settings.aiModel) {
    throw new Error('AI settings are incomplete.');
  }
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (provider.authMode === 'bearer') {
    headers.authorization = `Bearer ${settings.aiApiKey}`;
  } else if (provider.authMode === 'api-key') {
    headers['api-key'] = settings.aiApiKey;
  } else if (provider.authMode === 'x-api-key') {
    headers['x-api-key'] = settings.aiApiKey;
  }

  const response = await fetch(settings.aiBaseUrl, {
    method: 'POST',
    signal,
    headers,
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
