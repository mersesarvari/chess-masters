import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        bot: resolve(__dirname, "public/bot.js"),
        content: resolve(__dirname, "public/board.js"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name === "main" ? "[name].[hash].js" : "[name].js";
        },
      },
    },
    outDir: "dist",
    emptyOutDir: true,
  },
});
