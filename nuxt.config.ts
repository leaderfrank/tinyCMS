// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  ssr: false,
  modules: ["@nuxt/ui", "@nuxt/eslint", "@nuxt/icon"],
  css: ["./public/assets/css/main.css"],
  icon: {
    customCollections: [
      {
        prefix: "custom",
        dir: "./public/assets/icons",
      },
    ],
  },
  future: {
    compatibilityVersion: 4,
  },
  compatibilityDate: "2024-11-27",
  devServer: { host: process.env.TAURI_DEV_HOST || "localhost" },
  vite: {
    clearScreen: false,
    envPrefix: ["VITE_", "TAURI_"],
    server: {
      strictPort: true,
    },
  },
});
