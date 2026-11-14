import { useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SECTION_TYPE_NAMES, sectionTypeFromLabel } from '../lib/songText';
import { defaultLabel, isEmptySection, normalizeChords, uid, type EChord, type ELine, type ESection } from '../lib/editorModel';
import type { SectionType } from '../lib/types';
import { Icon } from './Icon';

export type StructureOp =
  | { kind: 'split'; from: string; created: string }
  | { kind: 'remove'; id: string }
  | { kind: 'add'; id: string };

interface Props {
  model: ESection[];
  onChange: (model: ESection[], op?: StructureOp) => void;
}

const TYPES = Object.keys(SECTION_TYPE_NAMES) as SectionType[];

const collision: CollisionDetection = (args) => {
  const lines = args.droppableContainers.filter((c) => String(c.id).startsWith('l:'));
  const secs = args.droppableContainers.filter((c) => String(c.id).startsWith('d:'));
  const overLine = pointerWithin({ ...args, droppableContainers: lines });
  if (overLine.length) return overLine;
  const overSec = pointerWithin({ ...args, droppableContainers: secs });
  if (overSec.length) return overSec;
  return closestCenter({ ...args, droppableContainers: lines });
};

interface ChordDrag {
  secId: string;
  lineId: string;
  chord: EChord;
  startX: number;
  startY: number;
  grabX: number;
  moved: boolean;
}

/**
 * Editor visual da cifra:
 * - arraste um acorde para outra sílaba (ou outra linha);
 * - toque num acorde para editar/apagar; toque acima da letra para adicionar;
 * - arraste ⋮⋮ para mover linhas, inclusive para outra parte;
 * - escolha a classificação de cada parte (Refrão, Ponte...).
 */
export function SectionsEditor({ model, onChange }: Props) {
  const modelRef = useRef(model);
  modelRef.current = model;
  const update = (fn: (m: ESection[]) => ESection[], op?: StructureOp) => {
    const next = fn(modelRef.current);
    modelRef.current = next;
    onChange(next, op);
  };

  // largura de um caractere da fonte monoespaçada (para converter pixels em colunas)
  const measureRef = useRef<HTMLSpanElement>(null);
  const [charW, setCharW] = useState(8.4);
  useLayoutEffect(() => {
    const w = measureRef.current?.getBoundingClientRect().width;
    if (w) setCharW(w / 10);
  }, []);

  const [activeLine, setActiveLine] = useState<ELine | null>(null);
  const [lineMenu, setLineMenu] = useState<{ secId: string; lineId: string } | null>(null);
  const [secMenu, setSecMenu] = useState<string | null>(null);
  const [chordDelta, setChordDelta] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const chordDrag = useRef<ChordDrag | null>(null);
  const justDragged = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ---------- helpers de edição ----------

  const mapLine = (secId: string, lineId: string, fn: (l: ELine) => ELine | null) =>
    update((m) =>
      m.map((s) =>
        s.id !== secId
          ? s
          : { ...s, lines: s.lines.map((l) => (l.id === lineId ? fn(l) : l)).filter((l): l is ELine => !!l) },
      ),
    );

  const findSec = (id: string) => {
    if (id.startsWith('d:')) return id.slice(2);
    const lineId = id.slice(2);
    return modelRef.current.find((s) => s.lines.some((l) => l.id === lineId))?.id;
  };

  const editLyric = (secId: string, line: ELine) => {
    const v = prompt('Letra da linha:', line.kind === 'tab' ? line.text : (line.lyric ?? ''));
    if (v === null) return;
    mapLine(secId, line.id, (l) => (l.kind === 'tab' ? { ...l, text: v } : { ...l, kind: 'music', lyric: v }));
  };

  const editChord = (secId: string, lineId: string, chord: EChord) => {
    const v = prompt('Acorde (deixe vazio para apagar):', chord.text);
    if (v === null) return;
    const text = v.trim().replace(/\s+/g, '');
    mapLine(secId, lineId, (l) => ({
      ...l,
      chords: normalizeChords(text ? l.chords.map((c) => (c.id === chord.id ? { ...c, text } : c)) : l.chords.filter((c) => c.id !== chord.id)),
    }));
  };

  const addChord = (secId: string, lineId: string, col: number) => {
    const v = prompt('Novo acorde:');
    const text = v?.trim().replace(/\s+/g, '');
    if (!text) return;
    mapLine(secId, lineId, (l) => ({
      ...l,
      kind: 'music',
      chords: normalizeChords([...l.chords, { id: uid('c'), col, text }]),
    }));
  };

  const moveChord = (d: ChordDrag, toSec: string, toLine: string, col: number) =>
    update((m) =>
      m.map((s) => ({
        ...s,
        lines: s.lines.map((l) => {
          let line = l;
          if (s.id === d.secId && l.id === d.lineId) line = { ...line, chords: line.chords.filter((c) => c.id !== d.chord.id) };
          if (s.id === toSec && l.id === toLine) {
            line = {
              ...line,
              kind: 'music',
              chords: normalizeChords([...line.chords.filter((c) => c.id !== d.chord.id), { ...d.chord, col }]),
            };
          }
          return line;
        }),
      })),
    );

  const changeType = (secId: string, type: SectionType) =>
    update((m) =>
      m.map((s) => {
        if (s.id !== secId) return s;
        const auto = s.label === 'Nova' || !s.label.trim() || sectionTypeFromLabel(s.label) === s.type;
        const taken = m.filter((x) => x.id !== secId).map((x) => x.label);
        return { ...s, type, label: auto ? defaultLabel(type, taken) : s.label };
      }),
    );

  const splitAt = (secId: string, lineId: string) => {
    const created = uid('s');
    update(
      (m) =>
        m.flatMap((s) => {
          if (s.id !== secId) return [s];
          const idx = s.lines.findIndex((l) => l.id === lineId);
          if (idx <= 0) return [s];
          return [
            { ...s, lines: s.lines.slice(0, idx) },
            { id: created, label: 'Nova', type: 'other' as SectionType, lines: s.lines.slice(idx).filter((l, i) => i > 0 || l.kind !== 'empty') },
          ];
        }),
      { kind: 'split', from: secId, created },
    );
  };

  const mergeUp = (secId: string) =>
    update(
      (m) => {
        const idx = m.findIndex((s) => s.id === secId);
        if (idx <= 0) return m;
        const prev = m[idx - 1];
        const merged = { ...prev, lines: [...prev.lines, { id: uid('l'), kind: 'empty' as const, chords: [], lyric: null, text: '' }, ...m[idx].lines] };
        return m.flatMap((s, i) => (i === idx - 1 ? [merged] : i === idx ? [] : [s]));
      },
      { kind: 'remove', id: secId },
    );

  const removeSection = (secId: string) => {
    const s = modelRef.current.find((x) => x.id === secId);
    if (s && !isEmptySection(s) && !confirm(`Excluir a parte “${s.label}” e todas as linhas dela?`)) return;
    update((m) => m.filter((x) => x.id !== secId), { kind: 'remove', id: secId });
  };

  const addSection = () => {
    const id = uid('s');
    update((m) => [...m, { id, label: 'Nova', type: 'other', lines: [] }], { kind: 'add', id });
  };

  const addLine = (secId: string) => {
    const v = prompt('Letra da nova linha (os acordes você adiciona tocando acima dela):');
    if (v === null) return;
    update((m) =>
      m.map((s) =>
        s.id === secId ? { ...s, lines: [...s.lines, { id: uid('l'), kind: 'music', chords: [], lyric: v, text: '' }] } : s,
      ),
    );
  };

  // ---------- arrastar linhas (dnd-kit) ----------

  const onDragStart = ({ active }: DragStartEvent) => {
    const id = String(active.id).slice(2);
    setActiveLine(modelRef.current.flatMap((s) => s.lines).find((l) => l.id === id) ?? null);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const from = findSec(String(active.id));
    const to = findSec(String(over.id));
    if (!from || !to || from === to) return;
    const lineId = String(active.id).slice(2);
    update((m) => {
      const line = m.find((s) => s.id === from)!.lines.find((l) => l.id === lineId)!;
      return m.map((s) => {
        if (s.id === from) return { ...s, lines: s.lines.filter((l) => l.id !== lineId) };
        if (s.id === to) {
          const overIdx = String(over.id).startsWith('l:') ? s.lines.findIndex((l) => l.id === String(over.id).slice(2)) : -1;
          const lines = [...s.lines];
          lines.splice(overIdx >= 0 ? overIdx : lines.length, 0, line);
          return { ...s, lines };
        }
        return s;
      });
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveLine(null);
    justDragged.current = true;
    setTimeout(() => (justDragged.current = false), 0);
    if (!over || active.id === over.id || !String(over.id).startsWith('l:')) return;
    const sec = findSec(String(active.id));
    if (!sec || sec !== findSec(String(over.id))) return;
    update((m) =>
      m.map((s) => {
        if (s.id !== sec) return s;
        const from = s.lines.findIndex((l) => 'l:' + l.id === active.id);
        const to = s.lines.findIndex((l) => 'l:' + l.id === over.id);
        return from < 0 || to < 0 ? s : { ...s, lines: arrayMove(s.lines, from, to) };
      }),
    );
  };

  // ---------- arrastar acordes (ponteiro) ----------

  const chordHandlers = (secId: string, lineId: string, chord: EChord) => ({
    onPointerDown: (e: RPointerEvent<HTMLSpanElement>) => {
      e.stopPropagation();
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* alguns navegadores recusam a captura; o arrasto continua funcionando */
      }
      const rect = e.currentTarget.getBoundingClientRect();
      chordDrag.current = { secId, lineId, chord, startX: e.clientX, startY: e.clientY, grabX: e.clientX - rect.left, moved: false };
    },
    onPointerMove: (e: RPointerEvent<HTMLSpanElement>) => {
      const d = chordDrag.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.moved && Math.hypot(dx, dy) < 5) return;
      d.moved = true;
      setChordDelta({ id: d.chord.id, dx, dy });
      if (e.clientY < 70) window.scrollBy(0, -10);
      else if (e.clientY > window.innerHeight - 70) window.scrollBy(0, 10);
    },
    onPointerUp: (e: RPointerEvent<HTMLSpanElement>) => {
      const d = chordDrag.current;
      chordDrag.current = null;
      setChordDelta(null);
      if (!d) return;
      if (!d.moved) {
        editChord(secId, lineId, chord);
        return;
      }
      const target = document
        .elementsFromPoint(e.clientX, e.clientY)
        .filter((n) => !n.classList.contains('ed-chord'))
        .map((n) => n.closest<HTMLElement>('[data-line-id]'))
        .find((n): n is HTMLElement => !!n);
      if (!target || target.dataset.kind === 'tab') return; // soltou fora: volta ao lugar
      const row = target.querySelector<HTMLElement>('.ed-chords') ?? target.querySelector<HTMLElement>('.ed-line-body');
      if (!row) return;
      const col = Math.max(0, Math.round((e.clientX - d.grabX - row.getBoundingClientRect().left) / charW));
      moveChord(d, target.dataset.secId!, target.dataset.lineId!, col);
    },
    onPointerCancel: () => {
      chordDrag.current = null;
      setChordDelta(null);
    },
  });

  const menuLine = lineMenu && model.find((s) => s.id === lineMenu.secId)?.lines.find((l) => l.id === lineMenu.lineId);
  const menuSec = secMenu ? model.find((s) => s.id === secMenu) : undefined;

  return (
    <div className="ed">
      <span ref={measureRef} className="ed-measure" aria-hidden="true">
        0000000000
      </span>
      <p className="muted small ed-tips">
        Arraste um <b className="chord-text">acorde</b> para outra sílaba ou linha. Toque nele para editar; toque no espaço acima
        da letra para adicionar. Use <Icon name="grip" size={14} /> para mover linhas, inclusive para outra parte.
      </p>

      <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setActiveLine(null)}>
        {model.map((sec) => (
          <div key={sec.id} className={`ed-sec t-${sec.type}`}>
            <div className="ed-sec-head">
              <select
                value={sec.type}
                onChange={(e) => changeType(sec.id, e.target.value as SectionType)}
                aria-label="Classificação da parte"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {SECTION_TYPE_NAMES[t]}
                  </option>
                ))}
              </select>
              <input
                value={sec.label}
                onChange={(e) => update((m) => m.map((s) => (s.id === sec.id ? { ...s, label: e.target.value } : s)))}
                aria-label="Nome da parte"
              />
              <button type="button" className="icon-btn sm" onClick={() => setSecMenu(sec.id)} aria-label="Mais opções da parte">
                <Icon name="more" size={18} />
              </button>
            </div>
            <SectionLines sec={sec}>
              {sec.lines.map((line) => (
                <LineRow
                  key={line.id}
                  line={line}
                  secId={sec.id}
                  chordDelta={chordDelta}
                  chordHandlers={chordHandlers}
                  onHandleClick={() => !justDragged.current && setLineMenu({ secId: sec.id, lineId: line.id })}
                  onEditLyric={() => editLyric(sec.id, line)}
                  onAddChord={(clientX, rowLeft) => addChord(sec.id, line.id, Math.max(0, Math.floor((clientX - rowLeft) / charW)))}
                />
              ))}
            </SectionLines>
            <button type="button" className="btn ghost sm" onClick={() => addLine(sec.id)}>
              <Icon name="plus" size={16} /> Linha
            </button>
          </div>
        ))}
        <DragOverlay>{activeLine ? <div className="ed-overlay">{linePreview(activeLine)}</div> : null}</DragOverlay>
      </DndContext>

      <button type="button" className="btn block" onClick={addSection}>
        <Icon name="plus" /> Nova parte
      </button>

      {menuLine && lineMenu && (
        <Sheet title="Linha" onClose={() => setLineMenu(null)}>
          <p className="muted small mono sheet-preview">{linePreview(menuLine)}</p>
          <button className="btn block" onClick={() => (setLineMenu(null), editLyric(lineMenu.secId, menuLine))}>
            <Icon name="edit" /> Editar letra
          </button>
          <button className="btn block" onClick={() => (setLineMenu(null), splitAt(lineMenu.secId, lineMenu.lineId))}>
            <Icon name="wand" /> Começar uma nova parte aqui
          </button>
          <button
            className="btn block danger"
            onClick={() => (setLineMenu(null), mapLine(lineMenu.secId, lineMenu.lineId, () => null))}
          >
            <Icon name="trash" /> Excluir linha
          </button>
        </Sheet>
      )}

      {menuSec && (
        <Sheet title={menuSec.label} onClose={() => setSecMenu(null)}>
          <button
            className="btn block"
            disabled={model[0]?.id === menuSec.id}
            onClick={() => (setSecMenu(null), mergeUp(menuSec.id))}
          >
            <Icon name="up" /> Juntar com a parte de cima
          </button>
          <button className="btn block danger" onClick={() => (setSecMenu(null), removeSection(menuSec.id))}>
            <Icon name="trash" /> Excluir parte
          </button>
        </Sheet>
      )}
    </div>
  );
}

function linePreview(l: ELine): string {
  if (l.kind === 'tab') return l.text;
  if (l.kind === 'empty') return '(linha em branco)';
  return l.lyric?.trim() || l.chords.map((c) => c.text).join('  ');
}

function SectionLines({ sec, children }: { sec: ESection; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'd:' + sec.id });
  return (
    <SortableContext items={sec.lines.map((l) => 'l:' + l.id)} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} className={`ed-lines${isOver ? ' over' : ''}`}>
        {children}
        {sec.lines.length === 0 && <div className="ed-drop-hint">Arraste linhas para cá</div>}
      </div>
    </SortableContext>
  );
}

function LineRow({
  line,
  secId,
  chordDelta,
  chordHandlers,
  onHandleClick,
  onEditLyric,
  onAddChord,
}: {
  line: ELine;
  secId: string;
  chordDelta: { id: string; dx: number; dy: number } | null;
  chordHandlers: (secId: string, lineId: string, chord: EChord) => Record<string, unknown>;
  onHandleClick: () => void;
  onEditLyric: () => void;
  onAddChord: (clientX: number, rowLeft: number) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: 'l:' + line.id });
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.35 : 1 };
  const width = Math.max(
    line.lyric?.length ?? 0,
    ...line.chords.map((c) => c.col + c.text.length),
  );

  return (
    <div ref={setNodeRef} style={style} className={`ed-line k-${line.kind}`} data-line-id={line.id} data-sec-id={secId} data-kind={line.kind}>
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="drag-handle"
        aria-label="Arrastar linha (toque para opções)"
        {...attributes}
        {...listeners}
        onClick={onHandleClick}
      >
        <Icon name="grip" size={16} />
      </button>
      <div className="ed-line-body">
        {line.kind === 'music' && (
          <>
            <div
              className="ed-chords"
              style={{ minWidth: `${width + 4}ch` }}
              onClick={(e) => e.target === e.currentTarget && onAddChord(e.clientX, e.currentTarget.getBoundingClientRect().left)}
            >
              {line.chords.map((c) => {
                const moving = chordDelta?.id === c.id;
                return (
                  <span
                    key={c.id}
                    className={`ed-chord${moving ? ' moving' : ''}`}
                    style={{ left: `${c.col}ch`, transform: moving ? `translate(${chordDelta!.dx}px, ${chordDelta!.dy}px)` : undefined }}
                    {...chordHandlers(secId, line.id, c)}
                  >
                    {c.text}
                  </span>
                );
              })}
            </div>
            {line.lyric !== null && (
              <div className="ed-lyric" onClick={onEditLyric}>
                {line.lyric || ' '}
              </div>
            )}
          </>
        )}
        {line.kind === 'tab' && (
          <div className="ed-tab" onClick={onEditLyric}>
            {line.text}
          </div>
        )}
        {line.kind === 'empty' && <div className="ed-empty">linha em branco</div>}
      </div>
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
