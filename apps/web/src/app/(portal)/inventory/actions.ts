"use server";

import { revalidatePath } from "next/cache";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { createClient } from "@/lib/supabase/server";

export async function createSupplier(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const contactName = String(formData.get("contact_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!name) throw new Error("Supplier name is required.");

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const { error } = await supabase.from("suppliers").insert({
    clinic_id,
    name,
    contact_name: contactName || null,
    phone: phone || null,
    email: email || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/inventory");
}

export async function createInventoryItem(formData: FormData) {
  const branchId = String(formData.get("branch_id") ?? "").trim();
  const supplierId = String(formData.get("supplier_id") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const batchNumber = String(formData.get("batch_number") ?? "").trim();
  const expiryDate = String(formData.get("expiry_date") ?? "").trim();
  const price = Number(formData.get("price") ?? 0);
  const stockQuantity = Number(formData.get("stock_quantity") ?? 0);
  const reorderLevel = Number(formData.get("reorder_level") ?? 5);
  const requiresPrescription = String(formData.get("requires_prescription") ?? "") === "on";

  if (!branchId || !sku || !name) {
    throw new Error("Branch, SKU and item name are required.");
  }

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const { data: item, error } = await supabase
    .from("inventory_items")
    .insert({
      clinic_id,
      branch_id: branchId,
      supplier_id: supplierId || null,
      sku,
      name,
      category: category || null,
      batch_number: batchNumber || null,
      expiry_date: expiryDate || null,
      price: Number.isFinite(price) ? price : 0,
      stock_quantity: Number.isFinite(stockQuantity) ? stockQuantity : 0,
      reorder_level: Number.isFinite(reorderLevel) ? reorderLevel : 5,
      requires_prescription: requiresPrescription,
    })
    .select("id, branch_id")
    .single();

  if (error) throw new Error(error.message);

  if ((Number.isFinite(stockQuantity) ? stockQuantity : 0) > 0) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const movementError = await supabase.from("inventory_movements").insert({
      clinic_id,
      branch_id: item.branch_id,
      inventory_item_id: item.id,
      movement_type: "purchase",
      quantity: stockQuantity,
      notes: "Initial stock entry",
      created_by: user?.id ?? null,
    });

    if (movementError.error) throw new Error(movementError.error.message);
  }

  revalidatePath("/inventory");
}

export async function adjustInventoryStock(formData: FormData) {
  const inventoryItemId = String(formData.get("inventory_item_id") ?? "").trim();
  const delta = Number(formData.get("delta") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim();

  if (!inventoryItemId || !Number.isFinite(delta) || delta === 0) {
    throw new Error("Valid inventory item and non-zero stock delta are required.");
  }

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const { data: item, error: itemError } = await supabase
    .from("inventory_items")
    .select("id, branch_id, stock_quantity")
    .eq("id", inventoryItemId)
    .eq("clinic_id", clinic_id)
    .single();

  if (itemError) throw new Error(itemError.message);

  const nextQty = item.stock_quantity + delta;
  if (nextQty < 0) throw new Error("Stock cannot be negative.");

  const { error: updateError } = await supabase
    .from("inventory_items")
    .update({ stock_quantity: nextQty })
    .eq("id", item.id)
    .eq("clinic_id", clinic_id);

  if (updateError) throw new Error(updateError.message);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const movementType = delta > 0 ? "adjustment" : "sale";
  const { error: movementError } = await supabase.from("inventory_movements").insert({
    clinic_id,
    branch_id: item.branch_id,
    inventory_item_id: item.id,
    movement_type: movementType,
    quantity: delta,
    notes: notes || "Manual stock update",
    created_by: user?.id ?? null,
  });

  if (movementError) throw new Error(movementError.message);
  revalidatePath("/inventory");
}
