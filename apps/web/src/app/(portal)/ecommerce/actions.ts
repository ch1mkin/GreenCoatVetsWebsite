"use server";

import { revalidatePath } from "next/cache";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { getUserAccess, type UserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";

const MAX_GALLERY_URLS = 12;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB (bucket limit is 10 MB)

async function resolveClinicIdForAction(formData: FormData): Promise<string> {
  const access = await getUserAccess();
  const { clinic_id: fallback } = await getActiveMembership();
  if (!access.isSuperAdmin) return fallback;
  const pick = String(formData.get("context_clinic_id") ?? "").trim();
  if (!pick) return fallback;
  const supabase = createClient();
  const { data } = await supabase.from("clinics").select("id").eq("id", pick).eq("is_active", true).maybeSingle();
  return (data?.id as string | undefined) ?? fallback;
}

function assertCanManageProducts(access: UserAccess) {
  const role = access.membership?.role;
  if (!access.isSuperAdmin && role !== "clinic_admin") {
    throw new Error("Only clinic admins or platform super admins can manage products.");
  }
}

function parseGalleryUrls(formData: FormData, field = "gallery_urls"): string[] {
  const raw = String(formData.get(field) ?? "");
  const urls = raw
    .split(/[\n\r]+/)
    .map((s) => s.trim())
    .filter((u) => /^https?:\/\//i.test(u));
  return Array.from(new Set(urls)).slice(0, MAX_GALLERY_URLS);
}

async function assertCategoryBelongsToClinic(categoryId: string | undefined, clinicId: string) {
  if (!categoryId) return;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("product_categories")
    .select("id")
    .eq("id", categoryId)
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Selected category does not belong to this clinic.");
}

async function uploadProductPrimaryImage(
  clinicId: string,
  productId: string,
  file: File,
): Promise<string> {
  if (!file || file.size === 0) throw new Error("Image file is empty.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image must be 8 MB or smaller.");

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${clinicId}/products/${productId}/${Date.now()}-${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const supabase = createClient();
  const { error: uploadError } = await supabase.storage
    .from("clinic-assets")
    .upload(path, bytes, { contentType: file.type || "image/jpeg", upsert: true });
  if (uploadError) throw new Error(uploadError.message);
  const { data: publicUrl } = supabase.storage.from("clinic-assets").getPublicUrl(path);
  return publicUrl.publicUrl;
}

export async function createProduct(formData: FormData) {
  const access = await getUserAccess();
  assertCanManageProducts(access);

  const clinic_id = await resolveClinicIdForAction(formData);
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const branchId = String(formData.get("branch_id") ?? "").trim();
  const inventoryItemId = String(formData.get("inventory_item_id") ?? "").trim();
  const categoryId = String(formData.get("category_id") ?? "").trim();
  const price = Number(formData.get("price") ?? 0);
  const compareAt = String(formData.get("compare_at_price") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const summary = String(formData.get("summary") ?? "").trim() || null;
  const imageUrlManual = String(formData.get("image_url") ?? "").trim();
  const requiresPrescription = String(formData.get("requires_prescription") ?? "") === "on";
  const galleryUrls = parseGalleryUrls(formData);

  if (!name || !slug) throw new Error("Product name and slug are required.");

  const supabase = createClient();

  await assertCategoryBelongsToClinic(categoryId || undefined, clinic_id);

  let stockQuantity = 0;
  if (inventoryItemId) {
    const { data: inventoryItem, error: inventoryError } = await supabase
      .from("inventory_items")
      .select("stock_quantity, clinic_id")
      .eq("id", inventoryItemId)
      .eq("clinic_id", clinic_id)
      .single();
    if (inventoryError) throw new Error(inventoryError.message);
    stockQuantity = inventoryItem.stock_quantity;
  }

  const compareAtPrice =
    compareAt && Number.isFinite(Number(compareAt)) ? Number(compareAt) : null;

  const primaryFile = formData.get("primary_image");
  const file = primaryFile instanceof File && primaryFile.size > 0 ? primaryFile : null;

  const { data: inserted, error: insertError } = await supabase
    .from("products")
    .insert({
      clinic_id,
      branch_id: branchId || null,
      category_id: categoryId || null,
      inventory_item_id: inventoryItemId || null,
      name,
      slug,
      description,
      summary,
      price: Number.isFinite(price) ? price : 0,
      compare_at_price: compareAtPrice,
      stock_quantity: stockQuantity,
      requires_prescription: requiresPrescription,
      is_active: true,
      image_url: imageUrlManual && /^https?:\/\//i.test(imageUrlManual) ? imageUrlManual : null,
      image_urls: galleryUrls.length ? galleryUrls : [],
    })
    .select("id")
    .single();

  if (insertError) throw new Error(insertError.message);
  const productId = inserted?.id as string;
  if (!productId) throw new Error("Product was not created.");

  if (file) {
    try {
      const url = await uploadProductPrimaryImage(clinic_id, productId, file);
      const { error: upErr } = await supabase.from("products").update({ image_url: url }).eq("id", productId);
      if (upErr) throw new Error(upErr.message);
    } catch (e) {
      await supabase.from("products").delete().eq("id", productId);
      throw e instanceof Error ? e : new Error(String(e));
    }
  }

  revalidatePath("/ecommerce");
  revalidatePath(`/ecommerce/product/${productId}/edit`);
}

export async function updateProduct(formData: FormData) {
  const access = await getUserAccess();
  assertCanManageProducts(access);

  const clinic_id = await resolveClinicIdForAction(formData);
  const productId = String(formData.get("product_id") ?? "").trim();
  if (!productId) throw new Error("Product id is required.");

  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const branchId = String(formData.get("branch_id") ?? "").trim();
  const inventoryItemId = String(formData.get("inventory_item_id") ?? "").trim();
  const categoryId = String(formData.get("category_id") ?? "").trim();
  const price = Number(formData.get("price") ?? 0);
  const compareAt = String(formData.get("compare_at_price") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const summary = String(formData.get("summary") ?? "").trim() || null;
  const seoTitle = String(formData.get("seo_title") ?? "").trim() || null;
  const seoDescription = String(formData.get("seo_description") ?? "").trim() || null;
  const imageUrlManual = String(formData.get("image_url") ?? "").trim();
  const requiresPrescription = String(formData.get("requires_prescription") ?? "") === "on";
  const clearPrimaryImage = String(formData.get("clear_primary_image") ?? "") === "on";
  const galleryUrls = parseGalleryUrls(formData);

  if (!name || !slug) throw new Error("Product name and slug are required.");

  const supabase = createClient();

  await assertCategoryBelongsToClinic(categoryId || undefined, clinic_id);

  const { data: existing, error: loadErr } = await supabase
    .from("products")
    .select("id, clinic_id, stock_quantity, inventory_item_id")
    .eq("id", productId)
    .single();
  if (loadErr || !existing) throw new Error("Product not found.");
  if ((existing as { clinic_id: string }).clinic_id !== clinic_id) {
    throw new Error("Product does not belong to this clinic.");
  }

  let stockQuantity = (existing as { stock_quantity: number }).stock_quantity;
  const prevInventoryId = (existing as { inventory_item_id: string | null }).inventory_item_id;
  if (inventoryItemId) {
    const { data: inventoryItem, error: inventoryError } = await supabase
      .from("inventory_items")
      .select("stock_quantity, clinic_id")
      .eq("id", inventoryItemId)
      .eq("clinic_id", clinic_id)
      .single();
    if (inventoryError) throw new Error(inventoryError.message);
    stockQuantity = inventoryItem.stock_quantity;
  } else if (prevInventoryId && !inventoryItemId) {
    // Unlinked from inventory — keep current product stock as-is
    stockQuantity = (existing as { stock_quantity: number }).stock_quantity;
  }

  const compareAtPrice =
    compareAt && Number.isFinite(Number(compareAt)) ? Number(compareAt) : null;

  const primaryFile = formData.get("primary_image");
  const file = primaryFile instanceof File && primaryFile.size > 0 ? primaryFile : null;

  let nextImageUrl: string | null | undefined;
  if (file) {
    nextImageUrl = await uploadProductPrimaryImage(clinic_id, productId, file);
  } else if (imageUrlManual && /^https?:\/\//i.test(imageUrlManual)) {
    nextImageUrl = imageUrlManual;
  } else if (clearPrimaryImage) {
    nextImageUrl = null;
  }

  const patch: Record<string, unknown> = {
    name,
    slug,
    branch_id: branchId || null,
    category_id: categoryId || null,
    inventory_item_id: inventoryItemId || null,
    description,
    summary,
    price: Number.isFinite(price) ? price : 0,
    compare_at_price: compareAtPrice,
    stock_quantity: stockQuantity,
    requires_prescription: requiresPrescription,
    seo_title: seoTitle,
    seo_description: seoDescription,
    image_urls: galleryUrls,
  };

  if (nextImageUrl !== undefined) {
    patch.image_url = nextImageUrl;
  }

  const { error } = await supabase.from("products").update(patch).eq("id", productId).eq("clinic_id", clinic_id);
  if (error) throw new Error(error.message);

  revalidatePath("/ecommerce");
  revalidatePath(`/ecommerce/product/${productId}/edit`);
}

function slugifyCategorySegment(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

/**
 * Create a product category for the resolved clinic (super admin clinic switch via `context_clinic_id`).
 * Same permissions as product create: super_admin + clinic_admin.
 */
export async function createProductCategory(formData: FormData) {
  const access = await getUserAccess();
  assertCanManageProducts(access);

  const clinic_id = await resolveClinicIdForAction(formData);
  const name = String(formData.get("category_name") ?? "").trim();
  let slug = String(formData.get("category_slug") ?? "").trim();
  const description = String(formData.get("category_description") ?? "").trim() || null;

  if (!name) throw new Error("Category name is required.");
  if (!slug) slug = slugifyCategorySegment(name);
  if (!slug) throw new Error("Add a URL slug (letters, numbers, and hyphens only).");

  const supabase = createClient();
  const { error } = await supabase.from("product_categories").insert({
    clinic_id,
    name,
    slug,
    description,
  });
  if (error) {
    if (error.code === "23505") {
      throw new Error("A category with this slug already exists for this clinic. Use a different slug.");
    }
    throw new Error(error.message);
  }

  revalidatePath("/ecommerce");
}

const FULFILLMENT_ROLES = new Set(["super_admin", "clinic_admin", "branch_admin"]);

export async function updateOrderStatus(formData: FormData) {
  const access = await getUserAccess();
  const role = access.membership?.role;
  if (!access.isSuperAdmin && (!role || !FULFILLMENT_ROLES.has(role))) {
    throw new Error("You do not have permission to update order status.");
  }

  const orderId = String(formData.get("order_id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!orderId || !status) throw new Error("Order and status are required.");

  const allowed = new Set(["pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"]);
  if (!allowed.has(status)) throw new Error("Invalid status.");

  const clinic_id = await resolveClinicIdForAction(formData);
  const supabase = createClient();
  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId).eq("clinic_id", clinic_id);
  if (error) throw new Error(error.message);
  revalidatePath("/ecommerce");
}

export async function placeOrder(formData: FormData) {
  const ownerId = String(formData.get("owner_id") ?? "").trim();
  const productId = String(formData.get("product_id") ?? "").trim();
  const quantity = Number(formData.get("quantity") ?? 1);

  if (!ownerId || !productId || !Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Owner, product and quantity are required.");
  }

  const clinic_id = await resolveClinicIdForAction(formData);
  const supabase = createClient();
  const { error } = await supabase.rpc("place_order_atomic", {
    p_clinic_id: clinic_id,
    p_owner_id: ownerId,
    p_product_id: productId,
    p_quantity: quantity,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/ecommerce");
  revalidatePath("/inventory");
}
