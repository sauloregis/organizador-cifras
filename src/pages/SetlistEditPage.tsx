import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteSetlist, newId, saveSetlist } from '../lib/db';
import { payloadForSetlist } from '../lib/share';
import { byTitle, normalizeSearch } from '../lib/util';
import type { Setlist, SetlistItem, SharePayload, Song } from '../lib/types';
import { PageHeader } from '../components/Layout';
import { KeyPicker } from '../components/KeyPicker';
import { ArrangementEditor } from '../components/ArrangementEditor';
import { ShareDialog } from '../components/ShareDialog';
import { Icon } from '../components/Icon';

const sameOrder = (a?: string[], b?: string[]) => !!a && !!b && a.length === b.length && a.every((x, i) => x === b[i]);

export function SetlistEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [missing, setMissing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [share, setShare] = useState<SharePayload | null>(null);
  const songs = useLiveQuery(() => db.songs.toArray(), []);
  const songMap = new Map((songs ?? []).map((s) => [s.id, s]));

  const pending = useRef<Setlist | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    db.setlists.get(id!).then((s) => (s ? setSetlist(s) : setMissing(true)));
  }, [id]);

  const flush = async () => {
    window.clearTimeout(timer.current);
    if (pending.current) {
      const s = pending.current;
      pending.current = null;
      await saveSetlist(s);
    }
  };
  useEffect(() => () => void flush(), []);

  const update = (fn: (s: Setlist) => Setlist) => {
    setSetlist((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      pending.current = next;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, 400);
      return next;
    });
  };

  const updateItem = (itemId: string, patch: Partial<SetlistItem>) =>
    update((s) => ({ ...s, items: s.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }));

  const moveItem = (index: number, d: number) =>
    update((s) => {
      const j = index + d;
      if (j < 0 || j >= s.items.length) return s;
      const items = [...s.items];
      [items[index], items[j]] = [items[j], items[index]];
      return { ...s, items };
    });

  const addSong = (song: Song) =>
    update((s) => ({ ...s, items: [...s.items, { id: newId(), songId: song.id }] }));

  if (missing) {
    return (
      <div className="empty-state">
        <p>Repertório não encontrado.</p>
        <button className="btn" onClick={() => navigate('/repertorios')}>
          Voltar
        </button>
      </div>
    );
  }
  if (!setlist) return null;

  const play = async () => {
    await flush();
    navigate(`/repertorios/${setlist.id}/tocar`);
  };

  const openShare = async () => {
    await flush();
    const fresh = await db.setlists.get(setlist.id);
    if (fresh) setShare(await payloadForSetlist(fresh));
  };

  const remove = async () => {
    if (!confirm(`Excluir o repertório “${setlist.name}”? As músicas continuam salvas.`)) return;
    window.clearTimeout(timer.current);
    pending.current = null;
    await deleteSetlist(setlist.id);
    navigate('/repertorios', { replace: true });
  };

  return (
    <>
      <PageHeader title="Repertório" back={() => navigate('/repertorios')}>
        <button className="icon-btn" onClick={openShare} aria-label="Compartilhar">
          <Icon name="share" />
        </button>
        <button className="btn primary sm" onClick={play} disabled={setlist.items.length === 0}>
          <Icon name="play" size={18} /> Tocar
        </button>
      </PageHeader>

      <div className="form">
        <div className="form-row">
          <label className="grow">
            Nome
            <input value={setlist.name} onChange={(e) => update((s) => ({ ...s, name: e.target.value }))} />
          </label>
          <label>
            Data
            <input type="date" value={setlist.date} onChange={(e) => update((s) => ({ ...s, date: e.target.value }))} />
          </label>
        </div>
        <label>
          Observações
          <textarea
            rows={2}
            value={setlist.notes ?? ''}
            placeholder="Opcional (ex.: ensaio sábado 16h)"
            onChange={(e) => update((s) => ({ ...s, notes: e.target.value || undefined }))}
          />
        </label>
      </div>

      <h3>Músicas ({setlist.items.length})</h3>
      <ol className="items">
        {setlist.items.map((item, index) => {
          const song = songMap.get(item.songId);
          const open = openItem === item.id;
          return (
            <li key={item.id} className="item-card">
              <div className="item-top">
                <span className="num">{index + 1}</span>
                <div className="grow">
                  <div className="row-title">{song?.title ?? 'Música não encontrada'}</div>
                  {song?.artist && <div className="muted small">{song.artist}</div>}
                </div>
                <button className="icon-btn sm" onClick={() => moveItem(index, -1)} disabled={index === 0} aria-label="Subir">
                  <Icon name="up" size={18} />
                </button>
                <button
                  className="icon-btn sm"
                  onClick={() => moveItem(index, 1)}
                  disabled={index === setlist.items.length - 1}
                  aria-label="Descer"
                >
                  <Icon name="down" size={18} />
                </button>
                <button
                  className="icon-btn sm"
                  onClick={() => update((s) => ({ ...s, items: s.items.filter((i) => i.id !== item.id) }))}
                  aria-label="Remover do repertório"
                >
                  <Icon name="close" size={18} />
                </button>
              </div>
              {song && (
                <div className="item-controls">
                  {song.key && (
                    <KeyPicker
                      compact
                      originalKey={song.key}
                      value={item.key}
                      onChange={(k) => updateItem(item.id, { key: k === song.key ? undefined : k })}
                    />
                  )}
                  <button className={`btn sm${open ? ' on' : ''}`} onClick={() => setOpenItem(open ? null : item.id)}>
                    Ordem: {item.arrangement ? 'personalizada' : 'padrão'}
                    <Icon name={open ? 'up' : 'down'} size={16} />
                  </button>
                </div>
              )}
              {song && open && (
                <div className="item-expand">
                  <ArrangementEditor
                    sections={song.sections}
                    value={item.arrangement ?? song.arrangement}
                    onChange={(ids) =>
                      updateItem(item.id, { arrangement: sameOrder(ids, song.arrangement) ? undefined : ids })
                    }
                    defaultOrder={song.arrangement}
                    resetLabel="Voltar para a ordem padrão da música"
                  />
                  <label>
                    Observação para o grupo
                    <input
                      value={item.notes ?? ''}
                      placeholder="Ex.: começar só voz e violão"
                      onChange={(e) => updateItem(item.id, { notes: e.target.value || undefined })}
                    />
                  </label>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <button className="btn block" onClick={() => setPicking(true)}>
        <Icon name="plus" /> Adicionar músicas
      </button>

      <button className="btn danger" style={{ marginTop: 32 }} onClick={remove}>
        <Icon name="trash" size={18} /> Excluir repertório
      </button>

      {picking && (
        <SongPicker
          songs={songs ?? []}
          countIn={(sid) => setlist.items.filter((i) => i.songId === sid).length}
          onPick={addSong}
          onClose={() => setPicking(false)}
          onNew={async () => {
            await flush();
            navigate('/musicas/nova');
          }}
        />
      )}
      {share && <ShareDialog title={setlist.name} payload={share} onClose={() => setShare(null)} />}
    </>
  );
}

function SongPicker({
  songs,
  countIn,
  onPick,
  onClose,
  onNew,
}: {
  songs: Song[];
  countIn: (id: string) => number;
  onPick: (s: Song) => void;
  onClose: () => void;
  onNew: () => void;
}) {
  const [q, setQ] = useState('');
  const term = normalizeSearch(q.trim());
  const list = songs
    .filter((s) => !term || normalizeSearch(`${s.title} ${s.artist ?? ''}`).includes(term))
    .sort(byTitle);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog tall" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h2>Adicionar músicas</h2>
          <button className="btn primary sm" onClick={onClose}>
            Concluir
          </button>
        </div>
        <input
          className="search"
          type="search"
          autoFocus
          placeholder="Buscar"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <ul className="list picker">
          {list.map((s) => {
            const n = countIn(s.id);
            return (
              <li key={s.id}>
                <button className="list-row" onClick={() => onPick(s)}>
                  <div className="grow">
                    <div className="row-title">{s.title}</div>
                    {s.artist && <div className="muted small">{s.artist}</div>}
                  </div>
                  {n > 0 && <span className="pill accent">✓{n > 1 ? ` ${n}×` : ''}</span>}
                  <Icon name="plus" size={18} />
                </button>
              </li>
            );
          })}
          {list.length === 0 && <li className="muted small">Nenhuma música encontrada.</li>}
        </ul>
        <button className="btn ghost sm" onClick={onNew}>
          <Icon name="plus" size={16} /> Cadastrar música nova
        </button>
      </div>
    </div>
  );
}
