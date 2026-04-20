import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@switchboard-flags/client"],
};

export default nextConfig;
