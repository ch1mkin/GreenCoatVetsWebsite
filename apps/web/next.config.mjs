/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@saasclinics/lib"],
  experimental: {
    outputFileTracingIncludes: {
      "/api/reception/walk-in-qr": [
        "../../node_modules/@fontsource/inter/files/inter-latin-500-normal.woff",
        "../../node_modules/@fontsource/inter/files/inter-latin-800-normal.woff",
      ],
    },
  },
};

export default nextConfig;
