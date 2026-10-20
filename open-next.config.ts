import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Pages are static and data comes from /api, so no incremental (ISR) cache is needed.
export default defineCloudflareConfig({});
