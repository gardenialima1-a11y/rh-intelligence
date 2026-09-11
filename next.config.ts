import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // A Vercel limita o corpo de requisições de Serverless Function a
      // 4.5MB, independente do valor configurado aqui — 8mb dava a falsa
      // impressão de que anexos maiores funcionariam em produção, quando na
      // prática eram rejeitados pela plataforma antes de chegar no Next.js.
      // 4mb fica dentro do limite real da Vercel com uma margem de segurança.
      bodySizeLimit: "4mb",
    },
  },
  serverExternalPackages: ["pdfjs-dist"],
  outputFileTracingIncludes: {
    "/**": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
};

export default nextConfig;
