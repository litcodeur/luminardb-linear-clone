import { type Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";
import typographyPlugin from "@tailwindcss/typography";

export default {
  content: ["./src/**/*.tsx"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", ...fontFamily.sans],
      },
    },
  },
  plugins: [typographyPlugin],
} satisfies Config;
