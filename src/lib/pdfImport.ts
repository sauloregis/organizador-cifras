// Importação de cifras a partir de PDF.
// O PDF guarda cada pedaço de texto com sua posição (x, y). Agrupamos por linha (y) e,
// em cada linha de acordes, descobrimos sobre qual letra da linha de baixo cada acorde está,
// medindo as letras uma a uma — assim o acorde fica na sílaba certa mesmo em fontes
// de largura variável (Arial, Helvetica...).

import { chordTokens, isChord, tokensToString } from './chords';

export interface PdfItem {
  str: string;
  x: number;
  y: number;
  width: number;
  size: number;
  family: string;
  mono: boolean;
}

export interface PdfResult {
  text: string;
  title?: string;
  artist?: string;
}

/** Larguras relativas de cada caractere de `s` numa fonte da família indicada. */
export type MeasureFn = (s: string, family: string) => number[];

interface Glyph {
  ch: string;
  x0: number;
  x1: number;
}

interface Row {
  page: number;
  y: number;
  size: number;
  glyphs: Glyph[];
}

interface BuiltRow {
  row: Row;
  text: string;
  glyphs: Glyph[]; // um por caractere de `text`
  cw: number;
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

function itemGlyphs(item: PdfItem, measure?: MeasureFn): Glyph[] {
  const chars = Array.from(item.str.normalize('NFC'));
  if (!chars.length) return [];
  let widths = chars.map(() => item.width / chars.length);
  if (!item.mono && measure) {
    const w = measure(chars.join(''), item.family);
    const total = w.reduce((a, b) => a + b, 0);
    if (total > 0 && w.length === chars.length) widths = w.map((v) => (v / total) * item.width);
  }
  let x = item.x;
  return chars.map((ch, i) => {
    const g = { ch, x0: x, x1: x + widths[i] };
    x += widths[i];
    return g;
  });
}

function groupRows(pages: PdfItem[][], measure?: MeasureFn): Row[] {
  const rows: Row[] = [];
  pages.forEach((items, page) => {
    const sorted = items.filter((i) => i.str.length > 0).sort((a, b) => b.y - a.y || a.x - b.x);
    let current: Row | null = null;
    for (const item of sorted) {
      const tol = Math.max(1, item.size * 0.45);
      if (!current || Math.abs(current.y - item.y) > tol) {
        current = { page, y: item.y, size: item.size, glyphs: [] };
        rows.push(current);
      }
      current.size = Math.max(current.size, item.size);
      current.glyphs.push(...itemGlyphs(item, measure));
    }
  });
  for (const r of rows) {
    r.glyphs.sort((a, b) => a.x0 - b.x0);
    // remove letras duplicadas (PDFs que simulam negrito desenhando o texto duas vezes)
    r.glyphs = r.glyphs.filter((g, i, arr) => {
      const p = arr[i - 1];
      return !(p && p.ch === g.ch && Math.abs(p.x0 - g.x0) < (g.x1 - g.x0) * 0.3);
    });
  }
  return rows.filter((r) => r.glyphs.some((g) => g.ch.trim()));
}

function buildRow(row: Row): BuiltRow {
  const visible = row.glyphs.filter((g) => g.ch.trim());
  const cw = median(visible.map((g) => g.x1 - g.x0)) || row.size * 0.5;
  const out: Glyph[] = [];
  for (const g of row.glyphs) {
    // o pdf.js representa um vão grande como UM espaço largo: vira vários espaços
    if (g.ch === ' ' && g.x1 - g.x0 > cw * 1.5) {
      const n = Math.max(1, Math.round((g.x1 - g.x0) / cw));
      const w = (g.x1 - g.x0) / n;
      for (let k = 0; k < n; k++) out.push({ ch: ' ', x0: g.x0 + k * w, x1: g.x0 + (k + 1) * w });
      continue;
    }
    const prev = out[out.length - 1];
    if (prev) {
      const gap = g.x0 - prev.x1;
      if (gap > cw * 0.35 && g.ch !== ' ' && prev.ch !== ' ') {
        const n = Math.max(1, Math.round(gap / cw));
        for (let k = 0; k < n; k++) {
          const x0 = prev.x1 + (gap * k) / n;
          out.push({ ch: ' ', x0, x1: x0 + gap / n });
        }
      }
    }
    out.push(g);
  }
  while (out.length && out[0].ch === ' ') out.shift();
  while (out.length && out[out.length - 1].ch === ' ') out.pop();
  return { row, text: out.map((g) => g.ch).join(''), glyphs: out, cw };
}

const JUNK_RE = /(https?:\/\/|www\.|cifraclub|\.com(\.br)?\b|^\s*p[aá]gina\s*\d+|^\s*\d+\s*(\/|de)\s*\d+\s*$|^\s*\d+\s*$)/i;
const SECTION_WORD_RE =
  /^(intro(du[cç][aã]o)?|refr[aã]o|coro|ponte|estrofe(\s*\d+)?|verso(\s*\d+)?|pr[eé][\s-]*refr[aã]o|solo|instrumental|interl[uú]dio|final|outro|tag|(primeira|segunda|terceira|quarta)\s+parte|parte\s*\d+|\d+[ªa°]?\s*parte)\s*:?$/i;

/** Posiciona os acordes de `chordRow` sobre as letras de `lyricRow`. */
function alignPair(chordRow: BuiltRow, lyricRow: BuiltRow): [string, string] {
  const tokens: { text: string; x: number }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(chordRow.text))) tokens.push({ text: m[0], x: chordRow.glyphs[m.index].x0 });

  const L = lyricRow.glyphs;
  const cw = lyricRow.cw;
  const colFor = (x: number) => {
    if (x < L[0].x0) return -Math.round((L[0].x0 - x) / cw);
    for (let i = 0; i < L.length; i++) if (x < (L[i].x0 + L[i].x1) / 2) return i;
    return L.length + Math.max(0, Math.round((x - L[L.length - 1].x1) / cw));
  };
  const cols = tokens.map((t) => colFor(t.x));
  const lead = Math.max(0, -Math.min(0, ...cols));
  const chordLine = tokensToString(
    tokens.map((t, i) => ({ col: cols[i] + lead, text: t.text, chord: isChord(t.text) })),
  );
  return [chordLine, ' '.repeat(lead) + lyricRow.text];
}

/** Converte os textos posicionados das páginas em texto "cifra sobre a letra". */
export function itemsToText(pages: PdfItem[][], measure?: MeasureFn): PdfResult {
  const built = groupRows(pages, measure)
    .map(buildRow)
    .filter((r) => !JUNK_RE.test(r.text));
  if (!built.length) return { text: '' };

  // título/artista: linhas em fonte maior no topo da primeira página
  const bodySize = median(built.map((r) => r.row.size));
  let title: string | undefined;
  let artist: string | undefined;
  if (built[0].row.page === 0 && built[0].row.size >= bodySize * 1.2 && !chordTokens(built[0].text)) {
    title = built.shift()!.text.trim();
    const next = built[0];
    if (next && !chordTokens(next.text) && Math.abs(next.row.size - bodySize) > bodySize * 0.05 && next.text.length < 60) {
      artist = built.shift()!.text.trim();
    }
  }

  // espaçamento normal entre linhas, para detectar os parágrafos (separação entre partes)
  const gaps: number[] = [];
  for (let i = 1; i < built.length; i++) {
    if (built[i].row.page === built[i - 1].row.page) gaps.push(built[i - 1].row.y - built[i].row.y);
  }
  const lineGap = median(gaps) || bodySize * 1.2;
  const isParagraphBreak = (i: number) =>
    i > 0 && built[i].row.page === built[i - 1].row.page && built[i - 1].row.y - built[i].row.y > lineGap * 1.6;

  const out: string[] = [];
  for (let i = 0; i < built.length; i++) {
    const r = built[i];
    if (isParagraphBreak(i) && out.length && out[out.length - 1] !== '') out.push('');

    if (SECTION_WORD_RE.test(r.text.trim())) {
      if (out.length && out[out.length - 1] !== '') out.push('');
      out.push(`[${r.text.trim().replace(/:$/, '')}]`);
      continue;
    }

    const chords = chordTokens(r.text);
    const next = built[i + 1];
    if (chords && next && !isParagraphBreak(i + 1) && !chordTokens(next.text) && !SECTION_WORD_RE.test(next.text.trim())) {
      const [c, l] = alignPair(r, next);
      out.push(c, l);
      i++;
      continue;
    }
    out.push(chords ? tokensToString(chords) : r.text);
  }

  return { text: out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n', title, artist };
}

// ---------------------------------------------------------------------------
// Navegador: lê o arquivo com pdf.js (carregado só quando necessário).

const widthCache = new Map<string, number>();
let ctx: CanvasRenderingContext2D | null = null;

const canvasMeasure: MeasureFn = (s, family) => {
  ctx ??= document.createElement('canvas').getContext('2d');
  if (!ctx) return [];
  const font = /serif/i.test(family) && !/sans/i.test(family) ? '100px "Times New Roman", serif' : '100px Arial, Helvetica, sans-serif';
  ctx.font = font;
  return Array.from(s).map((ch) => {
    const k = font + ch;
    let w = widthCache.get(k);
    if (w === undefined) {
      w = ctx!.measureText(ch).width;
      widthCache.set(k, w);
    }
    return w;
  });
};

interface PdfJsDoc {
  numPages: number;
  getPage(n: number): Promise<{ getTextContent(): Promise<PdfJsTextContent> }>;
  destroy(): Promise<void>;
}
interface PdfJsTextContent {
  items: ({ str: string; transform: number[]; width: number; height: number; fontName: string } | object)[];
  styles: Record<string, { fontFamily: string }>;
}

/** Extrai os textos posicionados de um documento já aberto pelo pdf.js. */
export async function docToItems(doc: PdfJsDoc): Promise<PdfItem[][]> {
  const pages: PdfItem[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    const items: PdfItem[] = [];
    for (const it of tc.items) {
      if (!('str' in it)) continue;
      const t = it.transform;
      const family = tc.styles[it.fontName]?.fontFamily ?? 'sans-serif';
      items.push({
        str: it.str,
        x: t[4],
        y: t[5],
        width: it.width,
        size: Math.hypot(t[2], t[3]) || it.height,
        family,
        mono: /mono|courier/i.test(family),
      });
    }
    pages.push(items);
  }
  return pages;
}

export async function readPdf(file: File | ArrayBuffer): Promise<PdfResult> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const data = new Uint8Array(file instanceof ArrayBuffer ? file : await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  try {
    const pages = await docToItems((await task.promise) as unknown as PdfJsDoc);
    return itemsToText(pages, canvasMeasure);
  } finally {
    await task.destroy();
  }
}
