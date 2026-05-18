"use server";

import { createServiceRoleClient } from "@/lib/supabase/admin";

type ProvisionUserAccountInput = {
  email: string;
  password: string;
  fullName?: string | null;
  phone?: string | null;
};

type ProvisionUserAccountResult = {
  userId: string;
};

export async function provisionUserAccountForAdmin(
  input: ProvisionUserAccountInput,
): Promise<ProvisionUserAccountResult> {
  const email = input.email.trim().toLowerCase();
  const password = input.password.trim();
  if (!email) {
    throw new Error("Email is required.");
  }
  if (password.length < 8) {
    throw new Error("Use a password with at least 8 characters for new users.");
  }

  const serviceRole = createServiceRoleClient();
  if (!serviceRole) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to create users from admin.");
  }

  const { data, error } = await serviceRole.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      must_change_password: true,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  const userId = data.user?.id;
  if (!userId) {
    throw new Error("User was created without an id.");
  }

  return { userId };
}

export async function rollbackProvisionedUser(userId: string) {
  const serviceRole = createServiceRoleClient();
  if (!serviceRole || !userId) return;
  await serviceRole.auth.admin.deleteUser(userId);
}
