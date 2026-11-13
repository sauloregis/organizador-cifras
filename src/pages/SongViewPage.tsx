import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { payloadForSongs } from '../lib/share';
import { Stage } from '../components/Stage';
import { ShareDialog } from '../components/ShareDialog';
import { Icon } from '../components/Icon';

export function SongViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const song = useLiveQuery(() => db.songs.get(id!), [id]);
  const [toKey, setToKey] = useState<string>();
  const [sharing, setSharing] = useState(false);

  if (song === undefined) return null;
  if (song === null || !song) {
    return (
      <div className="empty-state">
        <p>Música não encontrada.</p>
        <button className="btn" onClick={() => navigate('/musicas')}>
          Voltar
        </button>
      </div>
    );
  }

  return (
    <>
      <Stage
        title={song.title}
        entries={[{ id: song.id, song, toKey }]}
        onBack={() => navigate('/musicas')}
        onKeyChange={(_, k) => setToKey(k)}
        actions={
          <>
            <button className="icon-btn" onClick={() => setSharing(true)} aria-label="Compartilhar">
              <Icon name="share" />
            </button>
            <button className="icon-btn" onClick={() => navigate(`/musicas/${song.id}/editar`)} aria-label="Editar">
              <Icon name="edit" />
            </button>
          </>
        }
      />
      {sharing && <ShareDialog title={song.title} payload={payloadForSongs([song])} onClose={() => setSharing(false)} />}
    </>
  );
}
