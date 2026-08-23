/* eslint-disable no-control-regex */
import React, { memo } from 'react';

export interface AnsiSpan {
  text: string;
  style: React.CSSProperties;
}

export type LogLevel = 'HTTP' | 'INFO' | 'WARN' | 'ERROR' | 'LOG' | 'OTHER';

const ANSI_REGEX =
  /(?:\u001b\[|\x1b\[|\033\[)([\d;]*)m|\[(\d{1,3}(?:;\d{1,3})*)m(?!\w*\])/g;

const STANDARD_FG_COLORS = [
  '#64748b', // 30 Black / Slate
  '#f87171', // 31 Red
  '#4ade80', // 32 Green
  '#facc15', // 33 Yellow
  '#60a5fa', // 34 Blue
  '#c084fc', // 35 Magenta
  '#22d3ee', // 36 Cyan
  '#f8fafc', // 37 White
];

const BRIGHT_FG_COLORS = [
  '#94a3b8', // 90 Bright Black / Gray
  '#fca5a5', // 91 Bright Red
  '#86efac', // 92 Bright Green
  '#fde047', // 93 Bright Yellow
  '#93c5fd', // 94 Bright Blue
  '#f472b6', // 95 Bright Magenta
  '#67e8f9', // 96 Bright Cyan
  '#ffffff', // 97 Bright White
];

const STANDARD_BG_COLORS = [
  'rgba(30, 41, 59, 0.8)', // 40
  'rgba(185, 28, 28, 0.4)', // 41
  'rgba(21, 128, 61, 0.4)', // 42
  'rgba(161, 98, 7, 0.4)', // 43
  'rgba(29, 78, 216, 0.4)', // 44
  'rgba(126, 34, 206, 0.4)', // 45
  'rgba(14, 116, 144, 0.4)', // 46
  'rgba(241, 245, 249, 0.2)', // 47
];

const BRIGHT_BG_COLORS = [
  'rgba(51, 65, 85, 0.8)', // 100
  'rgba(220, 38, 38, 0.5)', // 101
  'rgba(22, 163, 74, 0.5)', // 102
  'rgba(202, 138, 4, 0.5)', // 103
  'rgba(37, 99, 235, 0.5)', // 104
  'rgba(147, 51, 234, 0.5)', // 105
  'rgba(8, 145, 178, 0.5)', // 106
  'rgba(255, 255, 255, 0.3)', // 107
];

interface AnsiStyleState {
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  color?: string;
  bgColor?: string;
}

function get256Color(n: number): string {
  if (n >= 0 && n < 8) return STANDARD_FG_COLORS[n];
  if (n >= 8 && n < 16) return BRIGHT_FG_COLORS[n - 8];
  if (n >= 232 && n <= 255) {
    const v = (n - 232) * 10 + 8;
    return `rgb(${v},${v},${v})`;
  }
  const code = n - 16;
  const r = Math.floor(code / 36) * 51;
  const g = Math.floor((code % 36) / 6) * 51;
  const b = (code % 6) * 51;
  return `rgb(${r},${g},${b})`;
}

function applySingleCode(state: AnsiStyleState, code: number) {
  if (code === 0) {
    state.bold = false;
    state.dim = false;
    state.italic = false;
    state.underline = false;
    state.color = undefined;
    state.bgColor = undefined;
    return;
  }
  if (code === 1) {
    state.bold = true;
    return;
  }
  if (code === 2) {
    state.dim = true;
    return;
  }
  if (code === 3) {
    state.italic = true;
    return;
  }
  if (code === 4) {
    state.underline = true;
    return;
  }
  if (code === 22) {
    state.bold = false;
    state.dim = false;
    return;
  }
  if (code === 23) {
    state.italic = false;
    return;
  }
  if (code === 24) {
    state.underline = false;
    return;
  }
  if (code === 39) {
    state.color = undefined;
    return;
  }
  if (code === 49) {
    state.bgColor = undefined;
    return;
  }

  if (code >= 30 && code <= 37) {
    state.color = STANDARD_FG_COLORS[code - 30];
    return;
  }
  if (code >= 90 && code <= 97) {
    state.color = BRIGHT_FG_COLORS[code - 90];
    return;
  }
  if (code >= 40 && code <= 47) {
    state.bgColor = STANDARD_BG_COLORS[code - 40];
    return;
  }
  if (code >= 100 && code <= 107) {
    state.bgColor = BRIGHT_BG_COLORS[code - 100];
    return;
  }
}

function applyCodes(state: AnsiStyleState, rawCodes: string) {
  const codes = rawCodes === '' ? [0] : rawCodes.split(';').map((c) => parseInt(c, 10) || 0);
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    if (code === 38 && i + 1 < codes.length) {
      if (codes[i + 1] === 5 && i + 2 < codes.length) {
        state.color = get256Color(codes[i + 2]);
        i += 2;
        continue;
      }
      if (codes[i + 1] === 2 && i + 4 < codes.length) {
        state.color = `rgb(${codes[i + 2]}, ${codes[i + 3]}, ${codes[i + 4]})`;
        i += 4;
        continue;
      }
    }
    if (code === 48 && i + 1 < codes.length) {
      if (codes[i + 1] === 5 && i + 2 < codes.length) {
        state.bgColor = get256Color(codes[i + 2]);
        i += 2;
        continue;
      }
      if (codes[i + 1] === 2 && i + 4 < codes.length) {
        state.bgColor = `rgb(${codes[i + 2]}, ${codes[i + 3]}, ${codes[i + 4]})`;
        i += 4;
        continue;
      }
    }
    applySingleCode(state, code);
  }
}

function stateToStyle(state: AnsiStyleState): React.CSSProperties {
  const style: React.CSSProperties = {};
  if (state.bold) style.fontWeight = 700;
  if (state.dim) style.opacity = 0.7;
  if (state.italic) style.fontStyle = 'italic';
  if (state.underline) style.textDecoration = 'underline';
  if (state.color) style.color = state.color;
  if (state.bgColor) style.backgroundColor = state.bgColor;
  return style;
}

export function stripAnsi(text: string): string {
  if (!text) return '';
  return text.replace(ANSI_REGEX, '');
}

export function parseAnsi(text: string): AnsiSpan[] {
  if (!text) return [];

  const spans: AnsiSpan[] = [];
  const state: AnsiStyleState = {
    bold: false,
    dim: false,
    italic: false,
    underline: false,
    color: undefined,
    bgColor: undefined,
  };

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  ANSI_REGEX.lastIndex = 0;

  while ((match = ANSI_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const chunk = text.slice(lastIndex, match.index);
      spans.push({ text: chunk, style: stateToStyle(state) });
    }
    const rawCodes = match[1] !== undefined ? match[1] : match[2];
    applyCodes(state, rawCodes);
    lastIndex = ANSI_REGEX.lastIndex;
  }

  if (lastIndex < text.length) {
    spans.push({ text: text.slice(lastIndex), style: stateToStyle(state) });
  }

  return spans;
}

export function extractLogLevel(text: string): LogLevel {
  const clean = stripAnsi(text);
  if (/\[HTTP\]/i.test(clean)) return 'HTTP';
  if (/\[ERROR\]|\bERROR\b/i.test(clean)) return 'ERROR';
  if (/\[WARN\]|\[WARNING\]|\bWARN\b/i.test(clean)) return 'WARN';
  if (/\[INFO\]|\bINFO\b/i.test(clean)) return 'INFO';
  if (/\[LOG\]|\bLOG\b/i.test(clean)) return 'LOG';
  return 'OTHER';
}

interface AnsiLineProps {
  line: string;
  lineNumber?: number;
  highlightText?: string;
}

export const AnsiLine: React.FC<AnsiLineProps> = memo(({ line, lineNumber, highlightText }) => {
  const spans = React.useMemo(() => parseAnsi(line), [line]);

  return (
    <div className="flex font-mono text-xs leading-5 hover:bg-white/[0.04] px-3 py-0.5 rounded transition-colors group">
      {lineNumber !== undefined && (
        <span className="w-12 shrink-0 select-none text-right pr-4 text-slate-600 font-medium group-hover:text-slate-400">
          {lineNumber}
        </span>
      )}
      <span className="flex-1 whitespace-pre-wrap break-all select-text">
        {spans.map((span, idx) => {
          if (!highlightText || highlightText.trim() === '') {
            return (
              <span key={idx} style={span.style}>
                {span.text}
              </span>
            );
          }

          const escaped = highlightText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const parts = span.text.split(new RegExp(`(${escaped})`, 'gi'));
          return (
            <span key={idx} style={span.style}>
              {parts.map((part, pIdx) =>
                part.toLowerCase() === highlightText.toLowerCase() ? (
                  <mark
                    key={pIdx}
                    className="bg-yellow-400/30 text-yellow-200 rounded px-0.5 font-bold"
                  >
                    {part}
                  </mark>
                ) : (
                  part
                ),
              )}
            </span>
          );
        })}
      </span>
    </div>
  );
});

AnsiLine.displayName = 'AnsiLine';
