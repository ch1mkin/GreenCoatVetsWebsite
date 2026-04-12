"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, resolveBlogAdminClinicId, type AdminContext } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseTags(raw: string | null): string[] | null {
  if (!raw?.trim()) return null;
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : null;
}

async function assertCanPostForClinic(ctx: AdminContext, clinicId: string) {
  if (ctx.role === "super_admin") return;
  if (ctx.role === "marketing_editor" && ctx.clinicId === clinicId) return;
  throw new Error("Not allowed");
}

export async function saveBlogPost(formData: FormData) {
  const ctx = await requireAdmin();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const id = (formData.get("id") as string | null)?.trim() || null;

  const title = (formData.get("title") as string)?.trim();
  if (!title) throw new Error("Title is required");

  let slug = (formData.get("slug") as string)?.trim();
  if (!slug) slug = slugify(title);
  if (!slug) throw new Error("Invalid slug");

  const excerpt = (formData.get("excerpt") as string)?.trim() || null;
  const body_markdown = (formData.get("body_markdown") as string)?.trim() || null;
  const body_html = (formData.get("body_html") as string)?.trim() || null;
  const featured_image_url = (formData.get("featured_image_url") as string)?.trim() || null;
  const categoryRaw = (formData.get("category_id") as string)?.trim();
  const category_id = categoryRaw ? categoryRaw : null;
  const status = (formData.get("status") as string) === "published" ? "published" : "draft";
  const ai_generated = formData.get("ai_generated") === "on";
  const tags = parseTags(formData.get("tags") as string | null);

  let clinicId = await resolveBlogAdminClinicId(ctx, formData.get("clinic_id") as string | null);
  let previousPublishedAt: string | null = null;

  if (id) {
    const { data: existing } = await supabase
      .from("blog_posts")
      .select("clinic_id, published_at")
      .eq("id", id)
      .maybeSingle();
    if (!existing) throw new Error("Post not found");
    await assertCanPostForClinic(ctx, existing.clinic_id as string);
    if (ctx.role === "marketing_editor") {
      clinicId = existing.clinic_id as string;
    }
    previousPublishedAt = (existing.published_at as string | null) ?? null;
  } else {
    await assertCanPostForClinic(ctx, clinicId);
  }

  const published_at =
    status === "published" ? previousPublishedAt ?? new Date().toISOString() : null;

  const shared = {
    clinic_id: clinicId,
    category_id,
    title,
    slug,
    excerpt,
    body_markdown,
    body_html: body_html || null,
    featured_image_url: featured_image_url || null,
    tags,
    status: status as "draft" | "published",
    ai_generated,
    published_at,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { error } = await supabase.from("blog_posts").update(shared).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("blog_posts").insert({
      ...shared,
      author_id: user.id,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/blog");
  revalidatePath("/admin/blog");
  redirect("/admin/blog");
}

export async function deleteBlogPost(formData: FormData) {
  const ctx = await requireAdmin();
  const supabase = createClient();
  const id = (formData.get("id") as string)?.trim();
  if (!id) throw new Error("Missing id");

  const { data: row } = await supabase.from("blog_posts").select("clinic_id").eq("id", id).maybeSingle();
  if (!row) throw new Error("Not found");
  await assertCanPostForClinic(ctx, row.clinic_id as string);

  const { error } = await supabase.from("blog_posts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/blog");
  revalidatePath("/admin/blog");
  redirect("/admin/blog");
}

function slugifyFromTopic(topic: string): string {
  return slugify(topic)
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export async function generateBlogDraft(formData: FormData) {
  const ctx = await requireAdmin();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const topic = String(formData.get("topic") ?? "").trim();
  if (!topic) throw new Error("Topic is required.");

  const clinicId = await resolveBlogAdminClinicId(ctx, formData.get("clinic_id") as string | null);

  // Allow both super admin and assigned marketing editors.
  await assertCanPostForClinic(ctx, clinicId);

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "deepseek/deepseek-r1-0528";
  if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY in environment.");

  // Fetch clinic name to personalize the draft.
  const { data: clinic } = await supabase.from("clinics").select("name").eq("id", clinicId).maybeSingle();
  const clinicName = (clinic?.name as string | null) ?? "your clinic";

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 3000,
      messages: [
        {
          role: "system",
          content:
            "You are a veterinary clinic content writer. Produce clean markdown with headings, bullet lists, and practical advice. No tables. Keep paragraphs short.",
        },
        {
          role: "user",
          content: `Write an SEO-friendly veterinary blog draft for ${clinicName} about: ${topic}.`,
        },
      ],
    }),
  });

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "AI generation failed.");
  }

  const markdown = payload.choices?.[0]?.message?.content?.trim();
  if (!markdown) throw new Error("No content returned by AI model.");

  const title = topic;
  const slug = slugifyFromTopic(topic);

  const { data: inserted, error: insErr } = await supabase
    .from("blog_posts")
    .insert({
      clinic_id: clinicId,
      author_id: user.id,
      title,
      slug,
      excerpt: `AI draft for ${topic}`,
      body_markdown: markdown,
      status: "draft",
      ai_generated: true,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (insErr) throw new Error(insErr.message);
  if (!inserted?.id) throw new Error("Failed to create AI draft.");

  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  redirect(`/admin/blog/${inserted.id}`);
}
