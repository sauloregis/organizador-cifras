// Modelo usado pelo editor visual: cada parte tem linhas, cada linha tem acordes
// posicionados em colunas sobre a letra. Ids estáveis permitem arrastar os elementos.

import { isChord, parseLines, tokensToString } from './chords';
import type { Section, SectionType } from './types';

export interface EChord {
  id: string;
  col: number;
  text: string;
}

export interface ELine {
  id: string;
  kind: 'music' | 'tab' | 'empty';
  chords: EChord[];
  /** Letra da linha; null = linha só de acordes. */
  lyric: string | null;
  /** Conteúdo bruto de linhas de tablatura. */
  text: string;
}

export interface ESection {
  id: string;
  label: string;
  type: SectionType;
  lines: ELine[];
}

let seq = 0;
export const uid = (prefix: string) => `${prefix}${(++seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function contentToLines(content: string): ELine[] {
  const lines = parseLines(content).map((l): ELine => {
    const base = { id: uid('l'), chords: [] as EChord[], lyric: null as string | null, text: '' };
    switch (l.kind) {
      case 'pair':
        return { ...base, kind: 'music', chords: l.chords.map((t) => ({ id: uid('c'), col: t.col, text: t.text })), lyric: l.lyric };
      case 'chords':
        return { ...base, kind: 'music', chords: l.chords.map((t) => ({ id: uid('c'), col: t.col, text: t.text })) };
      case 'lyric':
        return { ...base, kind: 'music', lyric: l.text };
      case 'tab':
        return { ...base, kind: 'tab', text: l.text };
      case 'empty':
        return { ...base, kind: 'empty' };
    }
  });
  while (lines.length && lines[lines.length - 1].kind === 'empty') lines.pop();
  return lines;
}

/** Ordena os acordes e garante pelo menos um espaço entre eles. */
export function normalizeChords(chords: EChord[]): EChord[] {
  const sorted = [...chords].sort((a, b) => a.col - b.col);
  const out: EChord[] = [];
  for (const c of sorted) {
    const prev = out[out.length - 1];
    const min = prev ? prev.col + prev.text.length + 1 : 0;
    out.push(c.col < min ? { ...c, col: min } : c);
  }
  return out;
}

export function linesToContent(lines: ELine[]): string {
  const out: string[] = [];
  for (const l of lines) {
    if (l.kind === 'empty') out.push('');
    else if (l.kind === 'tab') out.push(l.text);
    else {
      const chords = normalizeChords(l.chords);
      if (chords.length) out.push(tokensToString(chords.map((c) => ({ col: c.col, text: c.text, chord: isChord(c.text) }))));
      if (l.lyric !== null) out.push(l.lyric);
      if (!chords.length && l.lyric === null) out.push('');
    }
  }
  return out.join('\n').replace(/\n+$/, '');
}

export function sectionsToModel(sections: Section[]): ESection[] {
  return sections.map((s) => ({ id: s.id, label: s.label, type: s.type, lines: contentToLines(s.content) }));
}

export function modelToSections(model: ESection[]): Section[] {
  return model.map((s) => ({ id: s.id, label: s.label, type: s.type, content: linesToContent(s.lines) }));
}

export function isEmptySection(s: ESection): boolean {
  return s.lines.every((l) => l.kind === 'empty' || (l.kind === 'music' && !l.chords.length && !l.lyric?.trim()));
}

const ORDINALS = ['Primeira', 'Segunda', 'Terceira', 'Quarta', 'Quinta', 'Sexta'];
const BASE_LABEL: Record<SectionType, string> = {
  intro: 'Intro',
  verse: 'Parte',
  prechorus: 'Pré-Refrão',
  chorus: 'Refrão',
  bridge: 'Ponte',
  instrumental: 'Solo',
  tag: 'Tag',
  outro: 'Final',
  other: 'Outra',
};

/** Nome padrão (sem repetir) para uma parte do tipo indicado. */
export function defaultLabel(type: SectionType, taken: string[]): string {
  const used = new Set(taken.map((t) => t.toLowerCase()));
  if (type === 'verse') {
    for (const o of ORDINALS) if (!used.has(`${o} parte`.toLowerCase())) return `${o} Parte`;
  }
  const base = BASE_LABEL[type];
  if (!used.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) if (!used.has(`${base} ${n}`.toLowerCase())) return `${base} ${n}`;
}
