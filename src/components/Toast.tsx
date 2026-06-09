"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";

type ToastType = "success" | "info" | "warning" | "danger";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  removing?: boolean;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const TOAST_DURATION = 4000;

const icons: Record<ToastType, React.ReactNode> = {
  success: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  info: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  warning: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  danger: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
};

const colors: Record<ToastType, { bg: string; border: string; text: string; progress: string }> = {
  success: { bg: "rgba(34,197,94,0.08)", border: "#22C55E", text: "#22C55E", progress: "#22C55E" },
  info: { bg: "rgba(148,163,184,0.08)", border: "#94A3B8", text: "#94A3B8", progress: "#94A3B8" },
  warning: { bg: "rgba(245,158,11,0.08)", border: "#F59E0B", text: "#F59E0B", progress: "#F59E0B" },
  danger: { bg: "rgba(239,68,68,0.08)", border: "#EF4444", text: "#EF4444", progress: "#EF4444" },
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { bg, border, text, progress } = colors[toast.type];

  useEffect(() => {
    timerRef.current = setTimeout(() => onRemove(toast.id), TOAST_DURATION);
    return () => clearTimeout(timerRef.current);
  }, [toast.id, onRemove]);

  return (
    <div
      role="alert"
      className="relative overflow-hidden rounded-lg border backdrop-blur-md pointer-events-auto"
      style={{
        backgroundColor: bg,
        borderColor: border,
        animation: toast.removing
          ? "toast-out 200ms ease-in forwards"
          : "toast-in 300ms ease-out forwards",
      }}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="shrink-0 mt-0.5" style={{ color: text }}>{icons[toast.type]}</span>
        <p className="text-sm text-dark flex-1">{toast.message}</p>
        <button
          onClick={() => onRemove(toast.id)}
          className="shrink-0 text-contrast hover:text-dark transition-colors cursor-pointer"
          aria-label="Fechar"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      {/* Progress bar */}
      <div className="h-0.5 w-full" style={{ backgroundColor: `${border}20` }}>
        <div
          className="h-full"
          style={{
            backgroundColor: progress,
            animation: `toast-progress ${TOAST_DURATION}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, removing: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
  }, []);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  return (
    <ToastContext value={{ toast: addToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 w-96 max-w-[calc(100vw-2rem)] pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext>
  );
}
