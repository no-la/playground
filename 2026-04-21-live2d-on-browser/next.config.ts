import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  output: "export",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
  // 静的エクスポート時は画像最適化を無効化
  images: { unoptimized: true },
};

export default nextConfig;
