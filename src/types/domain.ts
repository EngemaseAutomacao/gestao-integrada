/**
 * Tipos de domínio no formato JSON retornado pela API (/api).
 * Datas chegam como string ISO. Os nomes de campos são os mesmos das colunas do banco.
 */

export type UserCategory = "engemase_employee" | "third_party" | "socios";
export type UserRole = "admin" | "employee" | "third_party";
export type CheckoutStatus = "checked_out" | "checked_in";

export interface Profile {
  id: string;
  email: string;
  username: string | null;
  full_name: string;
  company: string | null;
  avatar_url: string | null;
  category: UserCategory;
  role: UserRole;
  approved: boolean;
  first_login: boolean;
  onboarding_completed: boolean;
  last_sign_in_at: string | null;
  last_access_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tool {
  id: string;
  name: string;
  description: string | null;
  brand: string | null;
  tag: string | null;
  qr_code: string | null;
  condition: string | null;
  quantity_total: number;
  quantity_available: number;
  employee_only: boolean;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ToolCheckout {
  id: string;
  tool_id: string;
  user_id: string;
  status: CheckoutStatus;
  checkout_date: string;
  checkin_date: string | null;
  estimated_return_date: string | null;
  checked_out_by: string;
  checked_in_by: string | null;
  construction_site: string | null;
  selected_tag: string | null;
  notes: string | null;
  checkout_photo_url: string | null;
  checkin_photo_url: string | null;
  checkout_signature_url: string | null;
  checkin_signature_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  name: string;
  plate: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  image_url: string | null;
  status: string | null;
  vehicle_type: string;
  is_charging: boolean;
  charging_started_at: string | null;
  charging_started_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleCheckout {
  id: string;
  vehicle_id: string;
  user_id: string;
  status: string | null;
  checkout_date: string;
  checkin_date: string | null;
  estimated_return_date: string | null;
  estimated_return_time: string | null;
  checked_out_by: string;
  checked_in_by: string | null;
  km_checkout: number;
  km_checkin: number | null;
  km_checkin_automatic: boolean | null;
  charges_during_use: number | null;
  refueled: boolean | null;
  destination: string | null;
  destination_address: string | null;
  purpose: string | null;
  notes: string | null;
  is_outside_city: boolean | null;
  [photoColumn: `photo_${string}`]: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConstructionSite {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  active: boolean;
  source: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  push_sent: boolean | null;
  tool_id: string | null;
  checkout_id: string | null;
  created_at: string;
}

export interface SystemLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  user_id: string | null;
  user_name: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface DataRetentionSetting {
  id: string;
  setting_key: string;
  label: string;
  description: string | null;
  retention_days: number;
  enabled: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Perfil resumido que acompanha as listagens de retiradas. */
export interface ProfileSummary {
  id: string;
  full_name: string;
  username: string | null;
  email: string;
  category: UserCategory | string;
}

export type ToolCheckoutRow = ToolCheckout & {
  tools: Pick<Tool, "id" | "name" | "tag" | "brand"> | null;
  profiles: ProfileSummary | null;
  checked_out_by_profile: { id: string; full_name: string } | null;
  checked_in_by_profile: { id: string; full_name: string } | null;
};

export type VehicleCheckoutRow = VehicleCheckout & {
  vehicles: Pick<Vehicle, "id" | "name" | "plate" | "brand" | "model" | "vehicle_type"> | null;
  profiles: ProfileSummary | null;
  checked_out_by_profile: { id: string; full_name: string } | null;
  checked_in_by_profile: { id: string; full_name: string } | null;
};

export type ToolInsert = Partial<Tool> & Pick<Tool, "name">;
export type VehicleInsert = Partial<Vehicle> & Pick<Vehicle, "name" | "plate">;
export type ToolCheckoutInsert = Partial<ToolCheckout> & Pick<ToolCheckout, "tool_id">;
export type VehicleCheckoutInsert = Partial<VehicleCheckout> & Pick<VehicleCheckout, "vehicle_id">;
