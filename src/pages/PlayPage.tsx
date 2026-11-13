import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, saveSetlist } from '../lib/db';
import type { Song } from '../lib/types';
import { Stage, type StageEntry } from '../components/Stage';
import { Icon } from '../components/Icon';

export function PlayPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const data = useLiveQuery(async () => {
    const setlist = await db.setlists.get(id!);
    if (!setlist) return null;
    const songs = await db.songs.bulkGet(setlist.items.map((i) => i.songId));
    return { setlist, songs };
  }, [id]);

  if (data === undefined) return null;
  if (data === null) {
    return (
      <div className="empty-state">
        <p>Repertório não encontrado.</p>
        <button className="btn" onClick={() => navigate('/repertorios')}>
          Voltar
        </button>
      </div>
    );
  }

  const { setlist, songs } = data;
  const entries: StageEntry[] = [];
  setlist.items.forEach((item, i) => {
    const song = songs[i] as Song | undefined;
    if (song) entries.push({ id: item.id, song, toKey: item.key, arrangement: item.arrangement, notes: item.notes });
  });

  const onKeyChange = (index: number, key: string) => {
    const itemId = entries[index].id;
    const song = entries[index].song;
    saveSetlist({
      ...setlist,
      items: setlist.items.map((it) => (it.id === itemId ? { ...it, key: key === song.key ? undefined : key } : it)),
    });
  };

  return (
    <Stage
      title={setlist.name}
      entries={entries}
      onBack={() => navigate(`/repertorios/${setlist.id}`)}
      onKeyChange={onKeyChange}
      actions={
        <button className="icon-btn" onClick={() => navigate(`/repertorios/${setlist.id}`)} aria-label="Editar repertório">
          <Icon name="edit" />
        </button>
      }
    />
  );
}
