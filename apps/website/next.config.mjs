/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@saasclinics/lib", "@openrouter/sdk"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
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
