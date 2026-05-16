import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import Moondown, { type AIStreamHandler, type MoondownTranslations } from 'moondown';
import { installMoondownInteractionFixes } from '../lib/moondownInteractionFixes';
import 'moondown/style.css';
import 'tippy.js/dist/tippy.css';

type EditorTheme = 'light' | 'dark';

export interface MoondownEditorHandle {
  focus: () => void;
  getValue: () => string;
}

interface MoondownEditorProps {
  value: string;
  onChange: (value: string) => void;
  theme: EditorTheme;
  locale: string;
  placeholder?: string;
  readOnly?: boolean;
  hideMarkdownSyntax: boolean;
  focusOnMount?: boolean;
  onAIStream?: AIStreamHandler;
}

const MoondownEditor = forwardRef<MoondownEditorHandle, MoondownEditorProps>(function MoondownEditor(
  {
    value,
    onChange,
    theme,
    locale,
    placeholder = '',
    readOnly = false,
    hideMarkdownSyntax,
    focusOnMount = false,
    onAIStream,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Moondown | null>(null);
  const onChangeRef = useRef(onChange);
  const aiStreamRef = useRef(onAIStream);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    aiStreamRef.current = onAIStream;
  }, [onAIStream]);

  const translations = useMemo<MoondownTranslations>(
    () => {
      const zh = locale === 'zh-CN';
      return {
        'moondown.ai.thinking': zh ? '思考中...' : 'Thinking...',
        'moondown.slash.aiContinue': zh ? '继续写作' : 'Continue writing',
        'moondown.slash.heading1': zh ? '一级标题' : 'Heading 1',
        'moondown.slash.heading2': zh ? '二级标题' : 'Heading 2',
        'moondown.slash.heading3': zh ? '三级标题' : 'Heading 3',
        'moondown.slash.heading4': zh ? '四级标题' : 'Heading 4',
        'moondown.slash.insertTable': zh ? '插入表格' : 'Insert table',
        'moondown.slash.insertLink': zh ? '插入链接' : 'Insert link',
        'moondown.slash.quoteBlock': zh ? '引用块' : 'Quote block',
        'moondown.slash.orderedList': zh ? '有序列表' : 'Ordered list',
        'moondown.slash.unorderedList': zh ? '无序列表' : 'Bullet list',
        'moondown.slash.codeBlock': zh ? '代码块' : 'Code block',
        'moondown.prompts.textContinuation': zh
          ? '请延续当前 Markdown 文档的语气继续写作。'
          : 'Continue the current Markdown document in the same voice.',
      };
    },
    [locale],
  );

  useImperativeHandle(ref, () => ({
    focus: () => editorRef.current?.focus(),
    getValue: () => editorRef.current?.getValue() ?? '',
  }), []);

  useEffect(() => {
    if (!hostRef.current) return;

    const cleanupInteractionFixes = installMoondownInteractionFixes(hostRef.current);
    const editor = new Moondown(hostRef.current, value, {
      theme,
      locale,
      placeholder,
      readOnly,
      syntaxHiding: hideMarkdownSyntax,
      translations,
      onAIStream: async (systemPrompt, userPrompt, signal) => {
        if (!aiStreamRef.current) throw new Error('AI is not configured.');
        return aiStreamRef.current(systemPrompt, userPrompt, signal);
      },
      onChange: (update) => {
        if (update.docChanged) onChangeRef.current(update.state.doc.toString());
      },
    });

    editorRef.current = editor;
    if (focusOnMount) requestAnimationFrame(() => editor.focus());

    return () => {
      cleanupInteractionFixes();
      editor.destroy();
      editorRef.current = null;
    };
  }, []);

  useEffect(() => {
    editorRef.current?.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    editorRef.current?.setReadOnly(readOnly);
  }, [readOnly]);

  useEffect(() => {
    editorRef.current?.setPlaceholder(placeholder);
  }, [placeholder]);

  useEffect(() => {
    editorRef.current?.toggleSyntaxHiding(hideMarkdownSyntax);
  }, [hideMarkdownSyntax]);

  useEffect(() => {
    editorRef.current?.setTranslations(translations);
  }, [translations]);

  useEffect(() => {
    editorRef.current?.setLocale(locale);
  }, [locale]);

  useEffect(() => {
    if (onAIStream) {
      editorRef.current?.setAIStreamHandler(onAIStream);
    }
  }, [onAIStream]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || editor.getValue() === value) return;
    editor.setValue(value);
  }, [value]);

  return <div ref={hostRef} className="moondown-editor" spellCheck={false} />;
});

export default MoondownEditor;
