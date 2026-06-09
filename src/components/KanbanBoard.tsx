"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";

// ─── Types ─────────────────────────────────────────────────

export interface KanbanCard {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  tag?: string;
  tagColor?: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  cards: KanbanCard[];
}

interface KanbanBoardProps {
  columns: KanbanColumn[];
  onCardMove?: (cardId: string, fromColumnId: string, toColumnId: string) => void;
  onCardClick?: (cardId: string) => void;
}

// ─── Draggable Card ────────────────────────────────────────

function DraggableCard({
  card,
  isDragging,
  isHighlighted,
  onClick,
}: {
  card: KanbanCard;
  isDragging: boolean;
  isHighlighted: boolean;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: card.id,
  });

  const style: React.CSSProperties = {
    ...(transform
      ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
      : {}),
    ...(isDragging ? { opacity: 0.4, scale: "0.98" } : {}),
    ...(isHighlighted
      ? { animation: "card-highlight 0.8s ease-in-out 3" }
      : {}),
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      onClick={onClick}
      className={`bg-background/60 rounded-lg p-3.5 border border-border hover:border-primary/40 hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing select-none ${
        isHighlighted ? "ring-2 ring-primary/60" : ""
      }`}
    >
      <p className="text-sm font-medium text-dark leading-snug">{card.title}</p>
      <p className="text-xs text-contrast mt-1">{card.subtitle}</p>
      <div className="flex items-center justify-between mt-2.5">
        <span className="text-xs text-contrast/70">{card.date}</span>
        {card.tag && (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: `${card.tagColor || "#FEBF22"}20`,
              color: card.tagColor || "#FEBF22",
            }}
          >
            {card.tag}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Card Overlay (floating clone during drag) ─────────────

function CardOverlay({ card }: { card: KanbanCard }) {
  return (
    <div
      className="bg-background rounded-lg p-3.5 border-2 border-primary shadow-2xl w-72 rotate-[2deg] scale-105 pointer-events-none"
      style={{ opacity: 0.95 }}
    >
      <p className="text-sm font-medium text-dark leading-snug">{card.title}</p>
      <p className="text-xs text-contrast mt-1">{card.subtitle}</p>
      <div className="flex items-center justify-between mt-2.5">
        <span className="text-xs text-contrast/70">{card.date}</span>
        {card.tag && (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: `${card.tagColor || "#FEBF22"}20`,
              color: card.tagColor || "#FEBF22",
            }}
          >
            {card.tag}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Droppable Column ──────────────────────────────────────

function DroppableColumn({
  column,
  isValidTarget,
  isOver,
  activeCardId,
  highlightedCardId,
  onCardClick,
}: {
  column: KanbanColumn;
  isValidTarget: boolean;
  isOver: boolean;
  activeCardId: string | null;
  highlightedCardId: string | null;
  onCardClick?: (cardId: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: column.id });

  const showDropZone = isValidTarget && isOver;
  const showHint = isValidTarget && !isOver && activeCardId;

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-72 rounded-xl border flex flex-col max-h-[calc(100vh-12rem)] transition-all duration-300 ${
        showDropZone
          ? "bg-accent/5 border-accent/50 shadow-lg shadow-accent/10"
          : showHint
            ? "bg-surface border-accent/20 border-dashed"
            : "bg-surface border-border"
      }`}
    >
      {/* Column header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <div
          className="w-2.5 h-2.5 rounded-full transition-transform duration-300"
          style={{
            backgroundColor: column.color,
            ...(showDropZone ? { transform: "scale(1.4)" } : {}),
          }}
        />
        <h3 className="text-sm font-heading font-bold text-dark">
          {column.title}
        </h3>
        <span className="ml-auto text-xs text-contrast bg-background rounded-full px-2 py-0.5">
          {column.cards.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {column.cards.length === 0 && !showDropZone ? (
          <div className="text-center py-8 text-contrast/50 text-sm">
            Nenhum item
          </div>
        ) : (
          column.cards.map((card) => (
            <DraggableCard
              key={card.id}
              card={card}
              isDragging={activeCardId === card.id}
              isHighlighted={highlightedCardId === card.id}
              onClick={() => onCardClick?.(card.id)}
            />
          ))
        )}

        {/* Drop zone indicator */}
        {showDropZone && (
          <div className="rounded-lg border-2 border-dashed border-accent/40 p-4 text-center transition-all duration-200"
            style={{ animation: "card-settle 0.3s ease-out" }}
          >
            <p className="text-xs text-accent font-medium">Soltar aqui</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Board ────────────────────────────────────────────

export default function KanbanBoard({
  columns,
  onCardMove,
  onCardClick,
}: KanbanBoardProps) {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Find card and its column
  const findCardColumn = useCallback(
    (cardId: string) => {
      for (const col of columns) {
        if (col.cards.some((c) => c.id === cardId)) return col;
      }
      return null;
    },
    [columns]
  );

  const findCard = useCallback(
    (cardId: string) => {
      for (const col of columns) {
        const card = col.cards.find((c) => c.id === cardId);
        if (card) return card;
      }
      return null;
    },
    [columns]
  );

  // Check if target column is the next one
  const isNextColumn = useCallback(
    (fromColId: string, toColId: string) => {
      const fromIdx = columns.findIndex((c) => c.id === fromColId);
      const toIdx = columns.findIndex((c) => c.id === toColId);
      return toIdx === fromIdx + 1;
    },
    [columns]
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveCardId(event.active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    const overId = event.over?.id as string | null;
    // overId could be a column id
    if (overId && columns.some((c) => c.id === overId)) {
      setOverColumnId(overId);
    } else {
      setOverColumnId(null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const cardId = event.active.id as string;
    const targetColId = overColumnId;

    setActiveCardId(null);
    setOverColumnId(null);

    if (!targetColId || !onCardMove) return;

    const sourceCol = findCardColumn(cardId);
    if (!sourceCol) return;
    if (sourceCol.id === targetColId) return;
    if (!isNextColumn(sourceCol.id, targetColId)) return;

    // Trigger the move
    onCardMove(cardId, sourceCol.id, targetColId);

    // Highlight the card for 3 seconds
    setHighlightedCardId(cardId);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => {
      setHighlightedCardId(null);
    }, 3000);
  }

  function handleDragCancel() {
    setActiveCardId(null);
    setOverColumnId(null);
  }

  // Cleanup highlight timer
  useEffect(() => {
    return () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  }, []);

  const activeCard = activeCardId ? findCard(activeCardId) : null;
  const sourceColumn = activeCardId ? findCardColumn(activeCardId) : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-12rem)]">
        {columns.map((column) => {
          const isValid = sourceColumn
            ? isNextColumn(sourceColumn.id, column.id)
            : false;

          return (
            <DroppableColumn
              key={column.id}
              column={column}
              isValidTarget={isValid}
              isOver={overColumnId === column.id}
              activeCardId={activeCardId}
              highlightedCardId={highlightedCardId}
              onCardClick={onCardClick}
            />
          );
        })}
      </div>

      <DragOverlay dropAnimation={{
        duration: 250,
        easing: "cubic-bezier(0.25, 1, 0.5, 1)",
      }}>
        {activeCard ? <CardOverlay card={activeCard} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
