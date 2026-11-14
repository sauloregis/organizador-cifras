import type { CSSProperties, ReactNode } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToParent, restrictToVertical } from './dndModifiers';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from './Icon';

export interface HandleProps {
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
}

interface Props<T> {
  items: T[];
  getId: (item: T, index: number) => string;
  onReorder: (items: T[]) => void;
  render: (item: T, index: number, handle: ReactNode) => ReactNode;
  className?: string;
  itemClassName?: (item: T, index: number) => string;
}

/** Lista que se reordena arrastando pela alça (⋮⋮). Funciona com dedo, mouse e teclado. */
export function SortableList<T>({ items, getId, onReorder, render, className, itemClassName }: Props<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map(getId);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from >= 0 && to >= 0) onReorder(arrayMove(items, from, to));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      modifiers={[restrictToVertical, restrictToParent]}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol className={className}>
          {items.map((item, i) => (
            <SortableRow key={ids[i]} id={ids[i]} className={itemClassName?.(item, i)}>
              {(handle) => render(item, i, handle)}
            </SortableRow>
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, className, children }: { id: string; className?: string; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    position: 'relative',
    zIndex: isDragging ? 10 : undefined,
  };
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className="drag-handle"
      aria-label="Arrastar para reordenar"
      {...attributes}
      {...listeners}
    >
      <Icon name="grip" size={18} />
    </button>
  );
  return (
    <li ref={setNodeRef} style={style} className={`${className ?? ''}${isDragging ? ' dragging' : ''}`}>
      {children(handle)}
    </li>
  );
}
