import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
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
            },
            manifest: {
                name: "Supabase Notes",
                short_name: "Notes",
                description: "Supabase Notes is a lightweight notes app powered by Supabase.",
                theme_color: "#3ecf8e",
                background_color: "#ffffff",
                display: "standalone",
                start_url: "/",
            },
        }),
    ],
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: "./src/setupTests.ts",
    },
});
