"use client";

import { useState, useEffect, useMemo, useRef, type FormEvent } from "react";
import SlidePanel from "@/components/SlidePanel";
import SearchableSelect from "@/components/SearchableSelect";
import AddressAutocompleteWithSuggestions from "@/components/AddressAutocompleteWithSuggestions";
import NovoClienteForm from "@/components/forms/NovoClienteForm";
import { useToast } from "@/components/Toast";
import {
  adminCreateTrip,
  fetchClientAddressHistory,
  fetchClients,
  fetchServiceCategories,
} from "@/lib/api";
import {
  fetchGooglePlaceDetails,
  type GooglePlaceAddress,
  useGooglePlacesAutocomplete,
} from "@/lib/google-places";
import { extractSavedAddress } from "@/lib/user-saved-addresses";
import type { User, ServiceCategory, PaymentMethod } from "@/types/database";
import type { SearchableSelectOption } from "@/components/SearchableSelect";

interface NovaViagemFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const paymentOptions: SearchableSelectOption[] = [
  { value: "pix", label: "PIX" },
  { value: "debit", label: "Débito" },
  { value: "credit", label: "Crédito" },
  { value: "cash", label: "Dinheiro" },
  { value: "billing", label: "Faturamento" },
];

const inputClass =
  "w-full rounded-lg bg-background border border-border text-dark placeholder:text-contrast/40 focus:ring-primary focus:ring-1 focus:outline-none px-3 py-2 text-base md:text-sm font-body";
const inputErrorClass =
  "w-full rounded-lg bg-background border border-danger text-dark placeholder:text-contrast/40 focus:ring-danger focus:ring-1 focus:outline-none px-3 py-2 text-base md:text-sm font-body";
const labelClass = "block text-sm font-body text-contrast mb-1";

function formatClientLabel(user: User): string {
  return user.cpf ? `${user.full_name} - ${user.cpf}` : user.full_name;
}

type StopAddress = {
  id: string;
  label: string;
  placeAddress: GooglePlaceAddress | null;
};

function StopAddressField({
  stop,
  index,
  onChange,
  onRemove,
}: {
  stop: StopAddress;
  index: number;
  onChange: (stop: StopAddress) => void;
  onRemove: () => void;
}) {
  const places = useGooglePlacesAutocomplete();
  const detailsSeqRef = useRef(0);

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <label className={labelClass}>Parada {index + 1}</label>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs font-heading font-bold text-danger hover:text-danger/80"
        >
          Remover
        </button>
      </div>
      <SearchableSelect
        options={places.options}
        value={stop.label}
        onChange={(placeId, label) => {
          const requestSeq = ++detailsSeqRef.current;
          onChange({
            ...stop,
            label,
            placeAddress: {
              formatted_address: label,
              google_place_id: placeId,
            },
          });
          places.clear();
          fetchGooglePlaceDetails(placeId, label).then((address) => {
            if (requestSeq !== detailsSeqRef.current) return;
            onChange({ ...stop, label: address.formatted_address, placeAddress: address });
          });
        }}
        onSearchChange={(q) => {
          detailsSeqRef.current++;
          onChange({ ...stop, label: q, placeAddress: null });
          places.search(q);
        }}
        placeholder="Adicionar parada no percurso"
        loading={places.loading}
      />
    </div>
  );
}

export default function NovaViagemForm({
  open,
  onClose,
  onSuccess,
}: NovaViagemFormProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showClientForm, setShowClientForm] = useState(false);

  const [clients, setClients] = useState<User[]>([]);
  const [tripCategoryId, setTripCategoryId] = useState<string>("");

  const [clientId, setClientId] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupPlaceAddress, setPickupPlaceAddress] =
    useState<GooglePlaceAddress | null>(null);
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [dropoffPlaceAddress, setDropoffPlaceAddress] =
    useState<GooglePlaceAddress | null>(null);
  const [stops, setStops] = useState<StopAddress[]>([]);
  const [scheduledDatetime, setScheduledDatetime] = useState("");
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [returnDatetime, setReturnDatetime] = useState("");
  const [passengerCount, setPassengerCount] = useState(1);
  const [childrenCount, setChildrenCount] = useState(0);
  const [luggageCount, setLuggageCount] = useState(0);
  const [childrenObservations, setChildrenObservations] = useState("");
  const [luggageObservations, setLuggageObservations] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [observations, setObservations] = useState("");
  const [pickupHistory, setPickupHistory] = useState<GooglePlaceAddress[]>([]);
  const [dropoffHistory, setDropoffHistory] = useState<GooglePlaceAddress[]>([]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId) ?? null,
    [clients, clientId],
  );
  const homeAddress = useMemo(
    () => extractSavedAddress(selectedClient, "home"),
    [selectedClient],
  );
  const workAddress = useMemo(
    () => extractSavedAddress(selectedClient, "work"),
    [selectedClient],
  );

  useEffect(() => {
    if (!clientId) {
      setPickupHistory([]);
      setDropoffHistory([]);
      return;
    }
    let cancelled = false;
    Promise.all([
      fetchClientAddressHistory(clientId, "pickup"),
      fetchClientAddressHistory(clientId, "dropoff"),
    ])
      .then(([pickups, dropoffs]) => {
        if (cancelled) return;
        setPickupHistory(pickups);
        setDropoffHistory(dropoffs);
      })
      .catch(() => {
        if (cancelled) return;
        setPickupHistory([]);
        setDropoffHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const loadClients = () => {
    fetchClients()
      .then(setClients)
      .catch(() => toast("danger", "Erro ao carregar clientes"));
  };

  useEffect(() => {
    if (!open) return;
    loadClients();
    fetchServiceCategories()
      .then((cats: ServiceCategory[]) => {
        const tripCat = cats.find((c) => c.service_type === "trip");
        if (tripCat) setTripCategoryId(tripCat.id);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function resetForm() {
    setClientId("");
    setPickupAddress("");
    setPickupPlaceAddress(null);
    setDropoffAddress("");
    setDropoffPlaceAddress(null);
    setStops([]);
    setScheduledDatetime("");
    setIsRoundTrip(false);
    setReturnDatetime("");
    setPassengerCount(1);
    setChildrenCount(0);
    setLuggageCount(0);
    setChildrenObservations("");
    setLuggageObservations("");
    setPaymentMethod("");
    setObservations("");
    setSubmitted(false);
    setPickupHistory([]);
    setDropoffHistory([]);
  }

  const clientOptions: SearchableSelectOption[] = clients.map((c) => ({
    value: c.id,
    label: formatClientLabel(c),
  }));

  // Validation helpers
  const isFieldInvalid = (value: string) => submitted && !value;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);

    if (
      !clientId ||
      !pickupAddress ||
      !dropoffAddress ||
      !scheduledDatetime ||
      !paymentMethod
    ) {
      toast("warning", "Preencha todos os campos obrigatórios");
      return;
    }
    if (isRoundTrip && !returnDatetime) {
      toast("warning", "Informe a data/hora de retorno");
      return;
    }

    setSubmitting(true);
    try {
      const combinedObservations =
        [
          observations.trim(),
          childrenCount > 0 && childrenObservations.trim()
            ? `Crianças: ${childrenObservations.trim()}`
            : "",
          luggageCount > 0 && luggageObservations.trim()
            ? `Malas: ${luggageObservations.trim()}`
            : "",
        ]
          .filter(Boolean)
          .join("\n\n") || null;

      await adminCreateTrip({
        client_id: clientId,
        service_category_id: tripCategoryId,
        pickup_address:
          pickupPlaceAddress ?? { formatted_address: pickupAddress },
        dropoff_address:
          dropoffPlaceAddress ?? { formatted_address: dropoffAddress },
        stops: stops
          .map((stop) => stop.placeAddress ?? { formatted_address: stop.label.trim() })
          .filter((stop) => stop.formatted_address),
        scheduled_datetime: new Date(scheduledDatetime).toISOString(),
        is_round_trip: isRoundTrip,
        return_datetime: isRoundTrip
          ? new Date(returnDatetime).toISOString()
          : null,
        passenger_count: passengerCount,
        children_count: childrenCount,
        luggage_count: luggageCount,
        observations: combinedObservations,
        payment_method: paymentMethod || null,
      });

      toast("success", "Viagem criada com sucesso!");
      resetForm();
      onSuccess();
      onClose();
    } catch {
      toast("danger", "Erro ao criar viagem. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <SlidePanel
        open={open}
        onClose={onClose}
        title="Nova Viagem"
        footer={
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-body text-contrast hover:text-dark transition-colors duration-200 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="nova-viagem-form"
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-primary text-background font-heading font-bold text-sm hover:bg-primary-dark transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Criando..." : "Criar Viagem"}
            </button>
          </div>
        }
      >
        <form
          id="nova-viagem-form"
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 p-6 overflow-y-auto flex-1"
        >
          {/* Cliente */}
          <div>
            <label className={labelClass}>Cliente</label>
            <SearchableSelect
              options={clientOptions}
              value={clientId}
              onChange={(val) => setClientId(val)}
              placeholder="Selecione um cliente"
              error={isFieldInvalid(clientId)}
              actionButton={{
                label: "+ Novo Cliente",
                onClick: () => setShowClientForm(true),
              }}
            />
          </div>

          {/* Endereço de embarque */}
          <AddressAutocompleteWithSuggestions
            label="Endereço de embarque"
            placeholder="Ex: Rua das Flores, 123 - Centro"
            value={pickupAddress}
            error={isFieldInvalid(pickupAddress)}
            homeAddress={homeAddress}
            workAddress={workAddress}
            historyAddresses={pickupHistory}
            onChange={(address, rawText) => {
              setPickupAddress(address?.formatted_address ?? rawText);
              setPickupPlaceAddress(address);
            }}
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-body text-contrast">Paradas no percurso</p>
              <button
                type="button"
                onClick={() =>
                  setStops((prev) => [
                    ...prev,
                    {
                      id:
                        typeof crypto !== "undefined" && "randomUUID" in crypto
                          ? crypto.randomUUID()
                          : `${Date.now()}-${prev.length}`,
                      label: "",
                      placeAddress: null,
                    },
                  ])
                }
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-heading font-bold text-dark hover:border-primary hover:text-primary"
              >
                + Adicionar parada
              </button>
            </div>
            {stops.map((stop, index) => (
              <StopAddressField
                key={stop.id}
                stop={stop}
                index={index}
                onChange={(nextStop) =>
                  setStops((prev) =>
                    prev.map((item) => (item.id === stop.id ? nextStop : item))
                  )
                }
                onRemove={() =>
                  setStops((prev) => prev.filter((item) => item.id !== stop.id))
                }
              />
            ))}
          </div>

          {/* Endereço de desembarque */}
          <AddressAutocompleteWithSuggestions
            label="Endereço de desembarque"
            placeholder="Ex: Aeroporto Internacional"
            value={dropoffAddress}
            error={isFieldInvalid(dropoffAddress)}
            homeAddress={homeAddress}
            workAddress={workAddress}
            historyAddresses={dropoffHistory}
            onChange={(address, rawText) => {
              setDropoffAddress(address?.formatted_address ?? rawText);
              setDropoffPlaceAddress(address);
            }}
          />

          {/* Data/hora */}
          <div>
            <label htmlFor="datetime" className={labelClass}>
              Data/hora
            </label>
            <input
              id="datetime"
              type="datetime-local"
              value={scheduledDatetime}
              onChange={(e) => setScheduledDatetime(e.target.value)}
              className={isFieldInvalid(scheduledDatetime) ? inputErrorClass : inputClass}
            />
          </div>

          {/* Ida e volta */}
          <div className="flex items-center gap-2">
            <input
              id="roundtrip"
              type="checkbox"
              checked={isRoundTrip}
              onChange={(e) => setIsRoundTrip(e.target.checked)}
              className="rounded border-border bg-background text-primary focus:ring-primary cursor-pointer"
            />
            <label htmlFor="roundtrip" className="text-sm font-body text-dark cursor-pointer">
              Ida e volta
            </label>
          </div>

          {/* Data/hora retorno */}
          {isRoundTrip && (
            <div>
              <label htmlFor="return-datetime" className={labelClass}>
                Data/hora retorno
              </label>
              <input
                id="return-datetime"
                type="datetime-local"
                value={returnDatetime}
                onChange={(e) => setReturnDatetime(e.target.value)}
                className={
                  submitted && isRoundTrip && !returnDatetime
                    ? inputErrorClass
                    : inputClass
                }
              />
            </div>
          )}

          {/* Nº de passageiros / crianças / malas */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="passengers" className={labelClass}>
                Nº de passageiros <span className="text-contrast/60 font-normal">(opcional)</span>
              </label>
              <input
                id="passengers"
                type="number"
                min={1}
                value={passengerCount}
                onChange={(e) => setPassengerCount(Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="children" className={labelClass}>
                Nº de crianças <span className="text-contrast/60 font-normal">(opcional)</span>
              </label>
              <input
                id="children"
                type="number"
                min={0}
                value={childrenCount}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setChildrenCount(next);
                  if (next <= 0) setChildrenObservations("");
                }}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="luggage" className={labelClass}>
                Nº de malas <span className="text-contrast/60 font-normal">(opcional)</span>
              </label>
              <input
                id="luggage"
                type="number"
                min={0}
                value={luggageCount}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setLuggageCount(next);
                  if (next <= 0) setLuggageObservations("");
                }}
                className={inputClass}
              />
            </div>
          </div>

          {childrenCount > 0 && (
            <div>
              <label htmlFor="children-observations" className={labelClass}>
                Observação sobre crianças
              </label>
              <textarea
                id="children-observations"
                value={childrenObservations}
                onChange={(e) => setChildrenObservations(e.target.value)}
                rows={2}
                placeholder="Ex: 2 crianças, uma de 9 anos e outra de 12"
                className={inputClass + " resize-none"}
              />
            </div>
          )}

          {luggageCount > 0 && (
            <div>
              <label htmlFor="luggage-observations" className={labelClass}>
                Observação sobre malas
              </label>
              <textarea
                id="luggage-observations"
                value={luggageObservations}
                onChange={(e) => setLuggageObservations(e.target.value)}
                rows={2}
                placeholder="Ex: duas malas grandes e uma pequena"
                className={inputClass + " resize-none"}
              />
            </div>
          )}

          {/* Forma de pagamento */}
          <div>
            <label className={labelClass}>Forma de pagamento</label>
            <SearchableSelect
              options={paymentOptions}
              value={paymentMethod}
              onChange={(val) => setPaymentMethod(val as PaymentMethod)}
              placeholder="Selecione"
              error={isFieldInvalid(paymentMethod)}
            />
          </div>

          {/* Observações */}
          <div>
            <label htmlFor="observations" className={labelClass}>
              Observações <span className="text-contrast/60 font-normal">(opcional)</span>
            </label>
            <textarea
              id="observations"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={3}
              placeholder="Informações adicionais sobre a viagem"
              className={inputClass + " resize-none"}
            />
          </div>
        </form>
      </SlidePanel>

      {/* Modal de novo cliente */}
      <NovoClienteForm
        open={showClientForm}
        onClose={() => setShowClientForm(false)}
        onSuccess={() => {
          loadClients();
          setShowClientForm(false);
        }}
        variant="modal"
      />
    </>
  );
}
