/** @type {import('next').NextConfig} */
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
loadEnvConfig(repoRoot);

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
