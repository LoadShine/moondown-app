import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Clock,
  Copy,
  Download,
  FileText,
  FolderOpen,
  Hash,
  Moon,
  Plus,
  Save,
  Search,
  Sidebar,
  Sun,
  Trash2,
  Type,
} from 'lucide-react';
import MoondownEditor from './components/MoondownEditor';
import {
  isDesktopRuntime,
  openMarkdownFile,
  saveMarkdownFile,
  titleFromPath,
} from './lib/fileActions';
import brandMarkUrl from '../assets/logo_icon_LightMode.svg';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type ThemeMode = 'light' | 'dark';

interface DocumentRecord {
  id: string;
  title: string;
  content: string;
  filePath: string | null;
  createdAt: number;
  updatedAt: number;
  dirty: boolean;
}

const STORAGE_KEY = 'moondown-app.documents.v1';
const THEME_KEY = 'moondown-app.theme.v1';

const starterContent = `# Moondown

A quiet Markdown space for notes, drafts, research, and long-form thinking.

## What is already here

- Slash commands for headings, lists, quotes, tables, and code blocks.
- WYSIWYG-style Markdown editing powered by the npm \`moondown\` package.
- Local document persistence with native open and save in the desktop app.

## A small table

| Section | Purpose |
| --- | --- |
| Library | Keep notes close |
| Editor | Write without visual noise |
| Files | Open and save Markdown |
`;

const createId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `doc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const now = () => Date.now();

const createStarterDocument = (): DocumentRecord => ({
  id: createId(),
  title: 'Moondown',
  content: starterContent,
  filePath: null,
  createdAt: now(),
  updatedAt: now(),
  dirty: false,
});

const normalizeTitle = (title: string, content: string) => {
  const trimmed = title.trim();
  if (trimmed) return trimmed;
  const firstHeading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (firstHeading) return firstHeading;
  const firstLine = content.split('\n').find((line) => line.trim())?.trim();
  return firstLine?.slice(0, 48) || 'Untitled';
};

const readStoredDocuments = (): DocumentRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [createStarterDocument()];
    const parsed = JSON.parse(raw) as DocumentRecord[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [createStarterDocument()];
  } catch {
    return [createStarterDocument()];
  }
};

const formatUpdatedAt = (timestamp: number) =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);

const getMetrics = (content: string) => {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  const characters = content.length;
  const headings = [...content.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((match) => ({
    level: match[1].length,
    text: match[2].trim(),
  }));
  const readingMinutes = Math.max(1, Math.ceil(words / 220));
  return { words, characters, headings, readingMinutes };
};

export default function App() {
  const [documents, setDocuments] = useState<DocumentRecord[]>(readStoredDocuments);
  const [activeId, setActiveId] = useState(() => documents[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [notice, setNotice] = useState<string | null>(null);

  const activeDocument = documents.find((document) => document.id === activeId) ?? documents[0];
  const metrics = useMemo(() => getMetrics(activeDocument?.content ?? ''), [activeDocument?.content]);

  const filteredDocuments = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return documents;
    return documents.filter((document) => {
      return (
        document.title.toLowerCase().includes(search) ||
        document.content.toLowerCase().includes(search) ||
        (document.filePath?.toLowerCase().includes(search) ?? false)
      );
    });
  }, [documents, query]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
  }, [documents]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const updateDocument = useCallback((id: string, updater: (document: DocumentRecord) => DocumentRecord) => {
    setDocuments((current) => current.map((document) => (document.id === id ? updater(document) : document)));
  }, []);

  const createDocument = useCallback(() => {
    const timestamp = now();
    const nextDocument: DocumentRecord = {
      id: createId(),
      title: 'Untitled',
      content: '# Untitled\n\n',
      filePath: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      dirty: true,
    };
    setDocuments((current) => [nextDocument, ...current]);
    setActiveId(nextDocument.id);
    setSaveState('idle');
  }, []);

  const importDocument = useCallback(async () => {
    try {
      const opened = await openMarkdownFile();
      if (!opened) return;
      const timestamp = now();
      const nextDocument: DocumentRecord = {
        id: createId(),
        title: normalizeTitle(opened.name || titleFromPath(opened.filePath), opened.content),
        content: opened.content,
        filePath: opened.filePath,
        createdAt: timestamp,
        updatedAt: timestamp,
        dirty: false,
      };
      setDocuments((current) => [nextDocument, ...current]);
      setActiveId(nextDocument.id);
      setNotice('Opened Markdown file');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to open file');
    }
  }, []);

  const saveCurrentDocument = useCallback(
    async (forceSaveAs = false) => {
      if (!activeDocument) return;
      setSaveState('saving');
      try {
        const desktopRuntime = isDesktopRuntime();
        const targetPath = await saveMarkdownFile({
          content: activeDocument.content,
          filePath: activeDocument.filePath,
          suggestedName: `${normalizeTitle(activeDocument.title, activeDocument.content)}.md`,
          forceSaveAs,
        });

        if (targetPath === null && desktopRuntime) {
          setSaveState('idle');
          setNotice('Save cancelled');
          return;
        }

        updateDocument(activeDocument.id, (document) => ({
          ...document,
          filePath: targetPath ?? document.filePath,
          title: normalizeTitle(document.title || titleFromPath(targetPath), document.content),
          updatedAt: now(),
          dirty: false,
        }));
        setSaveState('saved');
        setNotice('Saved Markdown file');
      } catch (error) {
        setSaveState('error');
        setNotice(error instanceof Error ? error.message : 'Unable to save file');
      }
    },
    [activeDocument, updateDocument],
  );

  const deleteCurrentDocument = useCallback(() => {
    if (!activeDocument) return;
    setDocuments((current) => {
      const remaining = current.filter((document) => document.id !== activeDocument.id);
      if (remaining.length === 0) {
        const starter = createStarterDocument();
        setActiveId(starter.id);
        return [starter];
      }
      setActiveId(remaining[0].id);
      return remaining;
    });
  }, [activeDocument]);

  const duplicateDocument = useCallback(() => {
    if (!activeDocument) return;
    const timestamp = now();
    const copy: DocumentRecord = {
      ...activeDocument,
      id: createId(),
      title: `${activeDocument.title} Copy`,
      filePath: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      dirty: true,
    };
    setDocuments((current) => [copy, ...current]);
    setActiveId(copy.id);
  }, [activeDocument]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const command = event.metaKey || event.ctrlKey;
      if (!command) return;

      if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveCurrentDocument(event.shiftKey);
      }
      if (event.key.toLowerCase() === 'o') {
        event.preventDefault();
        void importDocument();
      }
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        createDocument();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [createDocument, importDocument, saveCurrentDocument]);

  if (!activeDocument) return null;

  return (
    <div className="app-shell">
      <header className="topbar" data-tauri-drag-region>
        <div className="brand">
          <img src={brandMarkUrl} alt="" className="brand-mark" />
          <div>
            <strong>Moondown</strong>
            <span>{isDesktopRuntime() ? 'Desktop' : 'Web Preview'}</span>
          </div>
        </div>

        <nav className="toolbar" aria-label="Document actions">
          <button className="icon-button" type="button" title="Toggle library" aria-label="Toggle library" onClick={() => setSidebarOpen((open) => !open)}>
            <Sidebar size={18} />
          </button>
          <button className="toolbar-button" type="button" aria-label="New document" onClick={createDocument}>
            <Plus size={17} />
            New
          </button>
          <button className="toolbar-button" type="button" aria-label="Open document" onClick={importDocument}>
            <FolderOpen size={17} />
            Open
          </button>
          <button className="toolbar-button primary" type="button" aria-label="Save document" onClick={() => saveCurrentDocument(false)}>
            <Save size={17} />
            Save
          </button>
          <button className="icon-button" type="button" title="Save as" aria-label="Save as" onClick={() => saveCurrentDocument(true)}>
            <Download size={18} />
          </button>
          <button className="icon-button" type="button" title="Toggle appearance" aria-label="Toggle appearance" onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </nav>
      </header>

      <div className={`workspace ${sidebarOpen ? 'with-sidebar' : 'without-sidebar'}`}>
        <aside className="library" aria-label="Document library">
          <div className="search-shell">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" aria-label="Search documents" />
          </div>

          <div className="document-list">
            {filteredDocuments.map((document) => (
              <button
                type="button"
                key={document.id}
                className={`document-item ${document.id === activeDocument.id ? 'active' : ''}`}
                onClick={() => setActiveId(document.id)}
              >
                <FileText size={18} />
                <span>
                  <strong>{document.title}</strong>
                  <small>{formatUpdatedAt(document.updatedAt)}</small>
                </span>
                {document.dirty && <i aria-label="Unsaved changes" />}
              </button>
            ))}
          </div>
        </aside>

        <main className="editor-stage">
          <section className="document-title-row">
            <input
              className="title-input"
              value={activeDocument.title}
              aria-label="Document title"
              onChange={(event) =>
                updateDocument(activeDocument.id, (document) => ({
                  ...document,
                  title: event.target.value,
                  updatedAt: now(),
                  dirty: true,
                }))
              }
            />
            <div className={`save-state ${saveState}`}>
              {saveState === 'saving' ? 'Saving' : activeDocument.dirty ? 'Edited' : saveState === 'error' ? 'Save failed' : 'Saved'}
            </div>
          </section>

          <section className="path-row" aria-label="File path">
            <span>{activeDocument.filePath ?? 'Local library'}</span>
            <div className="inline-actions">
              <button type="button" title="Duplicate" aria-label="Duplicate document" onClick={duplicateDocument}>
                <Copy size={16} />
              </button>
              <button type="button" title="Delete" aria-label="Delete document" onClick={deleteCurrentDocument}>
                <Trash2 size={16} />
              </button>
            </div>
          </section>

          <section className="editor-surface">
            <MoondownEditor
              value={activeDocument.content}
              theme={theme}
              placeholder="Write Markdown..."
              onChange={(content) =>
                updateDocument(activeDocument.id, (document) => ({
                  ...document,
                  content,
                  title: document.title === 'Untitled' ? normalizeTitle(document.title, content) : document.title,
                  updatedAt: now(),
                  dirty: true,
                }))
              }
            />
          </section>
        </main>

        <aside className="inspector" aria-label="Document details">
          <section>
            <h2>Outline</h2>
            <div className="outline-list">
              {metrics.headings.length === 0 ? (
                <span className="muted">No headings</span>
              ) : (
                metrics.headings.map((heading, index) => (
                  <span key={`${heading.text}-${index}`} style={{ paddingLeft: `${(heading.level - 1) * 10}px` }}>
                    {heading.text}
                  </span>
                ))
              )}
            </div>
          </section>

          <section>
            <h2>Details</h2>
            <div className="metric-grid">
              <span>
                <Type size={16} />
                {metrics.words} words
              </span>
              <span>
                <Hash size={16} />
                {metrics.characters} chars
              </span>
              <span>
                <Clock size={16} />
                {metrics.readingMinutes} min
              </span>
              <span>
                <BookOpen size={16} />
                {metrics.headings.length} heads
              </span>
            </div>
          </section>
        </aside>
      </div>

      {notice && <div className="toast">{notice}</div>}
    </div>
  );
}
