"use client";

import { useEffect, useId, useState } from "react";
import AddressAutocompleteField from "@/components/AddressAutocompleteField";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { adminUpdateTrip } from "@/lib/api";
import { buildTripPatchPayload, canEditTripRoute, validateTripPatch } from "@/lib/trip-edit";
import type { GooglePlaceAddress } from "@/lib/google-places";
import type { Trip } from "@/types/database";

interface Props { trip: Trip | null; open: boolean; onClose: () => void; onSaved: () => void; }
interface StopEntry { id: string; address: GooglePlaceAddress | null; }

function addressToGoogle(addr: Trip["pickup_address"]): GooglePlaceAddress | null {
  if (!addr) return null;
  const { formatted_address, google_place_id, latitude, longitude, street, number, neighborhood, city, state, zip_code } = addr;
  return { formatted_address, google_place_id, latitude, longitude, street, number, neighborhood, city, state, zip_code };
}

function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso || Number.isNaN(new Date(iso).getTime())) return "";
  const date = new Date(iso);
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localInputToIso(value: string): string { return new Date(value).toISOString(); }
let stopCounter = 0;
function newStopId(): string { return `stop-${++stopCounter}`; }

export default function EditTripBasicsModal({ trip, open, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const roundtripId = useId();
  const [saving, setSaving] = useState(false);
  const [pickup, setPickup] = useState<GooglePlaceAddress | null>(null);
  const [dropoff, setDropoff] = useState<GooglePlaceAddress | null>(null);
  const [scheduledDatetime, setScheduledDatetime] = useState("");
  const [originalPickup, setOriginalPickup] = useState<GooglePlaceAddress | null>(null);
  const [originalDropoff, setOriginalDropoff] = useState<GooglePlaceAddress | null>(null);
  const [originalDatetime, setOriginalDatetime] = useState("");
  const [stops, setStops] = useState<StopEntry[]>([]);
  const [originalStops, setOriginalStops] = useState<GooglePlaceAddress[]>([]);
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [returnDatetime, setReturnDatetime] = useState("");
  const [originalIsRoundTrip, setOriginalIsRoundTrip] = useState(false);
  const [originalReturnDatetime, setOriginalReturnDatetime] = useState("");
  const [returnError, setReturnError] = useState(false);
  const routeEditable = trip ? canEditTripRoute(trip.status) : false;

  useEffect(() => {
    if (!open || !trip) return;
    const nextPickup = addressToGoogle(trip.pickup_address);
    const nextDropoff = addressToGoogle(trip.dropoff_address);
    const nextDatetime = isoToLocalInput(trip.scheduled_datetime);
    const nextStops = [...(trip.trip_stops ?? [])].sort((a, b) => a.stop_order - b.stop_order)
      .map((stop) => addressToGoogle(stop.addresses)).filter((address): address is GooglePlaceAddress => address !== null);
    setPickup(nextPickup); setOriginalPickup(nextPickup);
    setDropoff(nextDropoff); setOriginalDropoff(nextDropoff);
    setScheduledDatetime(nextDatetime); setOriginalDatetime(nextDatetime);
    setStops(nextStops.map((address) => ({ id: newStopId(), address })));
    setOriginalStops(nextStops);
    setIsRoundTrip(trip.is_round_trip); setOriginalIsRoundTrip(trip.is_round_trip);
    const nextReturn = isoToLocalInput(trip.return_datetime);
    setReturnDatetime(nextReturn); setOriginalReturnDatetime(nextReturn); setReturnError(false);
  }, [open, trip]);

  async function handleSave() {
    if (!trip || !pickup || !dropoff || !scheduledDatetime) {
      toast("warning", !pickup ? "Endereço de embarque é obrigatório." : !dropoff ? "Endereço de destino é obrigatório." : "Data e hora são obrigatórias.");
      return;
    }
    const validStops = stops.map((stop) => stop.address).filter((address): address is GooglePlaceAddress => address !== null);
    const returnIso = isRoundTrip && returnDatetime ? localInputToIso(returnDatetime) : null;
    const error = validateTripPatch(
      { is_round_trip: routeEditable ? isRoundTrip : undefined, return_datetime: routeEditable ? returnIso : undefined },
      { is_round_trip: trip.is_round_trip, return_datetime: trip.return_datetime },
    );
    if (error) { setReturnError(true); toast("warning", error); return; }
    setReturnError(false);
    const payload = buildTripPatchPayload(
      { pickup: originalPickup!, dropoff: originalDropoff!, scheduled_datetime: originalDatetime ? localInputToIso(originalDatetime) : trip.scheduled_datetime, stops: originalStops, is_round_trip: originalIsRoundTrip, return_datetime: originalReturnDatetime ? localInputToIso(originalReturnDatetime) : trip.return_datetime },
      { pickup, dropoff, scheduled_datetime: localInputToIso(scheduledDatetime), stops: routeEditable ? validStops : originalStops, is_round_trip: routeEditable ? isRoundTrip : originalIsRoundTrip, return_datetime: routeEditable ? returnIso : trip.return_datetime },
    );
    if (!payload) { onClose(); return; }
    setSaving(true);
    try { await adminUpdateTrip(trip.id, payload); toast("success", "Viagem atualizada."); onSaved(); onClose(); }
    catch (err) { toast("danger", err instanceof Error && err.message ? err.message : "Erro ao atualizar viagem."); }
    finally { setSaving(false); }
  }

  function moveStop(index: number, direction: -1 | 1) {
    setStops((previous) => {
      const target = index + direction;
      if (target < 0 || target >= previous.length) return previous;
      const next = [...previous]; [next[index], next[target]] = [next[target], next[index]]; return next;
    });
  }

  const footer = <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border"><button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 text-sm font-body text-contrast hover:text-dark disabled:opacity-50">Cancelar</button><button type="button" onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-lg bg-primary text-background font-heading font-bold text-sm hover:bg-primary-dark disabled:opacity-50">{saving ? "Salvando..." : "Salvar"}</button></div>;

  return <Modal open={open} onClose={onClose} title="Editar viagem" footer={footer}>
    <div className="flex flex-col gap-4">
      <AddressAutocompleteField label="Endereço de embarque" value={pickup} onChange={setPickup} disabled={saving} />
      <AddressAutocompleteField label="Endereço de destino" value={dropoff} onChange={setDropoff} disabled={saving} />
      <div><label className="block text-sm font-body text-contrast mb-1">Data e hora</label><input type="datetime-local" value={scheduledDatetime} onChange={(event) => setScheduledDatetime(event.target.value)} disabled={saving} className="w-full rounded-lg bg-background border border-border text-dark focus:ring-primary focus:ring-1 focus:outline-none px-3 py-2 text-sm font-body disabled:opacity-50" /></div>
      {!routeEditable && <p className="rounded-lg bg-surface border border-border px-3 py-2 text-xs font-body text-contrast">Paradas e ida e volta não podem ser alteradas após o início da viagem.</p>}
      <div><p className="text-sm font-body text-contrast mb-2">Paradas no percurso</p><div className="flex flex-col gap-2">{stops.map((stop, index) => <div key={stop.id} className="rounded-lg border border-border bg-surface p-3 flex flex-col gap-2"><div className="flex items-center justify-between"><span className="text-xs font-body text-contrast">Parada {index + 1}</span><div className="flex gap-1"><button type="button" onClick={() => moveStop(index, -1)} disabled={saving || !routeEditable || index === 0} className="px-1.5 py-0.5 text-xs rounded border border-border hover:bg-surface-hover disabled:opacity-30" aria-label="Mover para cima">↑</button><button type="button" onClick={() => moveStop(index, 1)} disabled={saving || !routeEditable || index === stops.length - 1} className="px-1.5 py-0.5 text-xs rounded border border-border hover:bg-surface-hover disabled:opacity-30" aria-label="Mover para baixo">↓</button><button type="button" onClick={() => setStops((previous) => previous.filter((item) => item.id !== stop.id))} disabled={saving || !routeEditable} className="px-1.5 py-0.5 text-xs rounded border border-border text-danger hover:bg-surface-hover disabled:opacity-30" aria-label="Remover parada">✕</button></div></div><AddressAutocompleteField label="" placeholder="Endereço da parada" value={stop.address} onChange={(address) => setStops((previous) => previous.map((item) => item.id === stop.id ? { ...item, address } : item))} disabled={saving || !routeEditable} /></div>)}</div><button type="button" onClick={() => setStops((previous) => [...previous, { id: newStopId(), address: null }])} disabled={saving || !routeEditable} className="mt-2 rounded-lg border border-border px-3 py-1.5 text-xs font-heading font-bold text-dark hover:border-primary hover:text-primary disabled:opacity-30">+ Adicionar parada</button></div>
      <div className="flex flex-col gap-2"><label className="flex items-center gap-2 cursor-pointer"><input id={roundtripId} type="checkbox" checked={isRoundTrip} onChange={(event) => { setIsRoundTrip(event.target.checked); if (!event.target.checked) { setReturnDatetime(""); setReturnError(false); } }} disabled={saving || !routeEditable} className="rounded border-border bg-background text-primary focus:ring-primary disabled:opacity-50 cursor-pointer" /><span className="text-sm font-body text-dark">Ida e volta</span></label>{isRoundTrip && <div><label className="block text-sm font-body text-contrast mb-1">Data/hora retorno</label><input type="datetime-local" value={returnDatetime} onChange={(event) => { setReturnDatetime(event.target.value); setReturnError(false); }} disabled={saving || !routeEditable} className={`w-full rounded-lg bg-background border text-dark focus:ring-1 focus:outline-none px-3 py-2 text-sm font-body disabled:opacity-50 ${returnError ? "border-danger focus:ring-danger" : "border-border focus:ring-primary"}`} />{returnError && <p className="mt-1 text-xs text-danger font-body">Data/hora de retorno é obrigatória.</p>}</div>}</div>
    </div>
  </Modal>;
}
