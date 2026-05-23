/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@saasclinics/lib"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.supabase.in",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "greencoatvets.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.greencoatvets.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
