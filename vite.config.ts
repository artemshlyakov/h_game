import { defineConfig } from "vite";
import legacy from "@vitejs/plugin-legacy";

export default defineConfig({
  base: "./",
  build: { sourcemap: "hidden", rollupOptions: { input: "dev.html" } },
  plugins: [legacy({ targets: ["defaults", "ChromeAndroid >= 70", "not IE 11"] }), {
    name: "local-dev-entry",
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        if (request.url === "/") request.url = "/dev.html";
        next();
      });
    },
  }],
});
