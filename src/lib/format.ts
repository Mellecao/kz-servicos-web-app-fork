/**
 * Formatadores de Angola (única fonte): Kwanza, datas em Africa/Luanda,
 * telefone +244 e documento BI / NIF.
 *
 * Só sintaxe apagável (sem enums nem parameter properties): os testes em
 * format.test.mjs correm este ficheiro diretamente no Node (npm test).
 */

export const APP_LOCALE = "pt-AO";
export const APP_TIME_ZONE = "Africa/Luanda";

const EMPTY = "—";
const COUNTRY_CODE = "244";
const NATIONAL_PHONE = /^[92]\d{8}$/;

type DateInput = string | number | Date | null | undefined;

// ─── Kwanza ────────────────────────────────────────────────

/** 1500 → "1.500,00 Kz". Nulo, NaN ou infinito → "—". */
export function formatKz(
  value: number | null | undefined,
  { decimals = 2 }: { decimals?: 0 | 2 } = {}
): string {
  if (value == null || !Number.isFinite(value)) return EMPTY;
  const fixed = Math.abs(value).toFixed(decimals);
  const [integer, fraction] = fixed.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const negative = value < 0 && Number(fixed) !== 0;
  return `${negative ? "-" : ""}${grouped}${fraction ? `,${fraction}` : ""} Kz`;
}

// ─── Datas (Africa/Luanda, 24 h) ───────────────────────────

const partsFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const longDateFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function toDate(input: DateInput): Date | null {
  if (input == null || input === "") return null;
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

function partsOf(date: Date): Record<string, string> {
  const parts: Record<string, string> = {};
  for (const part of partsFormatter.formatToParts(date)) parts[part.type] = part.value;
  return parts;
}

/** "05/11/2026" */
export function formatDate(input: DateInput): string {
  const date = toDate(input);
  if (!date) return EMPTY;
  const p = partsOf(date);
  return `${p.day}/${p.month}/${p.year}`;
}

/** "05/11/2026 13:00" (ou com segundos: "05/11/2026 13:00:09") */
export function formatDateTime(
  input: DateInput,
  { seconds = false }: { seconds?: boolean } = {}
): string {
  const date = toDate(input);
  if (!date) return EMPTY;
  const p = partsOf(date);
  const time = `${p.hour}:${p.minute}${seconds ? `:${p.second}` : ""}`;
  return `${p.day}/${p.month}/${p.year} ${time}`;
}

/** "05/11" */
export function formatDayMonth(input: DateInput): string {
  const date = toDate(input);
  if (!date) return EMPTY;
  const p = partsOf(date);
  return `${p.day}/${p.month}`;
}

/** "quinta-feira, 5 de novembro de 2026" */
export function formatDateLong(input: DateInput): string {
  const date = toDate(input);
  return date ? longDateFormatter.format(date) : EMPTY;
}

/**
 * Mês curto ("nov") de uma data construída com aritmética de calendário local
 * (new Date(ano, mês, 1)): por isso formata no fuso local, de propósito.
 */
export function formatMonthShort(date: Date): string {
  return new Intl.DateTimeFormat(APP_LOCALE, { month: "short" }).format(date).replace(".", "");
}

// ─── Telefone de Angola ────────────────────────────────────

/** Dígitos nacionais, sem o indicativo 244 (explícito com +/00, ou implícito se houver mais de 9 dígitos). */
function nationalDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (/^\s*(\+|00)/.test(raw)) return digits.replace(/^(00)?244/, "");
  return digits.length > 9 && digits.startsWith(COUNTRY_CODE)
    ? digits.slice(COUNTRY_CODE.length)
    : digits;
}

function groupPhone(national: string): string {
  return `+${COUNTRY_CODE} ${national.replace(/(\d{3})(?=\d)/g, "$1 ")}`;
}

/** Móvel: 9 dígitos começados por 9. Fixo de Luanda: 9 dígitos começados por 2. */
export function isValidPhoneAO(raw: string): boolean {
  return NATIONAL_PHONE.test(nationalDigits(raw));
}

/**
 * "+244 923 456 789". Número que não seja de Angola (valor legado na BD)
 * devolve-se tal como está; nulo ou vazio → "—".
 */
export function formatPhoneAO(raw: string | null | undefined): string {
  if (raw == null || raw.trim() === "") return EMPTY;
  const national = nationalDigits(raw);
  return NATIONAL_PHONE.test(national) ? groupPhone(national) : raw.trim();
}

/** E.164 sem espaços ("+244923456789") para gravar; null se não for número de Angola válido. */
export function toE164AO(raw: string): string | null {
  const national = nationalDigits(raw);
  return NATIONAL_PHONE.test(national) ? `+${COUNTRY_CODE}${national}` : null;
}

/**
 * Pesquisa por telefone comparando só dígitos (ignora espaços, "+" e hífenes),
 * por isso encontra "923 456" num valor guardado como "+244923456789" ou como
 * valor legado. Sem dígitos na pesquisa ou sem telefone → false.
 */
export function phoneMatches(phone: string | null | undefined, query: string): boolean {
  const wanted = query.replace(/\D/g, "");
  if (!wanted || !phone) return false;
  return phone.replace(/\D/g, "").includes(wanted);
}

/** Máscara para <input>: aplica "+244 9XX XXX XXX" enquanto se escreve. */
export function maskPhoneAO(raw: string): string {
  const national = nationalDigits(raw).slice(0, 9);
  return national ? groupPhone(national) : "";
}

// ─── Documento BI / NIF (permissivo) ───────────────────────

/** Tira separadores e põe maiúsculas. */
export function normalizeDocumentAO(raw: string): string {
  return raw.replace(/[\s.\-/]/g, "").toUpperCase();
}

/** Alfanumérico, 9 a 14 caracteres. */
export function isValidDocumentAO(raw: string): boolean {
  return /^[A-Z0-9]{9,14}$/.test(normalizeDocumentAO(raw));
}

// ─── Campos de formulário: só valida e normaliza o que foi editado ──
// Valores legados na BD (telefone +55, CPF com pontos) não podem bloquear a
// gravação de outros campos nem ser reescritos em silêncio: se o campo não
// mudou face ao original, nem se valida nem se transforma.

export const PHONE_ERROR = "Telemóvel inválido. Use o formato +244 9XX XXX XXX.";
export const DOCUMENT_ERROR = "BI / NIF inválido. Use entre 9 e 14 letras ou números.";

function isUnchanged(current: string, original: string | null | undefined): boolean {
  return current.trim() === (original ?? "").trim();
}

/** Mensagem de erro do telemóvel, ou null se estiver vazio, inalterado ou válido. */
export function phoneError(current: string, original: string | null | undefined): string | null {
  const value = current.trim();
  if (!value || isUnchanged(current, original)) return null;
  return isValidPhoneAO(value) ? null : PHONE_ERROR;
}

/** Valor a gravar: null se vazio; igual ao original se inalterado; senão E.164 sem espaços. */
export function phoneToSave(current: string, original: string | null | undefined): string | null {
  const value = current.trim();
  if (!value) return null;
  return isUnchanged(current, original) ? value : (toE164AO(value) ?? value);
}

/** Mensagem de erro do BI / NIF, ou null se estiver vazio, inalterado ou válido. */
export function documentError(current: string, original: string | null | undefined): string | null {
  const value = current.trim();
  if (!value || isUnchanged(current, original)) return null;
  return isValidDocumentAO(value) ? null : DOCUMENT_ERROR;
}

/** Valor a gravar: null se vazio; igual ao original se inalterado; senão normalizado. */
export function documentToSave(current: string, original: string | null | undefined): string | null {
  const value = current.trim();
  if (!value) return null;
  return isUnchanged(current, original) ? value : normalizeDocumentAO(value);
}
