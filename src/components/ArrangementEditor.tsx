import type { Section } from '../lib/types';
import { SortableList } from './SortableList';
import { Icon } from './Icon';

interface Props {
  sections: Section[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** Ordem padrão, para o botão "restaurar". */
  defaultOrder?: string[];
  resetLabel?: string;
}

/** Ordem das partes: arraste pela alça para reordenar; toque numa parte embaixo para adicioná-la. */
export function ArrangementEditor({ sections, value, onChange, defaultOrder, resetLabel }: Props) {
  const map = new Map(sections.map((s) => [s.id, s]));
  const items = value.filter((id) => map.has(id));

  return (
    <div className="arr">
      {items.length === 0 ? (
        <p className="muted small">Nenhuma parte. Toque abaixo para adicionar.</p>
      ) : (
        <SortableList
          className="arr-list"
          items={items}
          getId={(id, i) => `${id}#${i}`}
          onReorder={onChange}
          itemClassName={(id) => `arr-item t-${map.get(id)!.type}`}
          render={(id, i, handle) => (
            <>
              {handle}
              <span className="arr-n">{i + 1}</span>
              <span className="arr-label">{map.get(id)!.label}</span>
              <button
                type="button"
                className="icon-btn sm"
                onClick={() => onChange(items.filter((_, k) => k !== i))}
                aria-label="Remover"
              >
                <Icon name="close" size={18} />
              </button>
            </>
          )}
        />
      )}
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
