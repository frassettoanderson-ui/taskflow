import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: path.join(__dirname) },
  serverExternalPackages: ["sharp", "embedded-postgres"],
  experimental: {
    serverActions: { bodySizeLimit: "20mb" }, // fotos do cadastro (já comprimidas no navegador)
  },
};

export default nextConfig;
