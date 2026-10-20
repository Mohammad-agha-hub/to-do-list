import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {};

// Gives `next dev` the same Cloudflare bindings (the local D1 database) as production.
if (process.env.NODE_ENV === "development") initOpenNextCloudflareForDev();

export default nextConfig;
