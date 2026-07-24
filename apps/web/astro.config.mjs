import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";

// Hybrid output: marketing pages are prerendered (static/SEO) by default, while
// the /app catch-all opts into SSR (prerender = false) so every /app/* path —
// including direct loads and refreshes of nested routes like /app/login — is
// served the SPA shell by the server. React Router still owns navigation.
export default defineConfig({
  output: "hybrid",
  adapter: node({ mode: "standalone" }),
  integrations: [react(), tailwind()],
});
