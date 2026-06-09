"use client";

import { useEffect, useRef, useCallback } from "react";
import { useIsMobile } from "@/lib/hooks";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: ModalProps) {
  const isMobile = useIsMobile();
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);

  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const overlay = overlayRef.current;
    const content = contentRef.current;
    if (overlay) overlay.style.animation = "fade-out 300ms ease-in forwards";
    if (content)
      content.style.animation = isMobile
        ? "slide-down 300ms ease-in forwards"
        : "modal-out 300ms ease-in forwards";
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

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
        style={{ animation: "fade-in 200ms ease-out forwards" }}
        onClick={handleClose}
        aria-hidden
      />
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={
          isMobile === true
            ? "fixed bottom-0 inset-x-0 bg-surface border border-border rounded-t-2xl flex flex-col max-h-[90vh] overflow-y-auto"
            : "relative w-full max-w-lg mx-4 bg-surface border border-border rounded-xl flex flex-col max-h-[90vh]"
        }
        style={{
          animation:
            isMobile === true
              ? "slide-up 300ms ease-out forwards"
              : "modal-in 300ms ease-out forwards",
        }}
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
        {footer && <div className="shrink-0">{footer}</div>}
      </div>
    </div>
  );
}
