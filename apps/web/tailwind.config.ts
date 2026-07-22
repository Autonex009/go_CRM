import type { Config } from "tailwindcss";
import preset from "@go-crm/design-tokens/tailwind-preset";

export default {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx}"],
  presets: [preset as Config],
} satisfies Config;
