'use client';

import React from 'react';

/**
 * Parses markdown inline formatting (bold, underline, italic, strikethrough, code)
 */
function parseInline(text: string): React.ReactNode {
  if (!text) return null;

  // Regex tokenizing inline formatting:
  // 1) **bold** or <b>bold</b> or <strong>bold</strong>
  // 2) <u>underline</u> or __underline__
  // 3) *italic* or <i>italic</i> or <em>italic</em>
  // 4) ~~strikethrough~~ or <s>strikethrough</s>
  // 5) `code`
  const inlineRegex = /(\*\*[^*]+\*\*|<b>[\s\S]*?<\/b>|<strong>[\s\S]*?<\/strong>|<u>[\s\S]*?<\/u>|__[^_]+__|~~[^~]+~~|<s>[\s\S]*?<\/s>|\*[^*]+\*|<i>[\s\S]*?<\/i>|<em>[\s\S]*?<\/em>|`[^`]+`)/gi;

  const parts = text.split(inlineRegex);

  return parts.map((part, idx) => {
    if (!part) return null;

    // Bold
    if (
      (part.startsWith('**') && part.endsWith('**') && part.length >= 4) ||
      (part.toLowerCase().startsWith('<b>') && part.toLowerCase().endsWith('</b>')) ||
      (part.toLowerCase().startsWith('<strong>') && part.toLowerCase().endsWith('</strong>'))
    ) {
      const inner = part
        .replace(/^\*\*|\*\*$/g, '')
        .replace(/^<[a-z0-9]+>/i, '')
        .replace(/<\/[a-z0-9]+>$/i, '');
      return (
        <strong key={idx} className="font-extrabold text-slate-900 tracking-tight">
          {parseInline(inner)}
        </strong>
      );
    }

    // Underline
    if (
      (part.toLowerCase().startsWith('<u>') && part.toLowerCase().endsWith('</u>')) ||
      (part.startsWith('__') && part.endsWith('__') && part.length >= 4)
    ) {
      const inner = part
        .replace(/^<u>/i, '')
        .replace(/<\/u>$/i, '')
        .replace(/^__|^__$/g, '');
      return (
        <u key={idx} className="underline underline-offset-4 decoration-2 decoration-current font-semibold">
          {parseInline(inner)}
        </u>
      );
    }

    // Italic
    if (
      (part.startsWith('*') && part.endsWith('*') && part.length >= 2) ||
      (part.toLowerCase().startsWith('<i>') && part.toLowerCase().endsWith('</i>')) ||
      (part.toLowerCase().startsWith('<em>') && part.toLowerCase().endsWith('</em>'))
    ) {
      const inner = part
        .replace(/^\*|\*$/g, '')
        .replace(/^<[a-z0-9]+>/i, '')
        .replace(/<\/[a-z0-9]+>$/i, '');
      return (
        <em key={idx} className="italic">
          {parseInline(inner)}
        </em>
      );
    }

    // Strikethrough
    if (
      (part.startsWith('~~') && part.endsWith('~~') && part.length >= 4) ||
      (part.toLowerCase().startsWith('<s>') && part.toLowerCase().endsWith('</s>'))
    ) {
      const inner = part
        .replace(/^~~|~~$/g, '')
        .replace(/^<s>/i, '')
        .replace(/<\/s>$/i, '');
      return (
        <s key={idx} className="line-through opacity-75">
          {parseInline(inner)}
        </s>
      );
    }

    // Code
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      const inner = part.slice(1, -1);
      return (
        <code key={idx} className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-xs font-semibold text-slate-800">
          {inner}
        </code>
      );
    }

    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

/**
 * Safely parses markdown/inline formatting:
 * - Line breaks (\n) and paragraph breaks (\n\n)
 * - Headings (# Title, ## Subtitle, ### Section)
 * - Bold (**word**), Underline (<u>word</u>), Italic (*word*), Strikethrough (~~word~~)
 */
export function renderFormattedContent(rawText: string): React.ReactNode {
  if (!rawText) return null;

  // Split lines while preserving empty lines for paragraph spacing
  const lines = rawText.split('\n');

  return lines.map((line, lineIdx) => {
    const trimmed = line.trim();

    // Empty line -> paragraph separator
    if (!trimmed) {
      return <span key={lineIdx} className="block h-2" />;
    }

    // Heading 1 (# ...)
    if (line.startsWith('# ')) {
      return (
        <span key={lineIdx} className="block text-xl md:text-2xl font-black text-slate-900 my-2">
          {parseInline(line.replace(/^#\s+/, ''))}
        </span>
      );
    }

    // Heading 2 (## ...)
    if (line.startsWith('## ')) {
      return (
        <span key={lineIdx} className="block text-lg md:text-xl font-bold text-slate-900 my-1.5">
          {parseInline(line.replace(/^##\s+/, ''))}
        </span>
      );
    }

    // Heading 3 (### ...)
    if (line.startsWith('### ')) {
      return (
        <span key={lineIdx} className="block text-base md:text-lg font-bold text-slate-800 my-1">
          {parseInline(line.replace(/^###\s+/, ''))}
        </span>
      );
    }

    // Bullet list item (- ... or * ...)
    if (/^[-*]\s+/.test(line)) {
      return (
        <span key={lineIdx} className="block pl-4 relative my-0.5">
          <span className="absolute left-0 text-slate-400">•</span>
          {parseInline(line.replace(/^[-*]\s+/, ''))}
        </span>
      );
    }

    // Regular line
    return (
      <span key={lineIdx} className="block leading-relaxed">
        {parseInline(line)}
      </span>
    );
  });
}

interface FormattedTextProps {
  text?: string | null;
  className?: string;
}

export default function FormattedText({ text, className = '' }: FormattedTextProps) {
  if (!text) return null;
  return <div className={`whitespace-normal ${className}`}>{renderFormattedContent(text)}</div>;
}
