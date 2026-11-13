import type { Section } from '../lib/types';
import { Icon } from './Icon';

interface Props {
  sections: Section[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** Ordem padrão, para o botão "restaurar". */
  defaultOrder?: string[];
  resetLabel?: string;
}

/** Monta a ordem das partes: toque numa parte para adicioná-la; use ↑ ↓ ✕ para organizar. */
export function ArrangementEditor({ sections, value, onChange, defaultOrder, resetLabel }: Props) {
  const map = new Map(sections.map((s) => [s.id, s]));
  const items = value.filter((id) => map.has(id));

  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="arr">
      <ol className="arr-list">
        {items.map((id, i) => {
          const s = map.get(id)!;
          return (
            <li key={`${id}-${i}`} className={`arr-item t-${s.type}`}>
              <span className="arr-n">{i + 1}</span>
              <span className="arr-label">{s.label}</span>
              <button type="button" className="icon-btn sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir">
                <Icon name="up" size={18} />
              </button>
              <button
                type="button"
                className="icon-btn sm"
                onClick={() => move(i, 1)}
                disabled={i === items.length - 1}
                aria-label="Descer"
              >
                <Icon name="down" size={18} />
              </button>
              <button
                type="button"
                className="icon-btn sm"
                onClick={() => onChange(items.filter((_, k) => k !== i))}
                aria-label="Remover"
              >
                <Icon name="close" size={18} />
              </button>
            </li>
          );
        })}
        {items.length === 0 && <li className="muted small">Nenhuma parte. Toque abaixo para adicionar.</li>}
      </ol>
      <div className="arr-palette">
        <span className="muted small">Adicionar:</span>
        {sections.map((s) => (
          <button type="button" key={s.id} className={`chip t-${s.type}`} onClick={() => onChange([...items, s.id])}>
            + {s.label}
          </button>
        ))}
      </div>
      {defaultOrder && (
        <button type="button" className="btn ghost sm" onClick={() => onChange([...defaultOrder])}>
          <Icon name="reset" size={16} /> {resetLabel ?? 'Restaurar ordem padrão'}
        </button>
      )}
    </div>
  );
}
