"use client";

import { useEffect, useRef, useCallback } from "react";
import { useIsMobile } from "@/lib/hooks";

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function SlidePanel({
  open,
  onClose,
  title,
  children,
  footer,
}: SlidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const isMobile = useIsMobile();

  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const panel = panelRef.current;
    const backdrop = panel?.parentElement?.querySelector("[data-backdrop]");
    if (isMobile) {
      if (panel) panel.classList.remove("slide-up");
      if (panel) panel.classList.add("slide-down");
    } else {
      if (panel) panel.style.animation = "slide-out-right 200ms ease-in forwards";
    }
    if (backdrop)
      (backdrop as HTMLElement).style.animation =
        "fade-out 200ms ease-in forwards";
    setTimeout(() => {
      closingRef.current = false;
      onClose();
    }, 300);
  }, [onClose, isMobile]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, handleClose]);

  if (!open) return null;

  if (isMobile === true) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col justify-end">
        {/* Backdrop */}
        <div
          data-backdrop
          className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
          style={{ animation: "fade-in 200ms ease-out forwards" }}
          onClick={handleClose}
          aria-hidden
        />

        {/* Full-screen panel sliding up from bottom */}
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="slide-up relative w-full bg-surface flex flex-col h-full"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <h2 className="text-lg font-heading font-bold text-dark">{title}</h2>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-contrast hover:text-dark hover:bg-surface-hover transition-all duration-150 cursor-pointer"
              aria-label="Fechar"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="shrink-0 px-6 py-4 border-t border-border">
              {footer}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop: slide in from the right
  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop — glass effect */}
      <div
        data-backdrop
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
        style={{ animation: "fade-in 200ms ease-out forwards" }}
        onClick={handleClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-[600px] bg-surface border-l border-border flex flex-col h-full"
        style={{ animation: "slide-in-right 300ms ease-out forwards" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-heading font-bold text-dark">{title}</h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-contrast hover:text-dark hover:bg-surface-hover transition-all duration-150 cursor-pointer"
            aria-label="Fechar"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="shrink-0 px-6 py-4 border-t border-border">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
