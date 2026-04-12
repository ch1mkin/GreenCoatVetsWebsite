/** Mirrors web `roleCanGenerateQr` for mobile invite creation (RPC `create_role_invite`). */
export function getMobileInviteAllowedRoles(membershipRole: string): string[] {
  switch (membershipRole) {
    case "super_admin":
      return ["clinic_admin", "branch_admin", "doctor", "receptionist", "lab_technician", "pharmacist", "pet_owner"];
    case "clinic_admin":
      return ["branch_admin", "doctor", "receptionist", "lab_technician", "pharmacist"];
    case "receptionist":
    case "doctor":
      return ["pet_owner"];
    default:
      return [];
  }
}
