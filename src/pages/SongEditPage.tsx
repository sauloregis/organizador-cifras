import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, deleteSong, newId, saveSong } from '../lib/db';
import { parseSongText, songToText } from '../lib/songText';
import { MAJOR_KEYS, MINOR_KEYS } from '../lib/chords';
import { useTapTempo } from '../lib/hooks';
import { usePrefs } from '../lib/prefs';
import type { Song } from '../lib/types';
import { PageHeader } from '../components/Layout';
import { ArrangementEditor } from '../components/ArrangementEditor';
import { SongBody } from '../components/SongBody';
import { Icon } from '../components/Icon';

const PLACEHOLDER = `Cole aqui a cifra. Exemplo:

Tom: G

[Intro] G  D  Em  C

[Primeira Parte]
G              D
Escreva a letra aqui
Em             C
com os acordes em cima

[Refrão]
C       G       D
Linha do refrão

[Primeira Parte]

[Refrão]`;

export function SongEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const prefs = usePrefs();
  const [original, setOriginal] = useState<Song | null>(null);
  const [loaded, setLoaded] = useState(!id);

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [key, setKey] = useState('');
  const [bpm, setBpm] = useState('');
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [notes, setNotes] = useState('');
  const [text, setText] = useState('');
  const [arrangement, setArrangement] = useState<string[] | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');

  useEffect(() => {
    if (!id) return;
    db.songs.get(id).then((s) => {
      if (s) {
        setOriginal(s);
        setTitle(s.title);
        setArtist(s.artist ?? '');
        setKey(s.key);
        setBpm(s.bpm ? String(s.bpm) : '');
        setBeatsPerBar(s.beatsPerBar ?? 4);
        setNotes(s.notes ?? '');
        setText(songToText(s));
        setArrangement(s.arrangement);
        setSeen(new Set(s.sections.map((x) => x.id)));
      }
      setLoaded(true);
    });
  }, [id]);

  const parsed = useMemo(() => parseSongText(text, original?.sections ?? []), [text, original]);

  const effectiveArrangement = useMemo(() => {
    if (arrangement === null) return parsed.order;
    const ids = new Set(parsed.sections.map((s) => s.id));
    const kept = arrangement.filter((x) => ids.has(x));
    const added = parsed.sections.filter((s) => !seen.has(s.id)).map((s) => s.id);
    return [...kept, ...added];
  }, [arrangement, parsed, seen]);

  const effectiveKey = key || parsed.key || '';
  const effectiveBpm = parseInt(bpm, 10) || parsed.bpm || undefined;

  const onArrangementChange = (ids: string[]) => {
    setArrangement(ids);
    setSeen(new Set(parsed.sections.map((s) => s.id)));
  };

  const tap = useTapTempo((b) => setBpm(String(b)));

  const draft: Song = {
    id: original?.id ?? newId(),
    title: title.trim() || 'Sem título',
    artist: artist.trim() || undefined,
    key: effectiveKey,
    bpm: effectiveBpm,
    beatsPerBar,
    notes: notes.trim() || undefined,
    sections: parsed.sections,
    arrangement: effectiveArrangement,
    createdAt: original?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  };

  const save = async () => {
    if (!title.trim()) {
      alert('Dê um nome para a música.');
      return;
    }
    if (parsed.sections.length === 0) {
      alert('Cole a cifra ou a letra da música.');
      return;
    }
    await saveSong(draft);
    navigate(`/musicas/${draft.id}`, { replace: true });
  };

  const remove = async () => {
    if (!original) return;
    const used = (await db.setlists.toArray()).filter((sl) => sl.items.some((i) => i.songId === original.id));
    const warn = used.length ? `\n\nEla está em ${used.length} repertório(s) e será removida deles.` : '';
    if (!confirm(`Excluir “${original.title}” deste aparelho?${warn}`)) return;
    await db.transaction('rw', db.songs, db.setlists, async () => {
      for (const sl of used) {
        await db.setlists.put({
          ...sl,
          items: sl.items.filter((i) => i.songId !== original.id),
          updatedAt: Date.now(),
        });
      }
      await deleteSong(original.id);
    });
    navigate('/musicas', { replace: true });
  };

  if (!loaded) return null;
  const keyOptions = effectiveKey.endsWith('m') ? MINOR_KEYS : MAJOR_KEYS;

  return (
    <>
      <PageHeader title={original ? 'Editar música' : 'Nova música'} back={() => navigate(-1)}>
        <button className="btn primary sm" onClick={save}>
          <Icon name="check" size={18} /> Salvar
        </button>
      </PageHeader>

      <div className="form">
        <label>
          Nome
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome da música" />
        </label>
        <label>
          Artista / ministério
          <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Opcional" />
        </label>
        <div className="form-row">
          <label>
            Tom original
            <select value={effectiveKey} onChange={(e) => setKey(e.target.value)}>
              <option value="">—</option>
              {[...MAJOR_KEYS, ...MINOR_KEYS].map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
              {effectiveKey && !keyOptions.includes(effectiveKey) && <option value={effectiveKey}>{effectiveKey}</option>}
            </select>
          </label>
          <label>
            BPM
            <div className="inline">
              <input
                type="number"
                inputMode="numeric"
                min={30}
                max={250}
                value={bpm || (parsed.bpm ? String(parsed.bpm) : '')}
                onChange={(e) => setBpm(e.target.value)}
                placeholder="ex.: 72"
              />
              <button type="button" className="btn sm" onClick={tap} title="Toque no ritmo da música">
                <Icon name="tap" size={18} /> Tap
              </button>
            </div>
          </label>
          <label>
            Compasso
            <select value={beatsPerBar} onChange={(e) => setBeatsPerBar(Number(e.target.value))}>
              <option value={4}>4/4</option>
              <option value={3}>3/4</option>
              <option value={6}>6/8</option>
              <option value={2}>2/4</option>
            </select>
          </label>
        </div>
        <p className="muted small">
          O BPM é usado para calcular a velocidade da rolagem automática. Não sabe? Toque no botão <b>Tap</b> no ritmo da
          música (pelo menos 4 vezes).
        </p>

        <div className="tabs">
          <button className={tab === 'edit' ? 'on' : ''} onClick={() => setTab('edit')}>
            Cifra
          </button>
          <button className={tab === 'preview' ? 'on' : ''} onClick={() => setTab('preview')}>
            Pré-visualizar
          </button>
        </div>

        {tab === 'edit' ? (
          <>
            <textarea
              className="mono song-text"
              value={text}
              onChange={(e) => {
                const value = e.target.value;
                setText(value);
                // ao colar do site, aproveita o nome e o artista que vêm no topo
                if (!title.trim() || !artist.trim()) {
                  const guess = parseSongText(value);
                  if (!title.trim() && guess.titleGuess) setTitle(guess.titleGuess);
                  if (!artist.trim() && guess.artistGuess) setArtist(guess.artistGuess);
                }
              }}
              placeholder={PLACEHOLDER}
              wrap="off"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              rows={18}
            />
            <details className="help">
              <summary>Como escrever a cifra</summary>
              <ul>
                <li>
                  Acordes na linha de <b>cima</b>, letra na linha de <b>baixo</b> (igual ao Cifra Club). Pode colar direto.
                </li>
                <li>
                  Cada parte começa com o nome entre colchetes: <code>[Intro]</code>, <code>[Primeira Parte]</code>,{' '}
                  <code>[Refrão]</code>, <code>[Ponte]</code>, <code>[Final]</code>...
                </li>
                <li>
                  Para repetir uma parte, escreva só o nome dela de novo, sem conteúdo: <code>[Refrão]</code>.
                </li>
                <li>
                  Linhas <code>Tom: G</code> e <code>BPM: 72</code> no começo preenchem os campos sozinhas.
                </li>
                <li>Use uma fonte de largura fixa (como aqui) para alinhar os acordes em cima das sílabas.</li>
              </ul>
            </details>
          </>
        ) : (
          <div className="preview" style={{ ['--fs' as string]: `${prefs.fontSize}px` }}>
            <SongBody song={draft} showChords showLabels />
          </div>
        )}

        {parsed.sections.length > 0 && (
          <>
            <h3>Ordem das partes</h3>
            <p className="muted small">
              Esta é a ordem padrão. Em cada repertório você ainda pode mudar a ordem só para aquele dia.
            </p>
            <ArrangementEditor
              sections={parsed.sections}
              value={effectiveArrangement}
              onChange={onArrangementChange}
              defaultOrder={parsed.order}
              resetLabel="Usar a ordem do texto"
            />
          </>
        )}

        <label>
          Observações
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Opcional" />
        </label>

        {original && (
          <button className="btn danger" onClick={remove}>
            <Icon name="trash" size={18} /> Excluir música
          </button>
        )}
      </div>
    </>
  );
}
