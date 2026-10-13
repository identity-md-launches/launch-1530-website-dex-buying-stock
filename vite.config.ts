import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks: { react: ["react", "react-dom"], ethereum: ["viem"] },
      },
    },
  },
});
