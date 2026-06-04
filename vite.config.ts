import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 静的サイトとして配信する想定。GitHub Pages 等にも置けるよう base は相対パス。
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
});
