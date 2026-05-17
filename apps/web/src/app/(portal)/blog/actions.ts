"use server";

import { requestOpenRouterChatWithFallbacks } from "@saasclinics/lib";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { createClient } from "@/lib/supabase/server";
import { getUserAccess } from "@/lib/auth/get-user-access";

export async function createBlogPost(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  const bodyMarkdown = String(formData.get("body_markdown") ?? "").trim();
  const status = String(formData.get("status") ?? "draft").trim();

  if (!title || !slug) throw new Error("Title and slug are required.");

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("blog_posts").insert({
    clinic_id,
    author_id: user?.id ?? null,
    title,
    slug,
    excerpt: excerpt || null,
    body_markdown: bodyMarkdown || null,
    status,
    published_at: status === "published" ? new Date().toISOString() : null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/blog");
}

export async function generateBlogDraft(formData: FormData) {
  const access = await getUserAccess();
  const role = access.membership?.role ?? "";
  const allowed = access.isSuperAdmin || role === "clinic_admin" || role === "marketing_editor" || role === "clinic_editor";
  if (!allowed) redirect("/dashboard");

  const topic = String(formData.get("topic") ?? "").trim();
  if (!topic) throw new Error("Topic is required.");

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY in environment.");
  }

  const completion = await requestOpenRouterChatWithFallbacks({
    apiKey,
    model: process.env.OPENROUTER_MODEL,
    max_tokens: 3000,
    temperature: 0.7,
    messages: [
      {
        role: "system",
        content:
          "You are a veterinary clinic content writer. Produce clean markdown with headings, bullet lists, and practical advice.",
      },
      {
        role: "user",
        content: `Write an SEO-friendly veterinary blog draft about: ${topic}`,
      },
    ],
  });

  if (!completion.ok) {
    throw new Error(completion.error);
  }

  const markdown = completion.text;

  const title = topic;
  const slug = topic
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("blog_posts").insert({
    clinic_id,
    author_id: user?.id ?? null,
    title,
    slug,
    excerpt: `AI draft for ${topic}`,
    body_markdown: markdown,
    status: "draft",
    ai_generated: true,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/blog");
}

export async function publishBlogPost(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Post id is required.");

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const { error } = await supabase
    .from("blog_posts")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("clinic_id", clinic_id);
  if (error) throw new Error(error.message);

  revalidatePath("/blog");
}
