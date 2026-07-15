"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { FormEvent, KeyboardEvent } from "react";
import {
  fetchSupportConversationByProvider,
  fetchSupportMessages,
  markSupportMessagesRead,
  sendSupportMessage,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import type { SupportConversation, SupportMessage } from "@/types/database";

function mergeMessages(current: SupportMessage[], incoming: SupportMessage[]) {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

function formatMessageTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SupportConversationPage() {
  const params = useParams<{ providerId: string }>();
  const providerId = params.providerId;
  const { userProfile, session } = useAuth();
  const { toast } = useToast();
  const currentUserId = userProfile?.id ?? session?.user.id ?? "";
  const [conversation, setConversation] = useState<SupportConversation | null>(
    null,
  );
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const markRead = useCallback(
    async (conversationId: string) => {
      if (!currentUserId) return;
      try {
        await markSupportMessagesRead(conversationId, currentUserId);
      } catch (readError) {
        console.error("Erro ao marcar suporte como lido:", readError);
      }
    },
    [currentUserId],
  );

  const loadConversation = useCallback(async () => {
    try {
      const nextConversation =
        await fetchSupportConversationByProvider(providerId);
      if (!nextConversation) {
        setError("Conversa não encontrada.");
        setConversation(null);
        return;
      }

      const nextMessages = await fetchSupportMessages(nextConversation.id);
      setConversation(nextConversation);
      setMessages(nextMessages);
      setHasMore(nextMessages.length === 50);
      setError(null);
      await markRead(nextConversation.id);
      requestAnimationFrame(() =>
        bottomRef.current?.scrollIntoView({ behavior: "auto" }),
      );
    } catch (loadError) {
      console.error("Erro ao carregar conversa de suporte:", loadError);
      setError("Não foi possível carregar esta conversa.");
    } finally {
      setLoading(false);
    }
  }, [markRead, providerId]);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  useEffect(() => {
    if (!conversation) return;
    const conversationId = conversation.id;
    const channel = supabase
      .channel(`admin-support-messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            setMessages((current) =>
              current.filter((message) => message.id !== payload.old.id),
            );
            return;
          }

          if (payload.eventType === "UPDATE") {
            setMessages((current) =>
              current.map((message) =>
                message.id === payload.new.id
                  ? {
                      ...message,
                      is_read: Boolean(payload.new.is_read),
                      read_at: (payload.new.read_at as string | null) ?? null,
                    }
                  : message,
              ),
            );
            return;
          }

          try {
            const latest = await fetchSupportMessages(conversationId);
            setMessages((current) => mergeMessages(current, latest));
            const senderId = `${payload.new.sender_id ?? ""}`;
            if (senderId && senderId !== currentUserId) {
              await markRead(conversationId);
            }
            requestAnimationFrame(() =>
              bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
            );
          } catch (realtimeError) {
            console.error("Erro ao atualizar chat em tempo real:", realtimeError);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversation, currentUserId, markRead]);

  async function loadOlderMessages() {
    if (!conversation || !messages[0] || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const older = await fetchSupportMessages(conversation.id, {
        before: messages[0].created_at,
      });
      setMessages((current) => mergeMessages(older, current));
      setHasMore(older.length === 50);
    } catch {
      toast("danger", "Não foi possível carregar mensagens anteriores");
    } finally {
      setLoadingOlder(false);
    }
  }

  async function handleSend(event?: FormEvent) {
    event?.preventDefault();
    const message = draft.trim();
    if (!conversation || !currentUserId || !message || sending) return;
    setSending(true);
    try {
      await sendSupportMessage(conversation.id, currentUserId, message);
      setDraft("");
    } catch {
      toast("danger", "Não foi possível enviar a mensagem");
    } finally {
      setSending(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100dvh-9rem)] items-center justify-center text-sm text-contrast">
        Carregando conversa...
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="flex min-h-[calc(100dvh-9rem)] flex-col items-center justify-center text-center">
        <p className="text-sm font-semibold text-dark">{error}</p>
        <Link
          href="/chats"
          className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-dark hover:border-primary hover:text-primary"
        >
          Voltar para chats
        </Link>
      </div>
    );
  }

  const providerName = conversation.provider?.full_name ?? "Prestador";

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-9rem)] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <header className="flex min-h-16 items-center gap-3 border-b border-border px-3 py-3 md:px-4">
        <Link
          href="/chats"
          aria-label="Voltar para chats"
          title="Voltar"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-contrast hover:bg-surface-hover hover:text-dark"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-heading font-black text-dark">
            {providerName}
          </h1>
          <p className="truncate text-xs text-contrast">
            {conversation.provider?.phone ?? conversation.provider?.email}
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-background px-3 py-4 md:px-6">
        {hasMore && (
          <div className="mb-4 text-center">
            <button
              type="button"
              onClick={loadOlderMessages}
              disabled={loadingOlder}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-contrast hover:text-dark disabled:opacity-50"
            >
              {loadingOlder ? "Carregando..." : "Carregar anteriores"}
            </button>
          </div>
        )}

        {messages.map((message) => {
          const isFromKz = message.sender?.role === "admin";
          return (
            <div
              key={message.id}
              className={`mb-2 flex ${isFromKz ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 md:max-w-[70%] ${
                  isFromKz
                    ? "bg-primary text-background"
                    : "border border-border bg-surface text-dark"
                }`}
              >
                {!isFromKz && (
                  <p className="mb-1 text-[11px] font-bold text-primary">
                    {providerName}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {message.message}
                </p>
                <p
                  className={`mt-1 text-right text-[10px] ${
                    isFromKz ? "text-background/70" : "text-contrast"
                  }`}
                >
                  {formatMessageTime(message.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSend}
        className="flex items-end gap-2 border-t border-border bg-surface p-3 md:p-4"
      >
        <label htmlFor="support-message" className="sr-only">
          Mensagem
        </label>
        <textarea
          id="support-message"
          rows={1}
          maxLength={4000}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleComposerKeyDown}
          placeholder="Escreva uma resposta"
          className="max-h-32 min-h-11 flex-1 resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-dark placeholder:text-contrast/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          aria-label="Enviar mensagem"
          title="Enviar"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-background hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-background/40 border-t-background" />
          ) : (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
