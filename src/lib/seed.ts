import { db, newId } from './db';
import { parseSongText } from './songText';

const EXAMPLE = `Tom: G
BPM: 76

[Intro] G  D  Em  C

[Primeira Parte]
G                D
Esta é uma música de exemplo
Em                C
para mostrar como o app funciona
G                  D
toque no seletor de tom para transpor
Em          C       D
e no play para rolar

[Refrão]
C            G
Cante só a letra
D           Em
ou toque a cifra
C          G           D
tudo no mesmo lugar

[Ponte]
Am            Em
Mude a ordem das partes
C              D
no repertório do domingo

[Primeira Parte]

[Refrão]

[Final] C  D  G
`;

const FLAG = 'cifras-louvor:seeded';

/** Na primeira abertura, cria uma música de exemplo para a pessoa experimentar. */
export async function seedIfFirstRun() {
  try {
    if (localStorage.getItem(FLAG)) return;
    localStorage.setItem(FLAG, '1');
  } catch {
    return;
  }
  if ((await db.songs.count()) > 0) return;
  const parsed = parseSongText(EXAMPLE);
  const now = Date.now();
  await db.songs.put({
    id: newId(),
    title: 'Música de exemplo',
    artist: 'Cifras Louvor',
    key: parsed.key ?? 'G',
    bpm: parsed.bpm,
    beatsPerBar: 4,
    sections: parsed.sections,
    arrangement: parsed.order,
    createdAt: now,
    updatedAt: now,
  });
}
