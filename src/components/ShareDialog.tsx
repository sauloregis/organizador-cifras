import { useState } from 'react';
import type { SharePayload } from '../lib/types';
import { payloadFile, shareFile, shareLink, shareUrl } from '../lib/share';
import { Icon } from './Icon';

interface Props {
  title: string;
  payload: SharePayload;
  onClose: () => void;
}

export function ShareDialog({ title, payload, onClose }: Props) {
  const [msg, setMsg] = useState('');
  const [manualLink, setManualLink] = useState('');
  const link = shareLink(payload);

  const viaLink = async () => {
    const r = await shareUrl(title, link);
    if (r === 'copied') setMsg('Link copiado! Cole no grupo do WhatsApp.');
    else if (r === 'manual') setManualLink(link);
    else if (r === 'shared') onClose();
  };

  const viaFile = async () => {
    const r = await shareFile(title, payloadFile(payload, title));
    if (r === 'downloaded') setMsg('Arquivo baixado. Envie-o pelo WhatsApp e peça para abrirem em Ajustes → Importar.');
    else if (r === 'shared') onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h2>Compartilhar</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            <Icon name="close" />
          </button>
        </div>
        <p className="muted">
          “{title}” vai junto com {payload.songs.length} música{payload.songs.length === 1 ? '' : 's'}. Quem receber fica com
          tudo salvo no celular, inclusive para usar sem internet.
        </p>
        <button className="btn primary block" onClick={viaLink}>
          <Icon name="link" /> Enviar link
        </button>
        <p className="muted small">
          Mais prático: a pessoa toca no link e importa. ({Math.round(link.length / 1024)} KB de texto)
        </p>
        <button className="btn block" onClick={viaFile}>
          <Icon name="file" /> Enviar arquivo
        </button>
        <p className="muted small">Use se o link ficar grande demais ou não abrir.</p>
        {manualLink && (
          <textarea className="mono" readOnly value={manualLink} rows={4} onFocus={(e) => e.currentTarget.select()} />
        )}
        {msg && <p className="notice">{msg}</p>}
      </div>
    </div>
  );
}
