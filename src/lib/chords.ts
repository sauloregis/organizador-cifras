// Reconhecimento de acordes, transposição de tons e análise de linhas
// no formato "cifra sobre a letra" (o mesmo usado pelo Cifra Club).

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const LETTER_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Tons oferecidos nas listas de seleção. */
export const MAJOR_KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const MINOR_KEYS = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];

/** Tons em que os acidentes são escritos com bemol (b) em vez de sustenido (#). */
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);

export function noteIndex(note: string): number {
  const letter = LETTER_INDEX[note[0]?.toUpperCase()];
  if (letter === undefined) return -1;
  let idx = letter;
  for (const acc of note.slice(1)) {
    if (acc === '#') idx++;
    else if (acc === 'b') idx--;
  }
  return ((idx % 12) + 12) % 12;
}

export function noteName(index: number, preferFlats: boolean): string {
  const i = ((index % 12) + 12) % 12;
  return (preferFlats ? FLATS : SHARPS)[i];
}

export interface ParsedKey {
  root: number;
  minor: boolean;
}

export function parseKey(key: string | undefined): ParsedKey | null {
  if (!key) return null;
  const m = /^([A-G][#b]?)(m(?!aj))?/.exec(key.trim());
  if (!m) return null;
  return { root: noteIndex(m[1]), minor: !!m[2] };
}

export function keyName(root: number, minor: boolean): string {
  const list = minor ? MINOR_KEYS : MAJOR_KEYS;
  const found = list.find((k) => parseKey(k)!.root === ((root % 12) + 12) % 12);
  return found ?? noteName(root, false) + (minor ? 'm' : '');
}

export function prefersFlats(key: string | undefined): boolean {
  if (!key) return false;
  const pk = parseKey(key);
  if (!pk) return false;
  return FLAT_KEYS.has(keyName(pk.root, pk.minor));
}

/** Diferença em semitons (0..11) entre o tom original e o tom desejado. */
export function semitonesBetween(fromKey: string | undefined, toKey: string | undefined): number {
  const a = parseKey(fromKey);
  const b = parseKey(toKey);
  if (!a || !b) return 0;
  return (((b.root - a.root) % 12) + 12) % 12;
}

/** Sobe/desce um tom em `steps` semitons, mantendo maior/menor. */
export function shiftKey(key: string, steps: number): string {
  const pk = parseKey(key);
  if (!pk) return key;
  return keyName(pk.root + steps, pk.minor);
}

// ---------------------------------------------------------------------------
// Acordes

// Raiz + sufixos comuns na notação brasileira: m, 7, 7M, maj7, dim, º, sus4, add9,
// (9), (4/9), (b5), +, - ... e baixo opcional (/F#).
const CHORD_RE =
  /^[A-G](?:#|b)?(?:maj|min|dim|aug|sus|add|m|M|º|°|ø|\+|-|[0-9]|#|b|\((?:[^)]*)\)|\/(?=[0-9]))*(?:\/[A-G](?:#|b)?)?$/;

// Outros símbolos que aparecem em linhas de cifra: | || |: :| - x2 (2x) ... % /
const EXTRA_RE = /^(?:\|+|\|?:|:\|?|-+|\.+|%|\/|\*+|\(?[xX]?\d+[xX]?\)?|\(|\)|>|→)$/;

function splitPunct(token: string): { pre: string; core: string; post: string } {
  let pre = '';
  let post = '';
  let core = token;
  while (/^[(\[]/.test(core)) {
    pre += core[0];
    core = core.slice(1);
  }
  // remove do fim só o que não pertence ao acorde: ] , . e ")" sem "(" correspondente
  for (;;) {
    const last = core[core.length - 1];
    if (last === ']' || last === ',' || last === '.') {
      post = last + post;
      core = core.slice(0, -1);
    } else if (last === ')' && (core.match(/\(/g)?.length ?? 0) < (core.match(/\)/g)?.length ?? 0)) {
      post = last + post;
      core = core.slice(0, -1);
    } else break;
  }
  return { pre, core, post };
}

export function isChord(token: string): boolean {
  const { core } = splitPunct(token);
  return core.length > 0 && CHORD_RE.test(core);
}

export function transposeChord(token: string, semitones: number, preferFlats: boolean): string {
  if (semitones % 12 === 0) return token;
  const { pre, core, post } = splitPunct(token);
  if (!CHORD_RE.test(core)) return token;
  const rootMatch = /^[A-G][#b]?/.exec(core)!;
  let rest = core.slice(rootMatch[0].length);
  let bass = '';
  const bassMatch = /\/([A-G][#b]?)$/.exec(rest);
  if (bassMatch) {
    bass = '/' + noteName(noteIndex(bassMatch[1]) + semitones, preferFlats);
    rest = rest.slice(0, bassMatch.index);
  }
  const root = noteName(noteIndex(rootMatch[0]) + semitones, preferFlats);
  return pre + root + rest + bass + post;
}

// ---------------------------------------------------------------------------
// Linhas

export interface Token {
  col: number;
  text: string;
  chord: boolean;
}

export type Line =
  | { kind: 'pair'; chords: Token[]; lyric: string }
  | { kind: 'chords'; chords: Token[] }
  | { kind: 'lyric'; text: string }
  | { kind: 'tab'; text: string }
  | { kind: 'empty' };

const TAB_RE = /^\s*[A-Ga-g][#b]?\s*\|[-0-9|hpbrx\/\\~^ ]+\|?\s*$/;

function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) tokens.push({ col: m.index, text: m[0], chord: isChord(m[0]) });
  return tokens;
}

/** Retorna os tokens se a linha for de cifra; senão, null. */
export function chordTokens(line: string): Token[] | null {
  if (!line.trim()) return null;
  const tokens = tokenize(line);
  let chords = 0;
  for (const t of tokens) {
    if (t.chord) chords++;
    else if (!EXTRA_RE.test(t.text)) return null;
  }
  return chords > 0 ? tokens : null;
}

export function parseLines(content: string): Line[] {
  const raw = content.replace(/\t/g, '    ').split(/\r?\n/);
  const lines: Line[] = [];
  for (let i = 0; i < raw.length; i++) {
    const line = raw[i].replace(/\s+$/, '');
    if (!line.trim()) {
      lines.push({ kind: 'empty' });
      continue;
    }
    if (TAB_RE.test(line)) {
      lines.push({ kind: 'tab', text: line });
      continue;
    }
    const chords = chordTokens(line);
    if (chords) {
      const next = raw[i + 1]?.replace(/\s+$/, '');
      if (next && next.trim() && !TAB_RE.test(next) && !chordTokens(next)) {
        lines.push({ kind: 'pair', chords, lyric: next });
        i++;
      } else {
        lines.push({ kind: 'chords', chords });
      }
      continue;
    }
    lines.push({ kind: 'lyric', text: line });
  }
  return lines;
}

export function transposeTokens(tokens: Token[], semitones: number, preferFlats: boolean): Token[] {
  if (semitones % 12 === 0) return tokens;
  return tokens.map((t) => (t.chord ? { ...t, text: transposeChord(t.text, semitones, preferFlats) } : t));
}

/** Reconstrói uma linha de cifra mantendo as colunas originais (com ao menos 1 espaço entre tokens). */
export function tokensToString(tokens: Token[]): string {
  let out = '';
  for (const t of tokens) {
    if (out.length < t.col) out += ' '.repeat(t.col - out.length);
    else if (out.length > 0) out += ' ';
    out += t.text;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Divisão de um par cifra+letra em blocos que quebram linha sem desalinhar.

export interface Part {
  chord?: string;
  text: string;
}

export type Segment = { type: 'word'; parts: Part[] } | { type: 'space'; text: string };

export function buildSegments(tokens: Token[], lyric: string): Segment[] {
  const sorted = [...tokens].sort((a, b) => a.col - b.col).map((t) => ({ ...t }));
  // Acorde que caiu no espaço logo antes de uma palavra (até 2 colunas) é ancorado nela;
  // senão a palavra seria empurrada e abriria um buraco na letra.
  sorted.forEach((t, i) => {
    let col = t.col;
    while (col < lyric.length && col - t.col < 2 && lyric[col] === ' ') col++;
    const nextCol = sorted[i + 1]?.col ?? Infinity;
    if (col !== t.col && col < lyric.length && lyric[col] !== ' ' && col < nextCol) t.col = col;
  });
  const lastCol = sorted.length ? sorted[sorted.length - 1].col : 0;
  const text = lyric.length <= lastCol ? lyric.padEnd(lastCol, ' ') : lyric;

  const pieces: Part[] = [];
  const first = sorted[0]?.col ?? text.length;
  if (first > 0) pieces.push({ text: text.slice(0, first) });
  sorted.forEach((t, i) => {
    const end = i + 1 < sorted.length ? sorted[i + 1].col : text.length;
    pieces.push({ chord: t.text, text: text.slice(t.col, end) });
  });

  const segments: Segment[] = [];
  let current: Part[] | null = null;
  const flush = () => {
    if (current && current.length) segments.push({ type: 'word', parts: current });
    current = null;
  };
  for (const piece of pieces) {
    let subs = piece.text.split(/(\s+)/).filter((s) => s !== '');
    if (subs.length === 0) subs = [''];
    subs.forEach((s, idx) => {
      const chord = idx === 0 ? piece.chord : undefined;
      const isSpace = s !== '' && /^\s+$/.test(s);
      if (isSpace) {
        flush();
        if (chord) segments.push({ type: 'word', parts: [{ chord, text: s }] });
        else segments.push({ type: 'space', text: s });
        return;
      }
      if (!current) current = [];
      current.push({ chord, text: s });
    });
  }
  flush();
  return segments;
}

/** Primeiro acorde encontrado no texto (útil para sugerir o tom). */
export function firstChord(content: string): string | null {
  for (const line of parseLines(content)) {
    if (line.kind === 'pair' || line.kind === 'chords') {
      const c = line.chords.find((t) => t.chord);
      if (c) return splitPunct(c.text).core;
    }
  }
  return null;
}
