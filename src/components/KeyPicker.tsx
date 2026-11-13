import { MAJOR_KEYS, MINOR_KEYS, parseKey, shiftKey } from '../lib/chords';
import { Icon } from './Icon';

interface Props {
  originalKey: string;
  value?: string;
  onChange: (key: string) => void;
  compact?: boolean;
}

/** Seletor de tom com botões de meio tom para baixo/cima. */
export function KeyPicker({ originalKey, value, onChange, compact }: Props) {
  const pk = parseKey(originalKey);
  if (!pk) return null;
  const current = value || originalKey;
  const keys = pk.minor ? MINOR_KEYS : MAJOR_KEYS;
  const options = keys.includes(current) ? keys : [current, ...keys];

  return (
    <div className={`key-picker${compact ? ' compact' : ''}`}>
      <button type="button" className="icon-btn sm" onClick={() => onChange(shiftKey(current, -1))} aria-label="Meio tom abaixo">
        <Icon name="minus" size={18} />
      </button>
      <select value={current} onChange={(e) => onChange(e.target.value)} aria-label="Tom">
        {options.map((k) => (
          <option key={k} value={k}>
            {k}
            {k === originalKey ? ' (original)' : ''}
          </option>
        ))}
      </select>
      <button type="button" className="icon-btn sm" onClick={() => onChange(shiftKey(current, 1))} aria-label="Meio tom acima">
        <Icon name="plus" size={18} />
      </button>
    </div>
  );
}
