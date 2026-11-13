import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId, saveSetlist } from '../lib/db';
import { formatDate, nextSunday } from '../lib/util';
import { PageHeader } from '../components/Layout';
import { Icon } from '../components/Icon';

export function SetlistsPage() {
  const navigate = useNavigate();
  const setlists = useLiveQuery(() => db.setlists.orderBy('date').reverse().toArray(), []);

  const create = async () => {
    const id = newId();
    await saveSetlist({ id, name: 'Culto de domingo', date: nextSunday(), items: [], createdAt: Date.now(), updatedAt: 0 });
    navigate(`/repertorios/${id}`);
  };

  return (
    <>
      <PageHeader title="Repertórios">
        <button className="btn primary sm" onClick={create}>
          <Icon name="plus" size={18} /> Novo
        </button>
      </PageHeader>
      {setlists && setlists.length === 0 && (
        <div className="empty-state">
          <p>Nenhum repertório ainda.</p>
          <p className="muted small">
            Crie o repertório do domingo, adicione as músicas na ordem e toque em <b>Tocar</b> para ver tudo em sequência.
          </p>
        </div>
      )}
      <ul className="list">
        {setlists?.map((sl) => (
          <li key={sl.id}>
            <div className="list-row">
              <Link to={`/repertorios/${sl.id}`} className="grow">
                <div className="row-title">{sl.name}</div>
                <div className="muted small">
                  {formatDate(sl.date)} · {sl.items.length} música{sl.items.length === 1 ? '' : 's'}
                </div>
              </Link>
              <button
                className="icon-btn accent"
                onClick={() => navigate(`/repertorios/${sl.id}/tocar`)}
                aria-label="Tocar"
                disabled={sl.items.length === 0}
              >
                <Icon name="play" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
