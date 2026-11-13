import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { exportAll, requestPersistentStorage } from '../lib/db';
import { readPayloadFile, shareFile, payloadFile } from '../lib/share';
import { FONT_MAX, FONT_MIN, setPrefs, usePrefs } from '../lib/prefs';
import { PageHeader } from '../components/Layout';
import { Icon } from '../components/Icon';

export function SettingsPage() {
  const prefs = usePrefs();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
  }, []);

  const backup = async () => {
    const payload = await exportAll();
    const date = new Date().toISOString().slice(0, 10);
    await shareFile('Backup Cifras Louvor', payloadFile(payload, `cifras-backup-${date}`));
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const payload = await readPayloadFile(file);
      navigate('/importar', { state: { payload } });
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <>
      <PageHeader title="Ajustes" />
      <div className="form">
        <h3>Exibição (só neste aparelho)</h3>
        <div className="setting">
          <span>Tamanho da letra</span>
          <div className="inline">
            <button className="icon-btn sm" onClick={() => setPrefs({ fontSize: Math.max(FONT_MIN, prefs.fontSize - 2) })}>
              <Icon name="minus" size={18} />
            </button>
            <span className="pill">{prefs.fontSize}px</span>
            <button className="icon-btn sm" onClick={() => setPrefs({ fontSize: Math.min(FONT_MAX, prefs.fontSize + 2) })}>
              <Icon name="plus" size={18} />
            </button>
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={prefs.showChords} onChange={(e) => setPrefs({ showChords: e.target.checked })} />
          Mostrar cifras (desmarque para ver só a letra — modo vocal)
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={prefs.showSectionLabels}
            onChange={(e) => setPrefs({ showSectionLabels: e.target.checked })}
          />
          Mostrar nome das partes (Refrão, Ponte…)
        </label>
        <div className="setting">
          <span>Tema</span>
          <div className="tabs">
            <button className={prefs.theme === 'dark' ? 'on' : ''} onClick={() => setPrefs({ theme: 'dark' })}>
              Escuro
            </button>
            <button className={prefs.theme === 'light' ? 'on' : ''} onClick={() => setPrefs({ theme: 'light' })}>
              Claro
            </button>
          </div>
        </div>

        <h3>Backup e importação</h3>
        <p className="muted small">
          Tudo fica salvo só neste aparelho. Faça um backup de vez em quando, ou para passar tudo para outro celular.
        </p>
        <button className="btn block" onClick={backup}>
          <Icon name="file" /> Exportar tudo (arquivo)
        </button>
        <button className="btn block" onClick={() => fileInput.current?.click()}>
          <Icon name="down" /> Importar arquivo recebido
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />

        <h3>Armazenamento</h3>
        {persisted ? (
          <p className="muted small">✓ O navegador garantiu que não vai apagar seus dados.</p>
        ) : (
          <>
            <p className="muted small">
              Alguns navegadores podem apagar dados de sites pouco usados. Instalar o app na tela inicial evita isso.
            </p>
            <button className="btn sm" onClick={() => requestPersistentStorage().then(setPersisted)}>
              Pedir armazenamento permanente
            </button>
          </>
        )}

        <h3>Instalar no celular</h3>
        <ul className="help-list muted small">
          <li>
            <b>Android (Chrome):</b> menu ⋮ → <i>Instalar app</i> / <i>Adicionar à tela inicial</i>.
          </li>
          <li>
            <b>iPhone (Safari):</b> botão compartilhar → <i>Adicionar à Tela de Início</i>.
          </li>
          <li>Depois de aberto uma vez, o app funciona sem internet.</li>
        </ul>
        <p className="muted small">Cifras Louvor v{__APP_VERSION__}</p>
      </div>
    </>
  );
}
