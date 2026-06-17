export type UserRole = "client" | "provider" | "admin";
export type ProviderStatus = "pending" | "approved" | "rejected" | "suspended";
export type TripStatus =
  | "open"
  | "under_review"
  | "review_rejected"
  | "searching_drivers"
  | "awaiting_client_confirmation"
  | "awaiting_driver_confirmation"
  | "scheduled"
  | "started"
  | "finished"
  | "cancelled";
export type ServiceRequestStatus =
  | "open"
  | "under_review"
  | "review_rejected"
  | "searching_provider"
  | "assigned"
  | "in_progress"
  | "finished"
  | "cancelled";
export type PaymentMethod = "pix" | "debit" | "credit" | "cash" | "billing";
export type ServiceTypeEnum = "trip" | "other_service";

export interface User {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  is_active: boolean;
  auth_provider: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  service_type: ServiceTypeEnum;
  is_active: boolean;
  icon_url: string | null;
  created_at: string;
}

export interface ProviderProfile {
  id: string;
  user_id: string;
  service_category_id: string;
  status: ProviderStatus;
  rg_document_url: string | null;
  cnh_document_url: string | null;
  proof_of_address_url: string | null;
  has_card_machine: boolean;
  has_tap_payment: boolean;
  issues_invoice: boolean;
  issues_receipt: boolean;
  bank_name: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  bank_account_type: string | null;
  bank_pix_key: string | null;
  average_rating: number;
  total_ratings: number;
  bio: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  users?: User;
  service_categories?: ServiceCategory;
}

export interface DriverProfile {
  id: string;
  provider_profile_id: string;
  cnh_category: string | null;
  cnh_expiration_date: string | null;
  cnh_number: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
  // Relations
  provider_profiles?: ProviderProfile & {
    users?: User;
  };
}

export interface Vehicle {
  id: string;
  driver_profile_id: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  license_plate: string;
  vehicle_document_url: string | null;
  passenger_capacity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  google_place_id: string | null;
  formatted_address: string;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export interface Trip {
  id: string;
  client_id: string;
  driver_profile_id: string | null;
  vehicle_id: string | null;
  service_category_id: string;
  pickup_address_id: string;
  dropoff_address_id: string;
  scheduled_datetime: string;
  is_round_trip: boolean;
  return_datetime: string | null;
  passenger_count: number;
  children_count: number;
  observations: string | null;
  driver_observations: string | null;
  luggage_count: number;
  status: TripStatus;
  estimated_price: number | null;
  final_price: number | null;
  is_paid: boolean;
  is_driver_paied: boolean;
  payment_method: PaymentMethod | null;
  payment_date: string | null;
  started_at: string | null;
  driver_arrived_at: string | null;
  finished_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  pickup_address?: Address;
  dropoff_address?: Address;
  service_categories?: ServiceCategory;
  driver_profiles?: DriverProfile;
  vehicles?: Vehicle;
  users?: User;
}

export interface ServiceRequest {
  id: string;
  client_id: string;
  provider_profile_id: string | null;
  service_category_id: string;
  service_date: string;
  description: string;
  status: ServiceRequestStatus;
  address_id: string | null;
  estimated_price: number | null;
  final_price: number | null;
  is_paid: boolean;
  is_provider_paied: boolean;
  payment_method: PaymentMethod | null;
  observations: string | null;
  provider_observations: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  service_categories?: ServiceCategory;
  addresses?: Address;
  provider_profiles?: ProviderProfile & {
    users?: User;
  };
  users?: User;
}

// Unified financial record from trips and service_requests
export interface Debito {
  id: string;
  tipo: "viagem" | "servico";
  descricao: string;
  cliente: string;
  categoria: string;
  data: string;
  valor_estimado: number | null;
  valor_final: number | null;
  pago: boolean;
  metodo_pagamento: PaymentMethod | null;
  motorista_pago?: boolean;
  prestador_pago?: boolean;
  payment_date?: string | null;
}

export type TripDriverCandidateStatus = "pending" | "accepted" | "rejected";

export interface TripDriverCandidate {
  id: string;
  trip_id: string;
  driver_profile_id: string;
  status: TripDriverCandidateStatus;
  offered_price: number | null;
  admin_approved: boolean;
  price_rejection_reason?: string | null;
  price_rejected_at?: string | null;
  kz_proposed_price?: number | null;
  kz_proposed_at?: string | null;
  kz_proposal_locked?: boolean;
  invited_at: string;
  responded_at: string | null;
  observations: string | null;
  created_at: string;
  // Relations
  driver_profiles?: DriverProfile & {
    provider_profiles?: ProviderProfile & {
      users?: User;
    };
  };
}

export interface TripStatusHistory {
  id: string;
  trip_id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string;
  observations: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// Supabase Database type for the client
export interface Database {
  public: {
    Tables: {
      users: { Row: User };
      service_categories: { Row: ServiceCategory };
      provider_profiles: { Row: ProviderProfile };
      driver_profiles: { Row: DriverProfile };
      vehicles: { Row: Vehicle };
      addresses: { Row: Address };
      trips: { Row: Trip };
      service_requests: { Row: ServiceRequest };
      admin_logs: { Row: AdminLog };
    };
  };
}

export interface AdminLog {
  id: string;
  admin_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  admin?: {
    full_name: string;
    email: string;
  };
}
