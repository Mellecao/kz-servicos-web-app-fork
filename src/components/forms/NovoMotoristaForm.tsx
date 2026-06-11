"use client";

import { useEffect, useState, type FormEvent } from "react";
import SlidePanel from "@/components/SlidePanel";
import { useToast } from "@/components/Toast";
import {
  createUser,
  createProviderProfile,
  createDriverProfile,
  createVehicle,
  fetchServiceCategories,
  updateDriverById,
} from "@/lib/api";
import type { DriverProfile, ProviderStatus, ServiceCategory, Vehicle } from "@/types/database";

interface NovoMotoristaFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  driver?: (DriverProfile & { vehicle?: Vehicle }) | null;
}

const inputClass =
  "w-full rounded-lg bg-background border border-border text-dark placeholder:text-contrast/40 focus:ring-primary focus:ring-1 focus:outline-none px-3 py-2 text-base md:text-sm font-body";
const inputErrorClass =
  "w-full rounded-lg bg-background border border-danger text-danger placeholder:text-contrast/40 focus:ring-danger focus:ring-1 focus:outline-none px-3 py-2 text-base md:text-sm font-body";
const labelClass = "block text-sm font-body text-contrast mb-1";
const sectionClass = "text-sm font-heading font-bold text-dark mb-3 mt-2";

const cnhCategories = ["A", "B", "C", "D", "E"];
const providerStatuses: Array<{ value: ProviderStatus; label: string }> = [
  { value: "approved", label: "Aprovado" },
  { value: "pending", label: "Pendente" },
  { value: "rejected", label: "Rejeitado" },
  { value: "suspended", label: "Suspenso" },
];

export default function NovoMotoristaForm({
  open,
  onClose,
  onSuccess,
  driver = null,
}: NovoMotoristaFormProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState("");
  const isEditing = Boolean(driver);

  // Dados do motorista
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [providerStatus, setProviderStatus] = useState<ProviderStatus>("approved");
  const [isAvailable, setIsAvailable] = useState(true);

  // CNH
  const [cnhNumber, setCnhNumber] = useState("");
  const [cnhCategory, setCnhCategory] = useState("");
  const [cnhExpiration, setCnhExpiration] = useState("");

  // Veículo
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [color, setColor] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [passengerCapacity, setPassengerCapacity] = useState("");

  useEffect(() => {
    if (!open) return;
    if (!driver) {
      resetForm();
      return;
    }

    const user = driver.provider_profiles?.users;
    const vehicle = driver.vehicle;

    setFullName(user?.full_name ?? "");
    setEmail(user?.email ?? "");
    setPassword("");
    setPhone(user?.phone ?? "");
    setCpf(user?.cpf ?? "");
    setProviderStatus(driver.provider_profiles?.status ?? "approved");
    setIsAvailable(driver.is_available);
    setCnhNumber(driver.cnh_number ?? "");
    setCnhCategory(driver.cnh_category ?? "");
    setCnhExpiration(driver.cnh_expiration_date ?? "");
    setBrand(vehicle?.brand ?? "");
    setModel(vehicle?.model ?? "");
    setYear(vehicle?.year ? String(vehicle.year) : "");
    setColor(vehicle?.color ?? "");
    setLicensePlate(vehicle?.license_plate ?? "");
    setPassengerCapacity(vehicle?.passenger_capacity ? String(vehicle.passenger_capacity) : "");
    setEmailError("");
  }, [open, driver]);

  function resetForm() {
    setFullName("");
    setEmail("");
    setPassword("");
    setPhone("");
    setCpf("");
    setProviderStatus("approved");
    setIsAvailable(true);
    setCnhNumber("");
    setCnhCategory("");
    setCnhExpiration("");
    setBrand("");
    setModel("");
    setYear("");
    setColor("");
    setLicensePlate("");
    setPassengerCapacity("");
    setEmailError("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!fullName || !email || (!isEditing && !password)) {
      toast("warning", "Preencha todos os campos obrigatórios");
      return;
    }

    if (!isEditing && password.length < 6) {
      toast("warning", "A senha deve ter pelo menos 6 caracteres");
      return;
    }

    const hasVehicle =
      brand ||
      model ||
      year ||
      color ||
      licensePlate ||
      passengerCapacity;
    const vehicleYear = Number(year);

    if (
      hasVehicle &&
      (!brand ||
        !model ||
        !year ||
        !Number.isFinite(vehicleYear) ||
        !color ||
        !licensePlate)
    ) {
      toast(
        "warning",
        "Preencha marca, modelo, ano, cor e placa do veículo."
      );
      return;
    }

    setSubmitting(true);
    setEmailError("");
    try {
      if (driver) {
        const userId = driver.provider_profiles?.users?.id;
        const providerProfileId = driver.provider_profile_id;
        if (!userId || !providerProfileId) {
          toast("danger", "Não foi possível localizar o cadastro do motorista.");
          return;
        }

        await updateDriverById(driver.id, {
          user_id: userId,
          provider_profile_id: providerProfileId,
          vehicle_id: driver.vehicle?.id ?? null,
          full_name: fullName,
          email,
          phone: phone || null,
          cpf: cpf || null,
          provider_status: providerStatus,
          cnh_number: cnhNumber || null,
          cnh_category: cnhCategory || null,
          cnh_expiration_date: cnhExpiration || null,
          is_available: isAvailable,
          vehicle: {
            brand: brand || null,
            model: model || null,
            year: year || null,
            color: color || null,
            license_plate: licensePlate || null,
            passenger_capacity: passengerCapacity || null,
          },
        });
      } else {
        // 1. Create user
        const user = await createUser({
          full_name: fullName,
          email,
          password,
          phone: phone || null,
          cpf: cpf || null,
          role: "provider",
        });

        // 2. Find trip service category
        const categories: ServiceCategory[] = await fetchServiceCategories();
        const tripCategory = categories.find((c) => c.service_type === "trip");
        if (!tripCategory) {
          toast("danger", "Categoria de viagem não encontrada.");
          return;
        }

        // 3. Create provider profile
        const profile = await createProviderProfile({
          user_id: user.id,
          service_category_id: tripCategory.id,
          status: "approved",
        });

        // 4. Create driver profile
        const driverProfile = await createDriverProfile({
          provider_profile_id: profile.id,
          cnh_number: cnhNumber || null,
          cnh_category: cnhCategory || null,
          cnh_expiration_date: cnhExpiration || null,
          is_available: true,
        });

        // 5. Create vehicle if any field is filled
        if (hasVehicle) {
          await createVehicle({
            driver_profile_id: driverProfile.id,
            brand,
            model,
            year: vehicleYear,
            color,
            license_plate: licensePlate,
            passenger_capacity: Number(passengerCapacity) || 4,
          });
        }
      }

      toast("success", driver ? "Motorista atualizado com sucesso!" : "Motorista criado com sucesso!");
      resetForm();
      onSuccess();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("already been registered")) {
        const errorMsg = "Este e-mail já está cadastrado.";
        setEmailError(errorMsg);
        toast("danger", errorMsg);
      } else {
        toast("danger", message || (driver ? "Erro ao atualizar motorista. Tente novamente." : "Erro ao criar motorista. Tente novamente."));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title={isEditing ? "Editar Motorista" : "Novo Motorista"}
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
            form="novo-motorista-form"
            disabled={submitting}
            className="px-5 py-2 rounded-lg bg-primary text-background font-heading font-bold text-sm hover:bg-primary-dark transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting
              ? isEditing ? "Salvando..." : "Criando..."
              : isEditing ? "Salvar Motorista" : "Criar Motorista"}
          </button>
        </div>
      }
    >
      <form
        id="novo-motorista-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        {/* Section: Dados do Motorista */}
        <h3 className={sectionClass}>Dados do Motorista</h3>

        <div>
          <label htmlFor="driver-name" className={labelClass}>
            Nome completo *
          </label>
          <input
            id="driver-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nome do motorista"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="driver-email" className={labelClass}>
            E-mail *
          </label>
          <input
            id="driver-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError("");
            }}
            placeholder="email@exemplo.com"
            className={emailError ? inputErrorClass : inputClass}
          />
          {emailError && (
            <p className="mt-1 text-xs text-danger font-body">{emailError}</p>
          )}
        </div>

        <div>
          <label htmlFor="driver-password" className={labelClass}>
            Senha de acesso {!isEditing && "*"}
          </label>
          <input
            id="driver-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isEditing ? "Não alterada na edição" : "Mínimo 6 caracteres"}
            className={inputClass}
            autoComplete="new-password"
            disabled={isEditing}
          />
        </div>

        <div>
          <label htmlFor="driver-phone" className={labelClass}>
            Telefone
          </label>
          <input
            id="driver-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(00) 00000-0000"
            className={inputClass}
          />
        </div>

        {isEditing && (
          <>
            <div>
              <label htmlFor="driver-status" className={labelClass}>
                Status do cadastro
              </label>
              <select
                id="driver-status"
                value={providerStatus}
                onChange={(e) => setProviderStatus(e.target.value as ProviderStatus)}
                className={inputClass}
              >
                {providerStatuses.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm font-body text-dark">
              <input
                type="checkbox"
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
                className="rounded border-border bg-background text-primary focus:ring-primary cursor-pointer"
              />
              Motorista disponível
            </label>
          </>
        )}

        <div>
          <label htmlFor="driver-cpf" className={labelClass}>
            CPF
          </label>
          <input
            id="driver-cpf"
            type="text"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            placeholder="000.000.000-00"
            className={inputClass}
          />
        </div>

        {/* Section: CNH */}
        <div className="border-t border-border pt-4 mt-2" />
        <h3 className={sectionClass}>CNH</h3>

        <div>
          <label htmlFor="driver-cnh" className={labelClass}>
            Número da CNH
          </label>
          <input
            id="driver-cnh"
            type="text"
            value={cnhNumber}
            onChange={(e) => setCnhNumber(e.target.value)}
            placeholder="00000000000"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="driver-cnh-cat" className={labelClass}>
            Categoria
          </label>
          <select
            id="driver-cnh-cat"
            value={cnhCategory}
            onChange={(e) => setCnhCategory(e.target.value)}
            className={inputClass}
          >
            <option value="">Selecione</option>
            {cnhCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="driver-cnh-exp" className={labelClass}>
            Data de validade
          </label>
          <input
            id="driver-cnh-exp"
            type="date"
            value={cnhExpiration}
            onChange={(e) => setCnhExpiration(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Section: Veículo */}
        <div className="border-t border-border pt-4 mt-2" />
        <h3 className={sectionClass}>Veículo (opcional)</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="vehicle-brand" className={labelClass}>
              Marca
            </label>
            <input
              id="vehicle-brand"
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Ex: Toyota"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="vehicle-model" className={labelClass}>
              Modelo
            </label>
            <input
              id="vehicle-model"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Ex: Corolla"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="vehicle-year" className={labelClass}>
              Ano
            </label>
            <input
              id="vehicle-year"
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2024"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="vehicle-color" className={labelClass}>
              Cor
            </label>
            <input
              id="vehicle-color"
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="Ex: Branco"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="vehicle-plate" className={labelClass}>
              Placa
            </label>
            <input
              id="vehicle-plate"
              type="text"
              value={licensePlate}
              onChange={(e) => setLicensePlate(e.target.value)}
              placeholder="ABC-1234"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="vehicle-capacity" className={labelClass}>
              Passageiros
            </label>
            <input
              id="vehicle-capacity"
              type="number"
              value={passengerCapacity}
              onChange={(e) => setPassengerCapacity(e.target.value)}
              placeholder="4"
              className={inputClass}
            />
          </div>
        </div>

      </form>
    </SlidePanel>
  );
}
