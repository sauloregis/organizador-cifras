// Separa uma cifra sem marcações em partes e dá um palpite de classificação:
// Intro / Primeira Parte / Pré-Refrão / Refrão / Ponte / Solo / Final.
// O palpite pode ser corrigido depois no editor.

import { parseLines } from './chords';

const HEADER_RE = /^\s*\[[^\]]+\]/;
const META_RE = /^\s*(tom|bpm|capotraste|capo|afina[cç][aã]o)\s*:/i;
const ORDINALS = ['Primeira', 'Segunda', 'Terceira', 'Quarta', 'Quinta', 'Sexta'];

interface Block {
  lines: string[];
  hasChords: boolean;
  hasLyrics: boolean;
  words: string[];
}

function normWords(s: string): string[] {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(\s*\d+\s*x\s*\)|\bx\s*\d+\b|\d+\s*x\b/g, ' ') // ignora "(2x)"
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function analyze(lines: string[]): Block {
  const parsed = parseLines(lines.join('\n'));
  const lyricText: string[] = [];
  let hasChords = false;
  for (const l of parsed) {
    if (l.kind === 'pair') {
      hasChords = true;
      lyricText.push(l.lyric);
    } else if (l.kind === 'chords') hasChords = true;
    else if (l.kind === 'lyric') lyricText.push(l.text);
  }
  const words = normWords(lyricText.join(' '));
  return { lines, hasChords, hasLyrics: words.length > 0, words };
}

/** Semelhança entre letras (0..1), tolerante a pequenas diferenças. */
function similarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const count = (xs: string[]) => xs.reduce((m, w) => m.set(w, (m.get(w) ?? 0) + 1), new Map<string, number>());
  const ca = count(a);
  const cb = count(b);
  let inter = 0;
  for (const [w, n] of ca) inter += Math.min(n, cb.get(w) ?? 0);
  return (2 * inter) / (a.length + b.length);
}

export function hasSectionHeaders(text: string): boolean {
  return text.split(/\r?\n/).some((l) => HEADER_RE.test(l));
}

/**
 * Insere marcações `[Parte]` num texto que não tem nenhuma.
 * Textos que já têm marcações são devolvidos sem mudança.
 */
export function autoSection(text: string, title?: string): string {
  if (hasSectionHeaders(text)) return text;
  const all = text.replace(/\r/g, '').split('\n');

  // metadados (Tom:, BPM:) no topo ficam onde estão
  const head: string[] = [];
  let i = 0;
  while (i < all.length && (META_RE.test(all[i]) || !all[i].trim())) head.push(all[i++]);

  // blocos separados por linha em branco
  const raw: string[][] = [];
  let cur: string[] = [];
  for (; i < all.length; i++) {
    if (!all[i].trim()) {
      if (cur.length) raw.push(cur);
      cur = [];
    } else cur.push(all[i]);
  }
  if (cur.length) raw.push(cur);
  let blocks = raw.map(analyze);
  if (blocks.length === 0) return text;

  // blocos sem acordes no início de uma música que tem acordes = cabeçalho (nome, autor)
  const preamble: string[] = [];
  if (blocks.some((b) => b.hasChords)) {
    while (blocks.length && !blocks[0].hasChords) preamble.push(...blocks.shift()!.lines, '');
  }
  if (blocks.length === 0) return text;

  // agrupa blocos com a mesma letra
  const group: number[] = [];
  const groups: number[][] = [];
  blocks.forEach((b, idx) => {
    if (!b.hasLyrics) {
      group[idx] = -1;
      return;
    }
    const g = groups.findIndex((members) => similarity(blocks[members[0]].words, b.words) >= 0.75);
    if (g >= 0) {
      groups[g].push(idx);
      group[idx] = g;
    } else {
      groups.push([idx]);
      group[idx] = groups.length - 1;
    }
  });

  // refrão: grupo que mais se repete (bônus se contém o nome da música)
  const titleWords = title ? normWords(title) : [];
  let chorus = -1;
  let best = 0;
  groups.forEach((members, g) => {
    if (members.length < 2) return;
    const words = blocks[members[0]].words.join(' ');
    const hasTitle = titleWords.length > 0 && words.includes(titleWords.join(' '));
    const score = members.length * 10 + (hasTitle ? 15 : 0) + (members[0] > 0 ? 1 : 0);
    if (score > best) {
      best = score;
      chorus = g;
    }
  });
  const chorusIdx = chorus >= 0 ? groups[chorus] : [];

  // pré-refrão: outro grupo repetido que sempre vem logo antes do refrão
  const pre = new Set<number>();
  groups.forEach((members, g) => {
    if (g === chorus || members.length < 2) return;
    if (members.every((m) => group[m + 1] === chorus)) pre.add(g);
  });

  const firstLyric = blocks.findIndex((b) => b.hasLyrics);
  let lastLyric = -1;
  blocks.forEach((b, idx) => b.hasLyrics && (lastLyric = idx));
  const secondChorus = chorusIdx[1] ?? Infinity;

  const labelOf = new Map<number, string>();
  let verseN = 0;
  const labels = blocks.map((b, idx) => {
    if (!b.hasLyrics) {
      if (firstLyric === -1 || idx < firstLyric) return 'Intro';
      if (idx > lastLyric) return 'Final';
      return 'Solo';
    }
    const g = group[idx];
    if (labelOf.has(g)) return labelOf.get(g)!;
    let label: string;
    if (g === chorus) label = 'Refrão';
    else if (pre.has(g)) label = 'Pré-Refrão';
    else if (groups[g].length === 1 && idx > secondChorus) label = 'Ponte';
    else label = verseN < ORDINALS.length ? `${ORDINALS[verseN++]} Parte` : `Parte ${++verseN}`;
    labelOf.set(g, label);
    return label;
  });

  const out = [...head.filter((l, k) => l.trim() || k < head.length - 1), ...(head.length ? [''] : []), ...preamble];
  blocks.forEach((b, idx) => {
    out.push(`[${labels[idx]}]`, ...b.lines, '');
  });
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
