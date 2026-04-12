import type { MetadataRoute } from "next";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { isWebsiteStoreEnabled } from "@/lib/store/store-availability";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const clinic = await resolveClinic();
  const supabase = createClient();
  const storeEnabled = await isWebsiteStoreEnabled();

  const [{ data: services }, { data: blogRows }, { data: products }] = await Promise.all([
    supabase.from("services").select("slug, updated_at").eq("clinic_id", clinic.id).eq("is_active", true),
    supabase.rpc("get_public_blog_posts", { p_clinic_id: clinic.id, p_limit: 200 }),
    storeEnabled
      ? supabase.from("products").select("slug, updated_at").eq("clinic_id", clinic.id).eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const blogs = Array.isArray(blogRows)
    ? blogRows.map((row: { slug: string; published_at?: string | null }) => ({
        slug: row.slug,
        updated_at: row.published_at ?? null,
      }))
    : [];

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: "/", changeFrequency: "daily", priority: 1 },
    { url: "/about", changeFrequency: "monthly", priority: 0.7 },
    { url: "/contact", changeFrequency: "monthly", priority: 0.7 },
    { url: "/locations", changeFrequency: "monthly", priority: 0.8 },
    { url: "/services", changeFrequency: "weekly", priority: 0.8 },
    { url: "/doctors", changeFrequency: "weekly", priority: 0.8 },
    { url: "/blog", changeFrequency: "daily", priority: 0.8 },
    { url: "/book", changeFrequency: "daily", priority: 0.9 },
  ];
  if (storeEnabled) {
    staticRoutes.push({ url: "/store", changeFrequency: "daily", priority: 0.8 });
  }

  const serviceRoutes =
    services?.map((service) => ({
      url: `/services/${service.slug}`,
      lastModified: service.updated_at ? new Date(service.updated_at) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.75,
    })) ?? [];

  const blogRoutes = blogs.map((blog) => ({
    url: `/blog/${blog.slug}`,
    lastModified: blog.updated_at ? new Date(blog.updated_at) : undefined,
    changeFrequency: "weekly" as const,
    priority: 0.75,
  }));

  const productRoutes =
    products?.map((product) => ({
      url: `/product/${product.slug}`,
      lastModified: product.updated_at ? new Date(product.updated_at) : undefined,
      changeFrequency: "daily" as const,
      priority: 0.75,
    })) ?? [];

  return [...staticRoutes, ...serviceRoutes, ...blogRoutes, ...productRoutes];
}
