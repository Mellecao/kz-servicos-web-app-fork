"use client";

import { useState } from "react";
import { type KanbanCard, type KanbanColumn } from "@/components/KanbanBoard";

// ─── Types ─────────────────────────────────────────────────

export interface KanbanListColumn extends KanbanColumn {
  nextColumnId?: string;
  actionLabel?: string;
  actions?: {
    label: string;
    to: string;
    direction?: "forward" | "back";
  }[];
}

interface KanbanListViewProps {
  columns: KanbanListColumn[];
  onMoveCard: (cardId: string, fromColumnId: string, toColumnId: string) => void;
  onCardClick?: (card: KanbanCard) => void;
  highlightedCardId?: string | null;
}

// ─── Tab Button ────────────────────────────────────────────

function TabButton({
  label,
  selected,
  color,
  onClick,
}: {
  label: string;
  selected: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm whitespace-nowrap flex-shrink-0 transition-colors duration-150 ${
        selected
          ? "border-b-2 border-primary text-primary font-semibold"
          : "text-muted hover:text-dark"
      }`}
      style={selected && color ? { borderColor: color, color } : undefined}
    >
      {label}
    </button>
  );
}

// ─── Card Item ─────────────────────────────────────────────

function CardItem({
  card,
  column,
  onMoveCard,
  onCardClick,
  isHighlighted,
}: {
  card: KanbanCard;
  column: KanbanListColumn;
  onMoveCard: (cardId: string, fromColumnId: string, toColumnId: string) => void;
  onCardClick?: (card: KanbanCard) => void;
  isHighlighted: boolean;
}) {
  const subtitle = [card.subtitle, card.date].filter(Boolean).join(" · ");

  const showAttention = isHighlighted || card.requiresAttention;

  return (
    <div
      data-card-id={card.id}
      className={`relative rounded-xl border p-4 mb-3 ${
        showAttention
          ? "border-danger bg-background ring-2 ring-danger/70 shadow-lg shadow-danger/10"
          : "border-border bg-surface"
      }`}
    >
      {showAttention && (
        <span className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-danger text-xs font-black text-white shadow-md">
          !
        </span>
      )}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {/* Status color dot */}
          <div
            className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
            style={{ backgroundColor: column.color }}
          />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-dark text-sm truncate">{card.title}</p>
            <p className="text-muted text-xs mt-0.5">{subtitle}</p>
          </div>
        </div>
        {/* Status badge */}
        <span
          className="ml-3 flex-shrink-0 text-xs px-2 py-1 rounded-md font-medium"
          style={{
            backgroundColor: `${column.color}20`,
            color: column.color,
          }}
        >
          {column.title}
        </span>
      </div>

      {/* Tag (if present) */}
      {card.tag && (
        <div className="mb-2">
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: `${card.tagColor || "#FEBF22"}20`,
              color: card.tagColor || "#FEBF22",
            }}
          >
            {card.tag}
          </span>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-3 flex flex-col gap-2">
        <button
          onClick={() => onCardClick?.(card)}
          className="w-full text-xs py-2 rounded-lg bg-surface border border-border text-dark font-medium hover:bg-background transition-colors"
        >
          Ver detalhes
        </button>
        {column.actions?.map((action) => (
          <button
            key={`${card.id}-${action.to}`}
            onClick={() => onMoveCard(card.id, column.id, action.to)}
            className={`w-full text-xs py-2 rounded-lg border font-heading font-bold transition-colors ${
              action.direction === "back"
                ? "border-border text-contrast hover:text-dark hover:bg-background"
                : "border-primary bg-primary text-background hover:bg-primary-dark"
            }`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────

export default function KanbanListView({
  columns,
  onMoveCard,
  onCardClick,
  highlightedCardId = null,
}: KanbanListViewProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // Flatten all cards, keeping track of which column they belong to
  const allCards = columns.flatMap((col) =>
    col.cards.map((card) => ({ card, column: col }))
  );

  // Filter by selected status — "all" excludes cancelled (see "Canceladas" tab)
  const filtered =
    selectedStatus === "all"
      ? allCards.filter(({ column }) => column.id !== "cancelled")
      : allCards.filter(({ column }) => column.id === selectedStatus);

  return (
    <div>
      {/* Status filter tabs */}
      <div className="flex overflow-x-auto gap-0 border-b border-border mb-4">
        <TabButton
          label="Todas"
          selected={selectedStatus === "all"}
          onClick={() => setSelectedStatus("all")}
        />
        {columns.map((col) => (
          <TabButton
            key={col.id}
            label={col.title}
            selected={selectedStatus === col.id}
            color={col.color}
            onClick={() => setSelectedStatus(col.id)}
          />
        ))}
      </div>

      {/* Card list */}
      <div>
        {filtered.length === 0 ? (
          <p className="text-center text-muted py-8 text-sm">
            Nenhuma solicitação encontrada
          </p>
        ) : (
          filtered.map(({ card, column }) => (
            <CardItem
              key={card.id}
              card={card}
              column={column}
              onMoveCard={onMoveCard}
              onCardClick={onCardClick}
              isHighlighted={highlightedCardId === card.id}
            />
          ))
        )}
      </div>
    </div>
  );
}
