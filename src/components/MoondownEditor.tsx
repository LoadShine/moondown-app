import { useEffect, useMemo, useRef } from 'react';
import Moondown, { type MoondownTranslations } from 'moondown';
import 'moondown/style.css';
import 'tippy.js/dist/tippy.css';

type EditorTheme = 'light' | 'dark';

interface MoondownEditorProps {
  value: string;
  onChange: (value: string) => void;
  theme: EditorTheme;
  placeholder?: string;
  readOnly?: boolean;
}

export default function MoondownEditor({
  value,
  onChange,
  theme,
  placeholder = 'Start writing...',
  readOnly = false,
}: MoondownEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Moondown | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const translations = useMemo<MoondownTranslations>(
    () => ({
      'moondown.ai.thinking': 'Thinking...',
      'moondown.slash.aiContinue': 'Continue writing',
      'moondown.slash.heading1': 'Heading 1',
      'moondown.slash.heading2': 'Heading 2',
      'moondown.slash.heading3': 'Heading 3',
      'moondown.slash.heading4': 'Heading 4',
      'moondown.slash.insertTable': 'Insert table',
      'moondown.slash.insertLink': 'Insert link',
      'moondown.slash.quoteBlock': 'Quote block',
      'moondown.slash.orderedList': 'Ordered list',
      'moondown.slash.unorderedList': 'Bullet list',
      'moondown.slash.codeBlock': 'Code block',
      'moondown.prompts.textContinuation': 'Continue the current Markdown note in the same voice.',
    }),
    [],
  );

  useEffect(() => {
    if (!hostRef.current) return;

    const editor = new Moondown(hostRef.current, value, {
      theme,
      placeholder,
      readOnly,
      syntaxHiding: true,
      translations,
      onChange: (update) => {
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString());
        }
      },
    });

    editorRef.current = editor;

    return () => {
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
    editorRef.current?.setTranslations(translations);
  }, [translations]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.getValue() !== value) {
      editor.setValue(value);
    }
  }, [value]);

  return <div ref={hostRef} className="moondown-editor" />;
}
