import MarkdownIt from 'markdown-it';

export interface MarkdownHeading {
  level: number;
  text: string;
  line: number;
}

export interface MarkdownMetrics {
  words: number;
  characters: number;
  lines: number;
  headings: MarkdownHeading[];
  readingMinutes: number;
}

const markdownRenderer = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
});

export function deriveTitle(markdown: string, filePath?: string | null): string {
  const firstHeading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (firstHeading) return firstHeading.slice(0, 80);
  const firstLine = stripMarkdown(markdown)
    .split('\n')
    .find((line) => line.trim())?.trim();
  if (firstLine) return firstLine.slice(0, 80);
  const fileName = filePath?.split(/[\\/]/).pop()?.replace(/\.(md|markdown|mdown|mkd|txt)$/i, '');
  return fileName || 'Untitled';
}

export function getMarkdownMetrics(markdown: string): MarkdownMetrics {
  const words = stripMarkdown(markdown)
    .split(/[\s\u3000]+/)
    .filter(Boolean).length;
  const headings = extractHeadings(markdown);
  return {
    words,
    characters: markdown.length,
    lines: markdown.length === 0 ? 1 : markdown.split(/\r?\n/).length,
    headings,
    readingMinutes: Math.max(1, Math.ceil(words / 220)),
  };
}

export function extractHeadings(markdown: string): MarkdownHeading[] {
  return markdown.split(/\r?\n/).flatMap((line, index) => {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (!match) return [];
    return [{ level: match[1].length, text: match[2].trim(), line: index + 1 }];
  });
}

export function markdownToHtml(markdown: string, title = 'Untitled'): string {
  const body = markdownRenderer.render(markdown);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 48px auto; max-width: 760px; color: #1d1d1f; font: 17px/1.68 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif; }
    h1, h2, h3 { line-height: 1.18; letter-spacing: 0; }
    code, pre { font-family: "SF Mono", ui-monospace, Menlo, monospace; }
    pre { overflow: auto; padding: 16px; border-radius: 8px; background: #f5f5f7; }
    blockquote { margin-left: 0; padding-left: 16px; border-left: 3px solid #d2d2d7; color: #5f6368; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d2d2d7; padding: 8px 10px; text-align: left; }
    img { max-width: 100%; }
  </style>
</head>
<body>
${body}
</body>
</html>
`;
}

export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[^\n]*\n?|\n?```/g, ''))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/[*_~>#|]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
