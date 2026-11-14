import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { db, deleteSong, newId, saveSong } from '../lib/db';
import { parseSongText, songToText, type ParsedSongText } from '../lib/songText';
import { autoSection, hasSectionHeaders } from '../lib/autoSection';
import { isEmptySection, linesToContent, modelToSections, sectionsToModel, type ESection } from '../lib/editorModel';
import { readPdf } from '../lib/pdfImport';
import { MAJOR_KEYS, MINOR_KEYS } from '../lib/chords';
import { useTapTempo } from '../lib/hooks';
import { usePrefs } from '../lib/prefs';
import type { Song } from '../lib/types';
import { PageHeader } from '../components/Layout';
import { ArrangementEditor } from '../components/ArrangementEditor';
import { SectionsEditor, type StructureOp } from '../components/SectionsEditor';
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

[Refrão]

Sem os [nomes das partes]? Sem problema: o app separa e classifica sozinho.`;

export interface ImportState {
  importText?: string;
  title?: string;
  artist?: string;
}

type Mode = 'visual' | 'text' | 'preview';

export function SongEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const prefs = usePrefs();
  const pdfInput = useRef<HTMLInputElement>(null);
  const [original, setOriginal] = useState<Song | null>(null);
  const [loaded, setLoaded] = useState(!id);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [key, setKey] = useState('');
  const [bpm, setBpm] = useState('');
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [notes, setNotes] = useState('');

  const [mode, setMode] = useState<Mode>(id ? 'visual' : 'text');
  const [model, setModel] = useState<ESection[]>([]);
  const [text, setText] = useState('');
  const [arrangement, setArrangement] = useState<string[]>([]);
  const [textOrder, setTextOrder] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!id) {
      const st = location.state as ImportState | null;
      if (st?.importText) applyImport(st.importText, st.title, st.artist);
      return;
    }
    db.songs.get(id).then((s) => {
      if (s) {
        setOriginal(s);
        setTitle(s.title);
        setArtist(s.artist ?? '');
        setKey(s.key);
        setBpm(s.bpm ? String(s.bpm) : '');
        setBeatsPerBar(s.beatsPerBar ?? 4);
        setNotes(s.notes ?? '');
        setModel(sectionsToModel(s.sections));
        setArrangement(s.arrangement);
        setTextOrder(s.arrangement);
        setTouched(true);
        seen.current = new Set(s.sections.map((x) => x.id));
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /** Aplica o resultado da leitura do texto ao modelo, à ordem e aos campos vazios. */
  const applyParsed = (parsed: ParsedSongText, opts: { resetOrder?: boolean; title?: string; artist?: string } = {}) => {
    const next = sectionsToModel(parsed.sections);
    setModel(next);
    setTextOrder(parsed.order);
    const ids = new Set(next.map((s) => s.id));
    setArrangement((prev) => {
      if (!touched || opts.resetOrder) return parsed.order;
      const kept = prev.filter((x) => ids.has(x));
      return [...kept, ...next.filter((s) => !seen.current.has(s.id)).map((s) => s.id)];
    });
    if (opts.resetOrder) setTouched(false);
    seen.current = ids;
    if (!key && parsed.key) setKey(parsed.key);
    if (!bpm && parsed.bpm) setBpm(String(parsed.bpm));
    const t = opts.title || parsed.titleGuess;
    const a = opts.artist || parsed.artistGuess;
    if (!title.trim() && t) setTitle(t);
    if (!artist.trim() && a) setArtist(a);
  };

  const applyImport = (raw: string, t?: string, a?: string) => {
    const withSections = hasSectionHeaders(raw) ? raw : autoSection(raw, t || title);
    setText(withSections);
    applyParsed(parseSongText(withSections), { resetOrder: true, title: t, artist: a });
    setMode('visual');
  };

  const onTextChange = (value: string) => {
    let source = value;
    // colou uma cifra inteira sem marcações: separa as partes automaticamente
    if (!text.trim() && value.trim().length > 40 && !hasSectionHeaders(value)) source = autoSection(value, title);
    setText(source);
    applyParsed(parseSongText(source, modelToSections(model)));
  };

  const switchMode = (m: Mode) => {
    if (m === 'text' && mode !== 'text') setText(songToText({ sections: modelToSections(model), arrangement }));
    setMode(m);
  };

  const onVisualChange = (next: ESection[], op?: StructureOp) => {
    setModel(next);
    const ids = new Set(next.map((s) => s.id));
    setArrangement((prev) => {
      let arr = prev;
      if (op?.kind === 'split') arr = arr.flatMap((x) => (x === op.from ? [x, op.created] : [x]));
      if (op?.kind === 'add') arr = [...arr, op.id];
      return arr.filter((x) => ids.has(x));
    });
    seen.current = ids;
  };

  const autoSplit = () => {
    const raw = model.map((s) => linesToContent(s.lines)).join('\n\n');
    const t = autoSection(raw, title);
    setText(t);
    applyParsed(parseSongText(t), { resetOrder: true });
  };

  const onPdf = async (file: File | undefined) => {
    if (!file) return;
    if (model.some((s) => !isEmptySection(s)) && !confirm('Substituir a cifra atual pelo conteúdo do PDF?')) return;
    setBusy(true);
    try {
      const r = await readPdf(file);
      if (!r.text.trim()) {
        alert('Não encontrei texto neste PDF. Se ele for uma foto ou digitalização, não dá para ler as cifras.');
        return;
      }
      applyImport(r.text, r.title, r.artist);
    } catch (e) {
      alert('Não consegui ler este PDF: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const tap = useTapTempo((b) => setBpm(String(b)));

  const sections = modelToSections(model.filter((s) => !isEmptySection(s)));
  const validIds = new Set(sections.map((s) => s.id));
  const draft: Song = {
    id: original?.id ?? newId(),
    title: title.trim() || 'Sem título',
    artist: artist.trim() || undefined,
    key,
    bpm: parseInt(bpm, 10) || undefined,
    beatsPerBar,
    notes: notes.trim() || undefined,
    sections,
    arrangement: arrangement.filter((x) => validIds.has(x)),
    createdAt: original?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  };

  const save = async () => {
    if (!title.trim()) {
      alert('Dê um nome para a música.');
      return;
    }
    if (sections.length === 0) {
      alert('Cole a cifra, importe um PDF ou escreva a letra da música.');
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
        await db.setlists.put({ ...sl, items: sl.items.filter((i) => i.songId !== original.id), updatedAt: Date.now() });
      }
      await deleteSong(original.id);
    });
    navigate('/musicas', { replace: true });
  };

  if (!loaded) return null;
  const keyOptions = key.endsWith('m') ? MINOR_KEYS : MAJOR_KEYS;
  const canAutoSplit = model.length <= 1 && model.some((s) => s.lines.some((l) => l.kind === 'empty'));

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
            <select value={key} onChange={(e) => setKey(e.target.value)}>
              <option value="">—</option>
              {[...MAJOR_KEYS, ...MINOR_KEYS].map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
              {key && !keyOptions.includes(key) && <option value={key}>{key}</option>}
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
                value={bpm}
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

        <div className="editor-bar">
          <div className="tabs">
            <button className={mode === 'visual' ? 'on' : ''} onClick={() => switchMode('visual')}>
              Visual
            </button>
            <button className={mode === 'text' ? 'on' : ''} onClick={() => switchMode('text')}>
              Texto
            </button>
            <button className={mode === 'preview' ? 'on' : ''} onClick={() => switchMode('preview')}>
              Ver
            </button>
          </div>
          <button type="button" className="btn sm" onClick={() => pdfInput.current?.click()} disabled={busy}>
            <Icon name="pdf" size={18} /> {busy ? 'Lendo…' : 'Importar PDF'}
          </button>
          <input
            ref={pdfInput}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={(e) => {
              onPdf(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>

        {canAutoSplit && (
          <button type="button" className="btn block" onClick={autoSplit}>
            <Icon name="wand" /> Separar e classificar as partes automaticamente
          </button>
        )}

        {mode === 'visual' &&
          (model.length ? (
            <SectionsEditor model={model} onChange={onVisualChange} />
          ) : (
            <div className="empty-state">
              <p>Ainda não há cifra.</p>
              <p className="muted small">
                Toque em <b>Importar PDF</b> ou vá na aba <b>Texto</b> e cole a cifra.
              </p>
            </div>
          ))}

        {mode === 'text' && (
          <>
            <textarea
              className="mono song-text"
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
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
                  <code>[Refrão]</code>, <code>[Ponte]</code>, <code>[Final]</code>... Sem nomes, o app separa pelas linhas em
                  branco e classifica sozinho.
                </li>
                <li>
                  Para repetir uma parte, escreva só o nome dela de novo, sem conteúdo: <code>[Refrão]</code>.
                </li>
                <li>
                  Linhas <code>Tom: G</code> e <code>BPM: 72</code> no começo preenchem os campos sozinhas.
                </li>
                <li>Depois, ajuste tudo arrastando na aba Visual.</li>
              </ul>
            </details>
          </>
        )}

        {mode === 'preview' && (
          <div className="preview" style={{ ['--fs' as string]: `${prefs.fontSize}px` }}>
            <SongBody song={draft} showChords showLabels />
          </div>
        )}

        {sections.length > 0 && (
          <>
            <h3>Ordem das partes</h3>
            <p className="muted small">
              Arraste pela alça para mudar a ordem. Esta é a ordem padrão; em cada repertório você ainda pode mudar só para
              aquele dia.
            </p>
            <ArrangementEditor
              sections={sections}
              value={draft.arrangement}
              onChange={(ids) => {
                setArrangement(ids);
                setTouched(true);
              }}
              defaultOrder={textOrder.filter((x) => validIds.has(x)).length ? textOrder.filter((x) => validIds.has(x)) : sections.map((s) => s.id)}
              resetLabel="Restaurar a ordem original"
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
