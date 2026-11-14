import { useRef, useState } from 'react';
import { readPdf } from '../lib/pdfImport';
import type { ImportState } from './SongEditPage';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { byTitle, normalizeSearch } from '../lib/util';
import { PageHeader } from '../components/Layout';
import { Icon } from '../components/Icon';

export function SongsPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const pdfInput = useRef<HTMLInputElement>(null);

  const onPdf = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await readPdf(file);
      if (!r.text.trim()) {
        alert('Não encontrei texto neste PDF. Se ele for uma foto ou digitalização, não dá para ler as cifras.');
        return;
      }
      const state: ImportState = { importText: r.text, title: r.title, artist: r.artist };
      navigate('/musicas/nova', { state });
    } catch (e) {
      alert('Não consegui ler este PDF: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const songs = useLiveQuery(() => db.songs.toArray(), []);
  const term = normalizeSearch(q.trim());
  const list = (songs ?? [])
    .filter((s) => !term || normalizeSearch(`${s.title} ${s.artist ?? ''}`).includes(term))
    .sort(byTitle);

  return (
    <>
      <PageHeader title="Músicas">
        <button className="btn sm" onClick={() => pdfInput.current?.click()} disabled={busy}>
          <Icon name="pdf" size={18} /> {busy ? 'Lendo…' : 'PDF'}
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
        <button className="btn primary sm" onClick={() => navigate('/musicas/nova')}>
          <Icon name="plus" size={18} /> Nova
        </button>
      </PageHeader>
      <input
        className="search"
        type="search"
        placeholder="Buscar por nome ou artista"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {songs && songs.length === 0 && (
        <div className="empty-state">
          <p>Nenhuma música ainda.</p>
          <p className="muted small">
            Toque em <b>Nova</b> e cole a cifra (por exemplo, copiada do Cifra Club), ou em <b>PDF</b> para importar um arquivo.
          </p>
        </div>
      )}
      <ul className="list">
        {list.map((s) => (
          <li key={s.id}>
            <Link to={`/musicas/${s.id}`} className="list-row">
              <div className="grow">
                <div className="row-title">{s.title}</div>
                {s.artist && <div className="muted small">{s.artist}</div>}
              </div>
              {s.key && <span className="pill">{s.key}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
