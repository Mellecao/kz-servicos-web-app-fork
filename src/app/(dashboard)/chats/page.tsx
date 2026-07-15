"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchSupportConversations } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { SupportConversation } from "@/types/database";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatListTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

export default function ChatsPage() {
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const rows = await fetchSupportConversations();
      setConversations(rows);
      setError(null);
    } catch (loadError) {
      console.error("Erro ao carregar chats de suporte:", loadError);
      setError("Não foi possível carregar as conversas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();

    const channel = supabase
      .channel("admin-support-conversations")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_conversations",
        },
        () => void loadConversations(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadConversations]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    if (!query) return conversations;
    return conversations.filter((conversation) => {
      const provider = conversation.provider;
      return [provider?.full_name, provider?.email, provider?.phone].some(
        (value) => value?.toLocaleLowerCase("pt-BR").includes(query),
      );
    });
  }, [conversations, search]);

  const unreadTotal = conversations.reduce(
    (total, conversation) => total + conversation.unread_admin_count,
    0,
  );

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-heading font-black text-dark md:text-3xl">
            Chats
          </h1>
          <p className="mt-1 text-sm text-contrast">
            Conversas de suporte com prestadores
          </p>
        </div>
        {unreadTotal > 0 && (
          <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-background">
            {unreadTotal} não {unreadTotal === 1 ? "lida" : "lidas"}
          </span>
        )}
      </div>

      <div className="mb-4">
        <label htmlFor="support-chat-search" className="sr-only">
          Buscar conversa
        </label>
        <input
          id="support-chat-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nome, e-mail ou telefone"
          className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-dark placeholder:text-contrast/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-surface">
        {loading ? (
          <div className="space-y-1 p-2" aria-label="Carregando conversas">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="flex animate-pulse items-center gap-3 p-3">
                <div className="h-11 w-11 rounded-full bg-border" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 rounded bg-border" />
                  <div className="h-3 w-3/4 rounded bg-border/70" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-semibold text-dark">{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void loadConversations();
              }}
              className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-dark hover:border-primary hover:text-primary"
            >
              Tentar novamente
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="text-sm font-semibold text-dark">
              {search ? "Nenhuma conversa encontrada" : "Nenhuma mensagem recebida"}
            </p>
            <p className="mt-1 text-xs text-contrast">
              {search
                ? "Revise os termos da busca."
                : "As conversas aparecerão aqui quando um prestador escrever."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((conversation) => {
              const provider = conversation.provider;
              const name = provider?.full_name ?? "Prestador";
              const lastFromAdmin =
                conversation.last_sender_id !== conversation.provider_user_id;
              return (
                <Link
                  key={conversation.id}
                  href={`/chats/${conversation.provider_user_id}`}
                  className="flex min-h-20 items-center gap-3 px-3 py-3 transition-colors hover:bg-surface-hover md:px-4"
                >
                  {provider?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={provider.avatar_url}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-full border border-border object-cover"
                    />
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {initials(name)}
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-heading font-bold text-dark">
                        {name}
                      </p>
                      <time className="shrink-0 text-[11px] text-contrast">
                        {formatListTime(conversation.last_message_at)}
                      </time>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-xs text-contrast">
                        {lastFromAdmin ? "KZ: " : ""}
                        {conversation.last_message_preview}
                      </p>
                      {conversation.unread_admin_count > 0 && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-background">
                          {conversation.unread_admin_count > 99
                            ? "99+"
                            : conversation.unread_admin_count}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
