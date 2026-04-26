import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(() => {
  return {
    build: {
      outDir: "build",
    },
    plugins: [react()],
    server: {
      port: 8301,
      allowedHosts: [".apps-tunnel.monday.app"],
      proxy: {
        // Anything the frontend hits at /api/* gets forwarded to the local
        // backend (port 8080). This keeps everything on the same HTTPS origin
        // when accessed through the mapps tunnel, so the browser doesn't
        // block the request as mixed content.
        "/api": {
          target: "http://localhost:8080",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
  };
});
