import type { Modifier } from '@dnd-kit/core';

/** Só deixa arrastar na vertical. */
export const restrictToVertical: Modifier = ({ transform }) => ({ ...transform, x: 0 });

/** Não deixa o item sair muito da lista onde está. */
export const restrictToParent: Modifier = ({ transform, draggingNodeRect, containerNodeRect }) => {
  if (!draggingNodeRect || !containerNodeRect) return transform;
  const minY = containerNodeRect.top - draggingNodeRect.top - draggingNodeRect.height / 2;
  const maxY = containerNodeRect.bottom - draggingNodeRect.bottom + draggingNodeRect.height / 2;
  return { ...transform, y: Math.min(maxY, Math.max(minY, transform.y)) };
};
