import { describe, expect, it } from 'vitest';
import { itemsToText, type MeasureFn, type PdfItem } from './pdfImport';

// Larguras da Helvetica (padrão AFM, em milésimos de em) — simulam um PDF em fonte proporcional.
const HELV: Record<string, number> = {
  ' ': 278, ',': 278, '.': 278, a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222,
  k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500,
  y: 500, z: 500, A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, M: 833, S: 667, T: 611, '#': 556,
  '/': 278, '7': 556, '9': 556, '(': 333, ')': 333, ã: 556, é: 556, í: 278, ó: 556, ç: 500,
};
const helvWidth = (s: string, size: number) => Array.from(s).reduce((a, ch) => a + (HELV[ch] ?? 556), 0) * (size / 1000);
const measure: MeasureFn = (s) => Array.from(s).map((ch) => HELV[ch] ?? 556);

function item(str: string, x: number, y: number, size = 12): PdfItem {
  return { str, x, y, width: helvWidth(str, size), size, family: 'sans-serif', mono: false };
}

/** Linha de letra + acordes posicionados exatamente sobre as sílabas indicadas. */
function pair(lyric: string, chords: [string, string][], y: number, x0 = 50): PdfItem[] {
  const items = [item(lyric, x0, y)];
  for (const [chord, before] of chords) {
    const idx = lyric.indexOf(before);
    items.push(item(chord, x0 + helvWidth(lyric.slice(0, idx), 12), y + 14));
  }
  return items;
}

describe('itemsToText (PDF)', () => {
  it('alinha os acordes nas sílabas certas em fonte proporcional', () => {
    const page = [
      ...pair('Santo, santo é o Senhor', [['G', 'Santo'], ['D/F#', 'anto é'], ['Em', 'Senhor']], 700),
      ...pair('Minha alma te adora', [['C', 'Minha'], ['Am7', 'alma'], ['D', 'dora']], 672),
    ];
    const { text } = itemsToText([page], measure);
    const lines = text.trimEnd().split('\n');
    // a coluna de cada acorde precisa cair na letra esperada
    const at = (chordLine: string, lyric: string, chord: string) => lyric[chordLine.indexOf(chord)];
    expect(lines[1]).toBe('Santo, santo é o Senhor');
    expect(at(lines[0], lines[1], 'G')).toBe('S');
    expect(lines[1].slice(lines[0].indexOf('D/F#'))).toMatch(/^anto é/);
    expect(lines[1].slice(lines[0].indexOf('Em'))).toBe('Senhor');
    expect(lines[3].slice(lines[2].indexOf('Am7'))).toMatch(/^alma/);
    expect(lines[3].slice(lines[2].indexOf(' D') + 1)).toBe('dora');
  });

  it('detecta título, parágrafos e nomes de partes', () => {
    const page = [
      item('Nome da Música', 50, 800, 20),
      item('Artista', 50, 775, 14),
      item('Refrão', 50, 740),
      ...pair('Linha do refrão', [['C', 'Linha']], 712),
      ...pair('Outra linha', [['G', 'Outra']], 684),
      // parágrafo (espaço maior)
      ...pair('Começa a ponte', [['Am', 'Começa']], 620),
      item('https://www.cifraclub.com.br/x', 50, 40, 8),
    ];
    const r = itemsToText([page], measure);
    expect(r.title).toBe('Nome da Música');
    expect(r.artist).toBe('Artista');
    expect(r.text).toBe('[Refrão]\nC\nLinha do refrão\nG\nOutra linha\n\nAm\nComeça a ponte\n');
  });

  it('linha só de acordes mantém o espaçamento e acorde antes da letra empurra a letra', () => {
    const page = [
      item('G', 50, 700),
      item('D', 90, 700),
      item('Em', 130, 700),
      // linha de acordes cujo primeiro acorde começa antes da letra (pickup)
      item('A', 40, 660),
      item('Vem', 60, 646),
    ];
    const { text } = itemsToText([page], measure);
    const lines = text.trimEnd().split('\n');
    expect(lines[0].replace(/\s+/g, ' ')).toBe('G D Em');
    expect(lines[1].indexOf('A')).toBeLessThan(lines[2].indexOf('V'));
  });

  it('PDF em fonte monoespaçada usa colunas exatas', () => {
    const mono = (str: string, x: number, y: number): PdfItem => ({
      str, x, y, width: str.length * 7.2, size: 12, family: 'monospace', mono: true,
    });
    const page = [mono('G       C', 50, 700), mono('Aleluia, aleluia', 50, 686)];
    const { text } = itemsToText([page], measure);
    expect(text).toBe('G       C\nAleluia, aleluia\n');
  });
});

describe('PDF real (pdf.js)', () => {
  it('lê um PDF de verdade e mantém os acordes nas sílabas', async () => {
    const { makePdf } = await import('./testPdf');
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const { docToItems } = await import('./pdfImport');
    const lyric = 'Santo, santo, santo é o Senhor';
    const x = (before: string) => 50 + helvWidth(lyric.slice(0, lyric.indexOf(before)), 12);
    const bytes = makePdf([
      [
        { text: 'Minha Musica', x: 50, y: 800, size: 20 },
        { text: 'Tom: G', x: 50, y: 770 },
        { text: 'G', x: x('Santo'), y: 714 },
        { text: 'D/F#', x: x('santo é'), y: 714 },
        { text: 'C7M(9)', x: x('Senhor'), y: 714 },
        { text: lyric, x: 50, y: 700 },
        // intro só de acordes, bem espaçada
        { text: 'G', x: 50, y: 660 },
        { text: 'D', x: 110, y: 660 },
      ],
    ]);
    const task = pdfjs.getDocument({ data: bytes });
    const r = itemsToText(await docToItems((await task.promise) as never), measure);
    await task.destroy();
    const [, chordLine, lyricLine, intro] = r.text.split('\n');
    expect(r.title).toBe('Minha Musica');
    expect(lyricLine).toBe(lyric);
    expect(chordLine.indexOf('G')).toBe(0);
    expect(lyricLine.slice(chordLine.indexOf('D/F#'))).toBe('santo é o Senhor');
    expect(lyricLine.slice(chordLine.indexOf('C7M(9)'))).toBe('Senhor');
    expect(intro).toMatch(/^G {4,}D$/); // espaçamento preservado
  });
});
