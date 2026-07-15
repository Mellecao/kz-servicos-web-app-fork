"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import AddressAutocompleteField from "@/components/AddressAutocompleteField";
import { useToast } from "@/components/Toast";
import { adminUpdateTripBasics } from "@/lib/api";
import type { GooglePlaceAddress } from "@/lib/google-places";
import type { Trip } from "@/types/database";

interface Props {
  trip: Trip | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function addressToGoogle(
  addr:
    | {
        formatted_address: string;
        google_place_id: string | null;
        latitude: number | null;
        longitude: number | null;
        street: string | null;
        number: string | null;
        neighborhood: string | null;
        city: string | null;
        state: string | null;
        zip_code: string | null;
      }
    | null
    | undefined,
): GooglePlaceAddress | null {
  if (!addr) return null;
  return {
    formatted_address: addr.formatted_address,
    google_place_id: addr.google_place_id,
    latitude: addr.latitude,
    longitude: addr.longitude,
    street: addr.street,
    number: addr.number,
    neighborhood: addr.neighborhood,
    city: addr.city,
    state: addr.state,
    zip_code: addr.zip_code,
  };
}

function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localInputToIso(local: string): string {
  return new Date(local).toISOString();
}

function isSameAddress(
  a: GooglePlaceAddress | null,
  b: GooglePlaceAddress | null,
): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (a.google_place_id && b.google_place_id) {
    return a.google_place_id === b.google_place_id;
  }
  return a.formatted_address === b.formatted_address;
}

export default function EditTripBasicsModal({
  trip,
  open,
  onClose,
  onSaved,
}: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [pickup, setPickup] = useState<GooglePlaceAddress | null>(null);
  const [dropoff, setDropoff] = useState<GooglePlaceAddress | null>(null);
  const [scheduledDatetime, setScheduledDatetime] = useState("");
  const [originalPickup, setOriginalPickup] = useState<GooglePlaceAddress | null>(null);
  const [originalDropoff, setOriginalDropoff] = useState<GooglePlaceAddress | null>(null);
  const [originalDatetime, setOriginalDatetime] = useState("");

  useEffect(() => {
    if (!open || !trip) return;
    const p = addressToGoogle(trip.pickup_address);
    const d = addressToGoogle(trip.dropoff_address);
    const dt = isoToLocalInput(trip.scheduled_datetime);
    setPickup(p);
    setDropoff(d);
    setScheduledDatetime(dt);
    setOriginalPickup(p);
    setOriginalDropoff(d);
    setOriginalDatetime(dt);
  }, [open, trip]);

  async function handleSave() {
    if (!trip) return;
    if (!pickup) {
      toast("warning", "Endereço de embarque é obrigatório.");
      return;
    }
    if (!dropoff) {
      toast("warning", "Endereço de destino é obrigatório.");
      return;
    }
    if (!scheduledDatetime) {
      toast("warning", "Data e hora são obrigatórias.");
      return;
    }

    const updates: {
      pickup?: GooglePlaceAddress;
      dropoff?: GooglePlaceAddress;
      scheduled_datetime?: string;
    } = {};
    if (!isSameAddress(pickup, originalPickup)) updates.pickup = pickup;
    if (!isSameAddress(dropoff, originalDropoff)) updates.dropoff = dropoff;
    if (scheduledDatetime !== originalDatetime) {
      updates.scheduled_datetime = localInputToIso(scheduledDatetime);
    }

    if (Object.keys(updates).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      await adminUpdateTripBasics(trip.id, updates);
      toast("success", "Viagem atualizada.");
      onSaved();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      toast("danger", message || "Erro ao atualizar viagem.");
    } finally {
      setSaving(false);
    }
  }

  const footer = (
    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        className="px-4 py-2 text-sm font-body text-contrast hover:text-dark disabled:opacity-50"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="px-5 py-2 rounded-lg bg-primary text-background font-heading font-bold text-sm hover:bg-primary-dark disabled:opacity-50"
      >
        {saving ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title="Editar viagem" footer={footer}>
      <div className="flex flex-col gap-4">
        <AddressAutocompleteField
          label="Endereço de embarque"
          value={pickup}
          onChange={setPickup}
          disabled={saving}
        />
        <AddressAutocompleteField
          label="Endereço de destino"
          value={dropoff}
          onChange={setDropoff}
          disabled={saving}
        />
        <div>
          <label className="block text-sm font-body text-contrast mb-1">
            Data e hora
          </label>
          <input
            type="datetime-local"
            value={scheduledDatetime}
            onChange={(e) => setScheduledDatetime(e.target.value)}
            disabled={saving}
            className="w-full rounded-lg bg-background border border-border text-dark focus:ring-primary focus:ring-1 focus:outline-none px-3 py-2 text-sm font-body disabled:opacity-50"
          />
        </div>
      </div>
    </Modal>
  );
}
