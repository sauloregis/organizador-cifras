import { describe, expect, it } from 'vitest';
import { autoSection } from './autoSection';
import { parseSongText } from './songText';

const SONG = `Tom: G

Nome da Música
Fulano de Tal

G  D  Em  C

G              D
Primeira estrofe linha um
Em             C
primeira estrofe linha dois

Am           D
Antes do refrão chega

C        G
Este é o refrão da música
D        Em
cantamos juntos o refrão

G              D
Segunda estrofe diferente
Em             C
com outra letra aqui

Am           D
Antes do refrão chega

C        G
Este é o refrão da música
D        Em
cantamos juntos o refrão (2x)

Am            F
Uma ponte que só aparece
C             G
uma vez no final

C        G
Este é o refrão da música
D        Em
cantamos juntos o refrão

C  D  G
`;

describe('autoSection', () => {
  it('separa e classifica as partes', () => {
    const text = autoSection(SONG);
    const parsed = parseSongText(text);
    expect(parsed.key).toBe('G');
    expect(parsed.titleGuess).toBe('Nome da Música');
    expect(parsed.sections.map((s) => `${s.label}:${s.type}`)).toEqual([
      'Intro:intro',
      'Primeira Parte:verse',
      'Pré-Refrão:prechorus',
      'Refrão:chorus',
      'Segunda Parte:verse',
      'Refrão (2):chorus',
      'Ponte:bridge',
      'Final:outro',
    ]);
    // refrões idênticos viram repetição da mesma parte
    const labels = parsed.order.map((id) => parsed.sections.find((s) => s.id === id)!.label);
    expect(labels).toEqual([
      'Intro',
      'Primeira Parte',
      'Pré-Refrão',
      'Refrão',
      'Segunda Parte',
      'Pré-Refrão',
      'Refrão (2)',
      'Ponte',
      'Refrão',
      'Final',
    ]);
  });

  it('não mexe em texto que já tem marcações', () => {
    const t = '[Refrão]\nC\nLetra\n';
    expect(autoSection(t)).toBe(t);
  });

  it('música sem refrão repetido vira só partes numeradas', () => {
    const text = autoSection('C\nUm\n\nG\nDois\n\nD\nTrês\n');
    expect(parseSongText(text).sections.map((s) => s.label)).toEqual(['Primeira Parte', 'Segunda Parte', 'Terceira Parte']);
  });
});
