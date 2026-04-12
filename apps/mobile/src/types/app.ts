export type Membership = {
  /** Null for platform super admins without a tenant clinic context. */
  clinic_id: string | null;
  role: string;
};

/** Appointment row + common embedded relations from Supabase selects */
export type Appointment = {
  id: string;
  status: string;
  starts_at: string;
  appointment_type?: string;
  branch_id?: string;
  pet_id?: string;
  owner_id?: string;
  doctor_id?: string | null;
  branches?: { name: string } | null;
  owners?: { full_name?: string | null; phone?: string | null } | null;
  pets?: {
    name: string;
    species: string;
    allergies?: string | null;
    chronic_diseases?: string | null;
    breed?: string | null;
    age_months?: number | null;
    date_of_birth?: string | null;
    photo_url?: string | null;
  } | null;
};

export type Pet = {
  id: string;
  name: string;
  species: string;
  breed?: string | null;
  allergies?: string | null;
  photo_url?: string | null;
};

export type Order = {
  id: string;
  status: string;
  grand_total: number;
};

export type VisitSummary = {
  id: string;
  pet_id: string;
  started_at: string | null;
  diagnosis: string | null;
};

export type StaffDoctorOption = {
  id: string;
  full_name: string;
};

export type ProductListItem = {
  id: string;
  name: string;
  slug?: string | null;
  price: number;
  stock_quantity: number;
  requires_prescription: boolean;
  image_url?: string | null;
  summary?: string | null;
  description?: string | null;
  compare_at_price?: number | null;
};

/** Local cart line for mobile store checkout (persisted on device). */
export type StoreCartLine = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string | null;
};

export type AdminMobileStats = {
  appointmentsToday: number;
  ordersRevenueToday: number;
  lowStockSkus: number;
};

export type DoctorNotification = {
  id: string;
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
};
