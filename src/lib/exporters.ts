import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import JSZip from 'jszip';
import { deriveTitle, escapeHtml, markdownToHtml, stripMarkdown } from './markdown';

export type ExportFormat = 'markdown' | 'txt' | 'html' | 'docx' | 'jpg' | 'epub';

export interface ExportResult {
  blob: Blob;
  extension: string;
  mimeType: string;
}

const exportMeta: Record<ExportFormat, { extension: string; mimeType: string }> = {
  markdown: { extension: 'md', mimeType: 'text/markdown;charset=utf-8' },
  txt: { extension: 'txt', mimeType: 'text/plain;charset=utf-8' },
  html: { extension: 'html', mimeType: 'text/html;charset=utf-8' },
  docx: {
    extension: 'docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  jpg: { extension: 'jpg', mimeType: 'image/jpeg' },
  epub: { extension: 'epub', mimeType: 'application/epub+zip' },
};

export function getExportMeta(format: ExportFormat) {
  return exportMeta[format];
}

export function sanitizeExportName(title: string, extension: string): string {
  const base = title.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/\.+$/g, '') || 'Untitled';
  return `${base}.${extension}`;
}

export async function exportMarkdown(format: ExportFormat, markdown: string, title = deriveTitle(markdown)): Promise<ExportResult> {
  const meta = getExportMeta(format);
  if (format === 'markdown') {
    return { ...meta, blob: new Blob([markdown], { type: meta.mimeType }) };
  }
  if (format === 'txt') {
    return { ...meta, blob: new Blob([stripMarkdown(markdown)], { type: meta.mimeType }) };
  }
  if (format === 'html') {
    return { ...meta, blob: new Blob([markdownToHtml(markdown, title)], { type: meta.mimeType }) };
  }
  if (format === 'docx') {
    return { ...meta, blob: await markdownToDocxBlob(markdown, title) };
  }
  if (format === 'jpg') {
    return { ...meta, blob: await markdownToJpegBlob(markdown, title) };
  }
  return { ...meta, blob: await markdownToEpubBlob(markdown, title) };
}

async function markdownToDocxBlob(markdown: string, title: string): Promise<Blob> {
  const children = markdown.split(/\r?\n/).map((line) => {
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const headingLevel =
        level === 1
          ? HeadingLevel.HEADING_1
          : level === 2
            ? HeadingLevel.HEADING_2
            : level === 3
              ? HeadingLevel.HEADING_3
              : HeadingLevel.HEADING_4;
      return new Paragraph({ text: heading[2].trim(), heading: headingLevel });
    }

    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    if (bullet) {
      return new Paragraph({ text: stripMarkdown(bullet[1]), bullet: { level: 0 } });
    }

    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ordered) {
      return new Paragraph({ text: stripMarkdown(ordered[1]), numbering: { reference: 'ordered-list', level: 0 } });
    }

    return new Paragraph({
      children: [new TextRun(stripMarkdown(line))],
      spacing: { after: line.trim() ? 160 : 80 },
    });
  });

  const document = new Document({
    creator: 'Moondown',
    title,
    numbering: {
      config: [
        {
          reference: 'ordered-list',
          levels: [
            {
              level: 0,
              format: 'decimal',
              text: '%1.',
              alignment: 'left',
            },
          ],
        },
      ],
    },
    sections: [{ children }],
  });

  return Packer.toBlob(document);
}

async function markdownToEpubBlob(markdown: string, title: string): Promise<Blob> {
  const zip = new JSZip();
  const id = `moondown-${Date.now()}`;
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  );
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" unique-identifier="book-id" xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${escapeHtml(id)}</dc:identifier>
    <dc:title>${escapeHtml(title)}</dc:title>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="chapter"/>
  </spine>
</package>`,
  );
  zip.file(
    'OEBPS/nav.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${escapeHtml(title)}</title></head><body><nav epub:type="toc"><ol><li><a href="chapter.xhtml">${escapeHtml(title)}</a></li></ol></nav></body></html>`,
  );
  zip.file(
    'OEBPS/chapter.xhtml',
    markdownToHtml(markdown, title)
      .replace('<!doctype html>', '<?xml version="1.0" encoding="UTF-8"?>')
      .replace('<html lang="en">', '<html xmlns="http://www.w3.org/1999/xhtml" lang="en">'),
  );
  const data = await zip.generateAsync({ type: 'blob', mimeType: exportMeta.epub.mimeType });
  return data;
}

async function markdownToJpegBlob(markdown: string, title: string): Promise<Blob> {
  const text = stripMarkdown(markdown) || title;
  const canvas = document.createElement('canvas');
  const scale = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  const width = 1400;
  const padding = 96;
  const fontSize = 36;
  const lineHeight = 58;
  const lines = wrapCanvasText(text, width - padding * 2, `${fontSize}px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`);
  const height = Math.max(900, padding * 2 + lines.length * lineHeight);

  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable for JPG export.');
  context.scale(scale, scale);
  context.fillStyle = '#fbfaf8';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#1d1d1f';
  context.font = `600 42px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`;
  context.fillText(title, padding, padding);
  context.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`;
  context.fillStyle = '#3a3a3c';

  lines.forEach((line, index) => {
    context.fillText(line, padding, padding + 82 + index * lineHeight);
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Unable to create JPG export.'))), exportMeta.jpg.mimeType, 0.94);
  });
}

function wrapCanvasText(text: string, maxWidth: number, font: string): string[] {
  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) return text.split(/\r?\n/);
  probe.font = font;
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (probe.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    lines.push(line);
  }
  return lines.slice(0, 120);
}
