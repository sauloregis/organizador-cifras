// Converte o texto colado (ex.: copiado do Cifra Club) em seções e ordem,
// e faz o caminho inverso para edição.

import { firstChord, parseKey, keyName, parseLines } from './chords';
import type { Section, SectionType, Song } from './types';

const TYPE_RULES: [RegExp, SectionType][] = [
  [/pr[eé][\s-]*(refr|coro|chorus)|pre[\s-]*chorus/i, 'prechorus'],
  [/refr|coro|chorus/i, 'chorus'],
  [/ponte|bridge/i, 'bridge'],
  [/intro/i, 'intro'],
  [/solo|instrumental|interl[uú]dio|riff|passagem|base/i, 'instrumental'],
  [/final|outro|encerr|termin|fim/i, 'outro'],
  [/\btag\b|vamp|espont/i, 'tag'],
  [/verso|estrofe|parte|verse|primeira|segunda|terceira|quarta/i, 'verse'],
];

export function sectionTypeFromLabel(label: string): SectionType {
  for (const [re, type] of TYPE_RULES) if (re.test(label)) return type;
  return 'other';
}

export const SECTION_TYPE_NAMES: Record<SectionType, string> = {
  intro: 'Intro',
  verse: 'Estrofe',
  prechorus: 'Pré-refrão',
  chorus: 'Refrão',
  bridge: 'Ponte',
  instrumental: 'Instrumental',
  tag: 'Tag',
  outro: 'Final',
  other: 'Outro',
};

const HEADER_RE = /^\s*\[([^\]]+)\]\s*(.*)$/;
const META_RE = /^\s*(tom|bpm|capotraste|capo|afina[cç][aã]o)\s*:\s*(.*)$/i;

function normalize(content: string): string {
  return content
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/^\n+|\n+$/g, '');
}

function slug(label: string): string {
  return (
    label
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'parte'
  );
}

export interface ParsedSongText {
  sections: Section[];
  /** Ordem em que as seções aparecem no texto (com repetições). */
  order: string[];
  key?: string;
  bpm?: number;
  /** Linhas soltas antes da primeira seção (ex.: nome e artista colados do site). */
  titleGuess?: string;
  artistGuess?: string;
}

/**
 * Lê o texto da cifra.
 * - `[Nome]` inicia uma seção.
 * - Repetir `[Refrão]` sem conteúdo (ou com o mesmo conteúdo) reaproveita a seção.
 * - `Tom: G` e `BPM: 72` no começo viram metadados.
 * - `existing` mantém os ids de seções já salvas (casando pelo nome).
 */
export function parseSongText(text: string, existing: Section[] = []): ParsedSongText {
  const lines = text.replace(/\t/g, '    ').split(/\r?\n/);
  const blocks: { label: string; lines: string[] }[] = [];
  let current: { label: string; lines: string[] } | null = null;
  let key: string | undefined;
  let bpm: number | undefined;

  for (const line of lines) {
    const header = HEADER_RE.exec(line);
    if (header) {
      current = { label: header[1].trim(), lines: [] };
      if (header[2].trim()) current.lines.push(header[2]);
      blocks.push(current);
      continue;
    }
    if (!current) {
      const meta = META_RE.exec(line);
      if (meta) {
        const name = meta[1].toLowerCase();
        if (name === 'tom') {
          const pk = parseKey(meta[2]);
          if (pk) key = keyName(pk.root, pk.minor);
        } else if (name === 'bpm') {
          const n = parseInt(meta[2], 10);
          if (n > 0) bpm = n;
        }
        continue;
      }
      if (!line.trim()) continue;
      current = { label: 'Início', lines: [] };
      blocks.push(current);
    }
    current.lines.push(line);
  }

  // Texto antes da primeira [Seção] sem nenhum acorde = cabeçalho do site (nome, artista).
  // Só vira parte da música se não houver seções marcadas ou se tiver acordes.
  let titleGuess: string | undefined;
  let artistGuess: string | undefined;
  if (blocks[0]?.label === 'Início' && !HEADER_RE.test(lines.find((l) => l.trim()) ?? '')) {
    const pre = blocks[0].lines.filter((l) => l.trim());
    const hasChords = parseLines(pre.join('\n')).some((l) => l.kind === 'pair' || l.kind === 'chords');
    if (blocks.length > 1 && !hasChords) {
      blocks.shift();
      titleGuess = pre[0]?.trim();
      artistGuess = pre[1]?.trim();
    } else if (blocks.length === 1) {
      blocks[0].label = 'Letra';
    }
  }

  const sections: Section[] = [];
  const order: string[] = [];
  const byLabel = new Map<string, Section[]>();
  const usedIds = new Set<string>();
  const existingByLabel = new Map(existing.map((s) => [s.label.toLowerCase(), s]));

  for (const block of blocks) {
    const content = normalize(block.lines.join('\n'));
    const baseLabel = block.label;
    const same = byLabel.get(baseLabel.toLowerCase()) ?? [];

    // Repetição: mesmo nome sem conteúdo, ou com conteúdo idêntico.
    const repeat = content === '' ? same[0] : same.find((s) => s.content === content);
    if (repeat) {
      order.push(repeat.id);
      continue;
    }

    let label = baseLabel;
    if (same.length > 0) label = `${baseLabel} (${same.length + 1})`;

    const prev = existingByLabel.get(label.toLowerCase());
    let id = prev && !usedIds.has(prev.id) ? prev.id : slug(label);
    let n = 2;
    while (usedIds.has(id)) id = `${slug(label)}-${n++}`;
    usedIds.add(id);

    const section: Section = { id, label, type: sectionTypeFromLabel(label), content };
    sections.push(section);
    same.push(section);
    byLabel.set(baseLabel.toLowerCase(), same);
    order.push(id);
  }

  if (!key) {
    for (const s of sections) {
      const c = firstChord(s.content);
      if (c) {
        const pk = parseKey(c);
        if (pk) key = keyName(pk.root, pk.minor);
        break;
      }
    }
  }

  return { sections, order, key, bpm, titleGuess, artistGuess };
}

/** Texto para edição: cada seção uma vez, na ordem em que aparece no arranjo. */
export function songToText(song: Pick<Song, 'sections' | 'arrangement'>): string {
  const seen = new Set<string>();
  const ordered: Section[] = [];
  for (const id of song.arrangement) {
    const s = song.sections.find((x) => x.id === id);
    if (s && !seen.has(id)) {
      seen.add(id);
      ordered.push(s);
    }
  }
  for (const s of song.sections) if (!seen.has(s.id)) ordered.push(s);
  return ordered.map((s) => `[${s.label}]\n${s.content}`).join('\n\n') + '\n';
}

/** Ordem efetiva das partes: a do repertório (se houver) ou a padrão, sem ids inválidos. */
export function resolveArrangement(song: Song, override?: string[]): Section[] {
  const ids = override && override.length ? override : song.arrangement;
  const map = new Map(song.sections.map((s) => [s.id, s]));
  const result = ids.map((id) => map.get(id)).filter((s): s is Section => !!s);
  return result.length ? result : song.sections;
}
