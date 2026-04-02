import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

function normalizeBasePath(basePath: string) {
  const withLeadingSlash = basePath.startsWith("/") ? basePath : `/${basePath}`;
  return withLeadingSlash.endsWith("/")
    ? withLeadingSlash
    : `${withLeadingSlash}/`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const basePath = normalizeBasePath(env.VITE_BASE_PATH || "/");

  return {
    base: basePath,
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: "auto",
        pwaAssets: {
          image: "public/logo.svg",
          preset: "minimal-2023",
          htmlPreset: "2023",
          includeHtmlHeadLinks: true,
          injectThemeColor: true,
          overrideManifestIcons: true,
          integration: {
            baseUrl: basePath,
          },
        },
        manifest: {
          name: "Supabase List Notes",
          short_name: "List Notes",
          description:
            "Supabase List Notes is a lightweight notes app powered by Supabase.",
          theme_color: "#202124",
          background_color: "#202124",
          display: "standalone",
          start_url: basePath,
          scope: basePath,
        },
      }),
    ],
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: "./src/setupTests.ts",
    },
  };
});
