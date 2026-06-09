"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from "react";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string, label: string) => void;
  placeholder?: string;
  error?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onSearchChange?: (query: string) => void;
  actionButton?: {
    label: string;
    onClick: () => void;
  };
}

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <strong key={i} className="font-bold text-dark">
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Selecione...",
  error = false,
  loading = false,
  disabled = false,
  onSearchChange,
  actionButton,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Find current label for display
  const selectedOption = options.find((o) => o.value === value);

  const filtered = onSearchChange
    ? options // async mode: options are already filtered by parent
    : options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase())
      );

  const close = useCallback(() => {
    setIsOpen(false);
    setHighlightedIndex(-1);
    // Restore display text to selected option
    if (selectedOption) {
      setSearch(selectedOption.label);
    } else {
      setSearch("");
    }
  }, [selectedOption]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, close]);

  // Sync search text when value changes externally
  useEffect(() => {
    if (selectedOption) {
      setSearch(selectedOption.label);
    } else if (!value) {
      setSearch("");
    }
  }, [value, selectedOption]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  function handleInputChange(text: string) {
    setSearch(text);
    setHighlightedIndex(-1);
    if (!isOpen) setIsOpen(true);
    onSearchChange?.(text);
  }

  function handleSelect(option: SearchableSelectOption) {
    onChange(option.value, option.label);
    setSearch(option.label);
    setIsOpen(false);
    setHighlightedIndex(-1);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const totalItems = filtered.length + (actionButton ? 1 : 0);

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex((prev) =>
            prev < totalItems - 1 ? prev + 1 : 0
          );
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : totalItems - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
          handleSelect(filtered[highlightedIndex]);
        } else if (
          actionButton &&
          highlightedIndex === filtered.length
        ) {
          actionButton.onClick();
          setIsOpen(false);
        }
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
    }
  }

  const borderClass = error
    ? "border-danger"
    : isOpen
      ? "border-primary ring-1 ring-primary"
      : "border-border";

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex items-center rounded-lg bg-background border ${borderClass} transition-colors duration-150`}
      >
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full bg-transparent text-dark placeholder:text-contrast/40 focus:outline-none px-3 py-2 text-sm font-body"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls="searchable-select-list"
        />
        {/* Chevron */}
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            if (isOpen) {
              close();
            } else {
              setIsOpen(true);
              inputRef.current?.focus();
            }
          }}
          className="px-2 text-contrast hover:text-dark cursor-pointer shrink-0"
          aria-label="Abrir lista"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <ul
          ref={listRef}
          id="searchable-select-list"
          role="listbox"
          className="absolute z-[300] mt-1 w-full max-h-60 overflow-y-auto rounded-lg bg-surface border border-border shadow-lg"
        >
          {loading && (
            <li className="px-3 py-2 text-sm text-contrast">
              Carregando...
            </li>
          )}

          {!loading && filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-contrast">
              Nenhum resultado encontrado
            </li>
          )}

          {!loading &&
            filtered.map((option, index) => (
              <li
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                className={`px-3 py-2 text-sm font-body cursor-pointer transition-colors duration-100 ${
                  index === highlightedIndex
                    ? "bg-surface-hover text-dark"
                    : option.value === value
                      ? "text-primary"
                      : "text-dark hover:bg-surface-hover"
                }`}
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(option);
                }}
              >
                {highlightMatch(option.label, search)}
              </li>
            ))}

          {/* Action button (e.g. "+ Novo Cliente") */}
          {actionButton && (
            <li
              className={`px-3 py-2 text-sm font-body cursor-pointer border-t border-border transition-colors duration-100 ${
                highlightedIndex === filtered.length
                  ? "bg-surface-hover text-primary"
                  : "text-primary hover:bg-surface-hover"
              }`}
              onMouseEnter={() => setHighlightedIndex(filtered.length)}
              onMouseDown={(e) => {
                e.preventDefault();
                actionButton.onClick();
                setIsOpen(false);
              }}
            >
              {actionButton.label}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
