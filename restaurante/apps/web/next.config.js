/** @type {import('next').NextConfig} */

// Endereço do backend dentro da rede do Docker.
const API_INTERNAL_URL = process.env.API_INTERNAL_URL || 'http://localhost:3011';

const nextConfig = {
  reactStrictMode: true,

  /**
   * Truque importante: o navegador NUNCA fala direto com o backend.
   * Tudo que a página pede em "/api/..." o Next repassa para o backend.
   *
   * Por que: assim o site e a API são o MESMO endereço (localhost:3010) para o
   * navegador, e o cookie de login funciona sem complicação.
   */
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_INTERNAL_URL}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
