import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";

// Static marketing pages + a React island mounted at /app for the dashboard SPA.
export default defineConfig({
  integrations: [react(), tailwind()],
});
