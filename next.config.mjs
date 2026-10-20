/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Faturas em PDF passam fácil do limite padrão de 1 MB. O Vercel aceita até 4,5 MB por requisição.
    serverActions: { bodySizeLimit: '4mb' },
  },
};

export default nextConfig;
