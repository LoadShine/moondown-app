export type ThemeMode = 'system' | 'light' | 'dark';
export type AppLanguage = 'en' | 'zh-CN';

export interface EditorSettings {
  aiEnabled: boolean;
  aiProvider: string;
  aiBaseUrl: string;
  aiModel: string;
  aiApiKey: string;
  themeMode: ThemeMode;
  accentColor: string;
  defaultSavePath: string;
  startupFolderPath: string;
  openStartupFolder: boolean;
  hideMarkdownSyntax: boolean;
  language: AppLanguage;
  editorFontSize: number;
  editorLineWidth: number;
  wordWrap: boolean;
  spellcheck: boolean;
  autosave: boolean;
}

export const SETTINGS_KEY = 'moondown-app.settings.v3';

export const defaultSettings: EditorSettings = {
  aiEnabled: false,
  aiProvider: 'openai-compatible',
  aiBaseUrl: 'https://api.openai.com/v1/chat/completions',
  aiModel: 'gpt-4.1-mini',
  aiApiKey: '',
  themeMode: 'system',
  accentColor: '#365f53',
  defaultSavePath: '',
  startupFolderPath: '',
  openStartupFolder: false,
  hideMarkdownSyntax: true,
  language: 'en',
  editorFontSize: 18,
  editorLineWidth: 760,
  wordWrap: true,
  spellcheck: true,
  autosave: false,
};

export function normalizeSettings(input: unknown): EditorSettings {
  const source = typeof input === 'object' && input !== null ? (input as Partial<EditorSettings>) : {};
  const themeMode = source.themeMode === 'light' || source.themeMode === 'dark' || source.themeMode === 'system'
    ? source.themeMode
    : defaultSettings.themeMode;
  const language = source.language === 'zh-CN' ? 'zh-CN' : 'en';
  const editorFontSize = clampNumber(source.editorFontSize, 14, 26, defaultSettings.editorFontSize);
  const editorLineWidth = clampNumber(source.editorLineWidth, 560, 1080, defaultSettings.editorLineWidth);

  return {
    ...defaultSettings,
    ...source,
    aiEnabled: Boolean(source.aiEnabled),
    themeMode,
    language,
    accentColor: normalizeColor(source.accentColor, defaultSettings.accentColor),
    defaultSavePath: normalizeString(source.defaultSavePath),
    startupFolderPath: normalizeString(source.startupFolderPath),
    openStartupFolder: Boolean(source.openStartupFolder),
    hideMarkdownSyntax: source.hideMarkdownSyntax !== false,
    editorFontSize,
    editorLineWidth,
    wordWrap: source.wordWrap !== false,
    spellcheck: source.spellcheck !== false,
    autosave: source.autosave === true,
    aiProvider: normalizeString(source.aiProvider) || defaultSettings.aiProvider,
    aiBaseUrl: normalizeString(source.aiBaseUrl) || defaultSettings.aiBaseUrl,
    aiModel: normalizeString(source.aiModel) || defaultSettings.aiModel,
    aiApiKey: normalizeString(source.aiApiKey),
  };
}

export function loadSettings(storage: Storage = localStorage): EditorSettings {
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    return normalizeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: EditorSettings, storage: Storage = localStorage): void {
  storage.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)));
}

export function serializeSettings(settings: EditorSettings): string {
  return `${JSON.stringify(normalizeSettings(settings), null, 2)}\n`;
}

export function parseSettingsJson(raw: string): EditorSettings {
  return normalizeSettings(JSON.parse(raw));
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}
