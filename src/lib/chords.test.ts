import { describe, expect, it } from 'vitest';
import {
  buildSegments,
  chordTokens,
  isChord,
  parseLines,
  semitonesBetween,
  shiftKey,
  tokensToString,
  transposeChord,
  transposeTokens,
  prefersFlats,
} from './chords';
import { parseSongText, songToText, resolveArrangement } from './songText';

describe('isChord', () => {
  it.each(['G', 'Am', 'C7M', 'F#m7(b5)', 'Bb7M(9)', 'E7(4/9)', 'G/B', 'D4', 'Asus4', 'Cº', 'Cmaj7', 'Dm7/C', 'C/9', '(G)', 'Am)'])(
    'reconhece %s',
    (c) => expect(isChord(c)).toBe(true),
  );
  it.each(['Senhor', 'Eu', 'Amor', 'Deus', 'de', 'H', 'Gloria'])('rejeita %s', (c) => expect(isChord(c)).toBe(false));
});

describe('linhas', () => {
  it('detecta linha de cifra com símbolos extras', () => {
    expect(chordTokens('| G   D/F#  | Em  C |  (2x)')).not.toBeNull();
    expect(chordTokens('Em tua presença')).toBeNull();
    expect(chordTokens('A minha alma')).toBeNull();
  });

  it('agrupa cifra + letra em pares', () => {
    const lines = parseLines('G       D\nSanto, santo\n\nEm  C\n');
    expect(lines[0].kind).toBe('pair');
    expect(lines[1].kind).toBe('empty');
    expect(lines[2].kind).toBe('chords');
  });

  it('reconhece tablatura', () => {
    expect(parseLines('e|-----3---|')[0].kind).toBe('tab');
  });
});

describe('transposição', () => {
  it('transpõe raiz, sufixo e baixo', () => {
    expect(transposeChord('G/B', 2, false)).toBe('A/C#');
    expect(transposeChord('F#m7(b5)', 1, false)).toBe('Gm7(b5)');
    expect(transposeChord('E7(4/9)', -2, true)).toBe('D7(4/9)');
    expect(transposeChord('C', 3, true)).toBe('Eb');
    expect(transposeChord('(Am)', 2, false)).toBe('(Bm)');
  });

  it('calcula semitons e tons', () => {
    expect(semitonesBetween('G', 'A')).toBe(2);
    expect(semitonesBetween('A', 'G')).toBe(10);
    expect(shiftKey('G', 1)).toBe('Ab');
    expect(shiftKey('Em', -1)).toBe('Ebm');
    expect(prefersFlats('F')).toBe(true);
    expect(prefersFlats('Dm')).toBe(true);
    expect(prefersFlats('E')).toBe(false);
  });

  it('mantém colunas ao reconstruir a linha', () => {
    const tokens = chordTokens('G     D/F#  Em')!;
    expect(tokensToString(transposeTokens(tokens, 2, false))).toBe('A     E/G#  F#m');
    // acorde que cresce empurra o próximo, sempre com um espaço
    expect(tokensToString(transposeTokens(chordTokens('C D')!, 1, false))).toBe('C# D#');
  });
});

describe('buildSegments', () => {
  it('ancora acordes na letra e não quebra palavras', () => {
    const tokens = chordTokens('G       D')!;
    const segs = buildSegments(tokens, 'Santo, santo');
    const words = segs.filter((s) => s.type === 'word');
    expect(words[0]).toEqual({ type: 'word', parts: [{ chord: 'G', text: 'Santo,' }] });
    // "santo" começa na coluna 7, D está na coluna 8 => palavra dividida em 2 partes
    expect(words[1]).toEqual({ type: 'word', parts: [{ text: 's' }, { chord: 'D', text: 'anto' }] });
  });

  it('acorde no espaço antes da palavra é ancorado nela', () => {
    //                            col 19 = espaço antes de "teste"
    const segs = buildSegments(chordTokens('                   B/D#')!, '  Primeira linha de teste');
    const last = segs[segs.length - 1];
    expect(last).toEqual({ type: 'word', parts: [{ chord: 'B/D#', text: 'teste' }] });
  });

  it('acorde depois do fim da letra continua visível', () => {
    const segs = buildSegments(chordTokens('G          C')!, 'Amém');
    const last = segs[segs.length - 1];
    expect(last).toEqual({ type: 'word', parts: [{ chord: 'C', text: '' }] });
  });
});

describe('parseSongText', () => {
  const text = `Tom: G
BPM: 72

[Intro] G  D  Em  C

[Primeira Parte]
G         D
Linha um da estrofe

[Refrão]
C        G
Linha do refrão

[Primeira Parte]

[Refrão]
C        G
Linha do refrão
`;

  it('extrai metadados, seções e repetições', () => {
    const parsed = parseSongText(text);
    expect(parsed.key).toBe('G');
    expect(parsed.bpm).toBe(72);
    expect(parsed.sections.map((s) => s.label)).toEqual(['Intro', 'Primeira Parte', 'Refrão']);
    expect(parsed.sections.map((s) => s.type)).toEqual(['intro', 'verse', 'chorus']);
    expect(parsed.order).toEqual(['intro', 'primeira-parte', 'refrao', 'primeira-parte', 'refrao']);
    expect(parsed.sections[0].content).toBe('G  D  Em  C');
  });

  it('mesmo nome com conteúdo diferente vira uma nova seção', () => {
    const parsed = parseSongText('[Refrão]\nC\nUm\n\n[Refrão]\nD\nDois');
    expect(parsed.sections.map((s) => s.label)).toEqual(['Refrão', 'Refrão (2)']);
  });

  it('mantém ids existentes e faz ida e volta', () => {
    const first = parseSongText(text);
    const song = { sections: first.sections.map((s) => ({ ...s, id: 'x-' + s.id })), arrangement: [] as string[] };
    song.arrangement = first.order.map((id) => 'x-' + id);
    const again = parseSongText(songToText(song), song.sections);
    expect(again.sections.map((s) => s.id)).toEqual(song.sections.map((s) => s.id));
    expect(again.sections.map((s) => s.content)).toEqual(song.sections.map((s) => s.content));
  });

  it('usa as linhas soltas do topo como nome e artista', () => {
    const p = parseSongText('Nome da Música\nArtista X\n\nTom: D\n\n[Intro] D A\n\n[Refrão]\nD\nLetra');
    expect(p.titleGuess).toBe('Nome da Música');
    expect(p.artistGuess).toBe('Artista X');
    expect(p.sections.map((s) => s.label)).toEqual(['Intro', 'Refrão']);
    expect(p.key).toBe('D');
  });

  it('texto sem seções vira uma parte "Letra"', () => {
    const p = parseSongText('G\nUma linha\nC\nOutra');
    expect(p.sections.map((s) => s.label)).toEqual(['Letra']);
  });

  it('sugere o tom pelo primeiro acorde quando não informado', () => {
    expect(parseSongText('[Intro]\nEm  C  G  D').key).toBe('Em');
  });

  it('resolve arranjo ignorando ids inválidos', () => {
    const p = parseSongText(text);
    const song = { id: 's', title: 't', key: 'G', sections: p.sections, arrangement: p.order, createdAt: 0, updatedAt: 0 };
    expect(resolveArrangement(song, ['refrao', 'nao-existe', 'intro']).map((s) => s.id)).toEqual(['refrao', 'intro']);
    expect(resolveArrangement(song).length).toBe(5);
  });
});
