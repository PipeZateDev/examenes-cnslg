'use client';

import React from 'react';
import katex from 'katex';

/**
 * Safely renders a LaTeX math string via KaTeX into HTML.
 * If KaTeX fails, falls back gracefully to raw string.
 */
function renderKatex(mathStr: string, isBlock: boolean = false): React.ReactNode {
  try {
    const html = katex.renderToString(mathStr.trim(), {
      displayMode: isBlock,
      throwOnError: false,
      output: 'htmlAndMathml',
      strict: false,
    });
    return (
      <span
        className={isBlock ? 'block my-2 text-center overflow-x-auto py-1' : 'inline-block align-baseline mx-0.5'}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch (err) {
    return <span className="font-mono text-indigo-700">{mathStr}</span>;
  }
}

/**
 * Checks if a string is a standard currency price in Colombian Pesos (e.g. $12.500, $80.000, $600)
 */
function isCurrencyMatch(str: string): boolean {
  return /^\$\s*\d{1,3}(\.\d{3})+(\s*pesos|\s*cop)?$/i.test(str.trim()) || /^\$\s*\d+\s*(pesos|cop)?$/i.test(str.trim());
}

/**
 * Parses inline formatting:
 * 1. KaTeX Math: $$...$$, $...$, \(...\), \[...\]
 * 2. HTML Sup/Sub: <sup>...</sup>, <sub>...</sub>
 * 3. Markdown / HTML formatting: **bold**, <u>underline</u>, *italic*, ~~strikethrough~~, `code`
 */
function parseInline(text: string): React.ReactNode {
  if (!text) return null;

  // Regex tokenizing:
  // 1) Block math: $$...$$ or \[...\]
  // 2) Inline math: $...$ (non-price) or \(...\)
  // 3) <sup>...</sup> or <sub>...</sub>
  // 4) **bold**, <b>...</b>, <strong>...</strong>
  // 5) <u>...</u>, __...__
  // 6) *italic*, <i>...</i>, <em>...</em>
  // 7) ~~strike~~, <s>...</s>
  // 8) `code`
  const tokenRegex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$(?!\s|\d{1,3}(\.\d{3})+(?!\$))[^$\n]+?\$|<sup>[\s\S]*?<\/sup>|<sub>[\s\S]*?<\/sub>|\*\*[^*]+\*\*|<b>[\s\S]*?<\/b>|<strong>[\s\S]*?<\/strong>|<u>[\s\S]*?<\/u>|__[^_]+__|~~[^~]+~~|<s>[\s\S]*?<\/s>|\*[^*]+\*|<i>[\s\S]*?<\/i>|<em>[\s\S]*?<\/em>|`[^`]+`)/gi;

  const parts = text.split(tokenRegex);

  return parts.map((part, idx) => {
    if (!part) return null;

    // Block Math: $$...$$ or \[...\]
    if (part.startsWith('$$') && part.endsWith('$$') && part.length >= 4) {
      const inner = part.slice(2, -2);
      return <React.Fragment key={idx}>{renderKatex(inner, true)}</React.Fragment>;
    }
    if (part.startsWith('\\[') && part.endsWith('\\]') && part.length >= 4) {
      const inner = part.slice(2, -2);
      return <React.Fragment key={idx}>{renderKatex(inner, true)}</React.Fragment>;
    }

    // Inline Math: \(...\)
    if (part.startsWith('\\(') && part.endsWith('\\)') && part.length >= 4) {
      const inner = part.slice(2, -2);
      return <React.Fragment key={idx}>{renderKatex(inner, false)}</React.Fragment>;
    }

    // Inline Math: $...$ (verifying it's not a single currency amount)
    if (part.startsWith('$') && part.endsWith('$') && part.length >= 3) {
      const inner = part.slice(1, -1).trim();
      // If inner is just a standard price (e.g. $10.000$), keep as text
      if (!isCurrencyMatch(part) && !isCurrencyMatch(`$${inner}`)) {
        return <React.Fragment key={idx}>{renderKatex(inner, false)}</React.Fragment>;
      }
    }

    // <sup>...</sup>
    if (part.toLowerCase().startsWith('<sup>') && part.toLowerCase().endsWith('</sup>')) {
      const inner = part.replace(/^<sup>/i, '').replace(/<\/sup>$/i, '');
      return (
        <sup key={idx} className="text-[0.75em] leading-none font-semibold text-indigo-900 align-super px-0.5">
          {parseInline(inner)}
        </sup>
      );
    }

    // <sub>...</sub>
    if (part.toLowerCase().startsWith('<sub>') && part.toLowerCase().endsWith('</sub>')) {
      const inner = part.replace(/^<sub>/i, '').replace(/<\/sub>$/i, '');
      return (
        <sub key={idx} className="text-[0.75em] leading-none font-semibold text-indigo-900 align-sub px-0.5">
          {parseInline(inner)}
        </sub>
      );
    }

    // Bold: **...**, <b>...</b>, <strong>...</strong>
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

    // Underline: <u>...</u>, __...__
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

    // Italic: *...*, <i>...</i>, <em>...</em>
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

    // Strikethrough: ~~...~~, <s>...</s>
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

    // Code: `...`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      const inner = part.slice(1, -1);
      return (
        <code key={idx} className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-xs font-semibold text-slate-800">
          {inner}
        </code>
      );
    }

    // Process raw text: auto-format LaTeX equations or common powers if any
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

/**
 * Safely parses markdown/inline formatting:
 * - Line breaks (\n) and paragraph breaks (\n\n)
 * - Headings (# Title, ## Subtitle, ### Section)
 * - KaTeX math formulas ($...$, $$...$$, \(...\), \[...\])
 * - Superscripts and subscripts (<sup>, <sub>, x², H₂O)
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
