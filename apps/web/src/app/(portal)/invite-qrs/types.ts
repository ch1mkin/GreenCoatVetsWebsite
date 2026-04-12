export type InviteQrRow = {
  id: string;
  clinic_id: string;
  role: string;
  token: string;
  label: string | null;
  is_active: boolean;
  max_uses: number | null;
  used_count: number | null;
  expires_at: string | null;
  created_at: string;
  clinics: { name: string; slug: string } | null;
};
