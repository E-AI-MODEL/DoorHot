import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/v1": "http://127.0.0.1:4000",
      "/health": "http://127.0.0.1:4000",
      "/metrics": "http://127.0.0.1:4000"
    }
  },
  preview: {
    host: "0.0.0.0",
    port: 4173
  }
});
