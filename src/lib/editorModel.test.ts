import { describe, expect, it } from 'vitest';
import { contentToLines, defaultLabel, linesToContent, normalizeChords } from './editorModel';

describe('editorModel', () => {
  it('texto → linhas → texto preserva a cifra', () => {
    const content = 'G  D  Em  C\n\nG         D/F#\nLinha um da estrofe\n          Em7\nsó um acorde\nLinha sem acorde\ne|---3---|';
    expect(linesToContent(contentToLines(content))).toBe(content);
  });

  it('mover acorde muda a coluna e mantém a letra', () => {
    const lines = contentToLines('G       D\nSanto, santo');
    const moved = lines.map((l) => ({ ...l, chords: l.chords.map((c) => (c.text === 'D' ? { ...c, col: 7 } : c)) }));
    expect(linesToContent(moved)).toBe('G      D\nSanto, santo');
  });

  it('acordes sobrepostos são afastados', () => {
    const r = normalizeChords([
      { id: 'a', col: 0, text: 'Am7' },
      { id: 'b', col: 2, text: 'D' },
    ]);
    expect(r.map((c) => c.col)).toEqual([0, 4]);
  });

  it('nomes padrão não se repetem', () => {
    expect(defaultLabel('verse', ['Primeira Parte'])).toBe('Segunda Parte');
    expect(defaultLabel('chorus', ['Refrão'])).toBe('Refrão 2');
    expect(defaultLabel('bridge', [])).toBe('Ponte');
  });
});
