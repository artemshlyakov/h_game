import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: { rollupOptions: { input: "dev.html" } },
  plugins: [{
    name: "local-dev-entry",
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        if (request.url === "/") request.url = "/dev.html";
        next();
      });
    },
  }],
});
