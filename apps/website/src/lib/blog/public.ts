import { createClient } from "@/lib/supabase/server";

export type PublicBlogPostRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image_url: string | null;
  published_at: string | null;
  category_id: string | null;
  category_name: string | null;
  category_slug: string | null;
  tags: string[] | null;
  ai_generated: boolean | null;
};

export async function fetchPublicBlogPosts(clinicId: string, limit = 50): Promise<PublicBlogPostRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_public_blog_posts", {
    p_clinic_id: clinicId,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as PublicBlogPostRow[];
}

export async function fetchPublicBlogPost(clinicId: string, slug: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_public_blog_post_by_slug", {
    p_clinic_id: clinicId,
    p_slug: slug,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return row as
    | {
        id: string;
        title: string;
        slug: string;
        excerpt: string | null;
        body_markdown: string | null;
        body_html: string | null;
        featured_image_url: string | null;
        published_at: string | null;
        category_id: string | null;
        category_name: string | null;
        category_slug: string | null;
        tags: string[] | null;
        ai_generated: boolean | null;
      }
    | null
    | undefined;
}

export async function fetchPublicBlogCategories(clinicId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_public_blog_categories_list", {
    p_clinic_id: clinicId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; name: string; slug: string }[];
}

export async function fetchPublicTagCounts(clinicId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_public_blog_tag_counts", {
    p_clinic_id: clinicId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as { tag: string; post_count: number }[];
}

export function estimateReadMinutes(text: string | null | undefined): number {
  if (!text?.trim()) return 1;
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}
