import { supabase } from "@/lib/supabase";
import { logAdminAction } from "@/lib/api";
import { TRIPS_ENABLED_KEY, parseTripsEnabled } from "@/lib/trips-enabled";

// system_settings.trips_enabled (jsonb boolean). Leitura: qualquer sessão autenticada
// pode ler esta chave; escrita: só admin (RLS). Nada de viagens é apagado.

/** Lê o interruptor. Falha (RLS, rede, chave em falta) conta como DESLIGADO, nunca como ligado. */
export async function fetchTripsEnabled(): Promise<boolean> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", TRIPS_ENABLED_KEY)
    .maybeSingle();
  if (error) {
    console.error("[trips_enabled] falha ao ler o interruptor; tratado como desligado:", error.message);
    return false;
  }
  return parseTripsEnabled(data?.value);
}

/** Liga ou desliga as viagens. Lança erro se a escrita não chegar a alterar a linha (ex.: sem permissão). */
export async function updateTripsEnabled(enabled: boolean): Promise<void> {
  const { data, error } = await supabase
    .from("system_settings")
    .update({ value: enabled })
    .eq("key", TRIPS_ENABLED_KEY)
    .select("key");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Não foi possível alterar as caronas (sem permissão, ou a definição não existe).");
  }
  logAdminAction(
    enabled ? "Caronas ativadas" : "Caronas desativadas",
    null,
    { key: TRIPS_ENABLED_KEY, enabled },
    "setting"
  );
}
