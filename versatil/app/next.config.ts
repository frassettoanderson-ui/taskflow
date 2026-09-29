import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: path.join(__dirname) },
  serverExternalPackages: ["sharp", "embedded-postgres"],
  experimental: {
    serverActions: { bodySizeLimit: "80mb" }, // fotos (comprimidas no navegador) + vídeo curto do produto
  },
};

export default nextConfig;
