import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { applyImport, planImport, type ImportPlan, type ImportStatus } from '../lib/db';
import { decodePayload } from '../lib/share';
import type { SharePayload } from '../lib/types';
import { formatDate } from '../lib/util';
import { PageHeader } from '../components/Layout';
import { Icon } from '../components/Icon';

const STATUS: Record<ImportStatus, string> = {
  new: 'nova',
  update: 'atualizar',
  same: 'já tenho',
  older: 'a minha é mais nova',
};

export function ImportPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [error, setError] = useState('');
  const [overwrite, setOverwrite] = useState(false);

  useEffect(() => {
    try {
      const fromState = (location.state as { payload?: SharePayload } | null)?.payload;
      const data = params.get('d');
      const payload = fromState ?? (data ? decodePayload(data) : null);
      if (!payload) throw new Error('Nada para importar.');
      planImport(payload).then(setPlan, (e) => setError(String(e.message ?? e)));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [params, location.state]);

  const doImport = async () => {
    if (!plan) return;
    await applyImport(plan, overwrite);
    // limpa o link da barra de endereço
    const sl = plan.setlists[0]?.setlist;
    navigate(sl ? `/repertorios/${sl.id}` : plan.songs.length === 1 ? `/musicas/${plan.songs[0].song.id}` : '/musicas', {
      replace: true,
    });
  };

  const hasOlder = plan && [...plan.songs, ...plan.setlists].some((x) => x.status === 'older');
  const nothingNew =
    plan && ![...plan.songs, ...plan.setlists].some((x) => x.status === 'new' || x.status === 'update') && !overwrite;

  return (
    <>
      <PageHeader title="Importar" back={() => navigate('/', { replace: true })} />
      {error && <p className="notice error">{error}</p>}
      {plan && (
        <div className="form">
          {plan.setlists.map(({ setlist, status }) => (
            <div key={setlist.id} className="item-card">
              <div className="row-title">{setlist.name}</div>
              <div className="muted small">
                {formatDate(setlist.date)} · {setlist.items.length} músicas · <b>{STATUS[status]}</b>
              </div>
            </div>
          ))}
          <ul className="list">
            {plan.songs.map(({ song, status }) => (
              <li key={song.id} className="list-row">
                <div className="grow">
                  <div className="row-title">{song.title}</div>
                  {song.artist && <div className="muted small">{song.artist}</div>}
                </div>
                <span className={`pill${status === 'new' || status === 'update' ? ' accent' : ''}`}>{STATUS[status]}</span>
              </li>
            ))}
          </ul>
          {hasOlder && (
            <label className="check">
              <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
              Substituir também as que eu alterei depois (fico com a versão recebida)
            </label>
          )}
          <button className="btn primary block" onClick={doImport}>
            <Icon name="check" /> {nothingNew ? 'Abrir' : 'Salvar neste aparelho'}
          </button>
        </div>
      )}
    </>
  );
}
