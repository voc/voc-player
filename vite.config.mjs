import { defineConfig } from "vite";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: "dist",
    lib: {
      entry: resolve(__dirname, "src/library.js"),
      formats: ["umd", "es"],
      name: "VOCPlayer",
    },
  },
  server: {
    open: true,
  },
  resolve: {
    alias: {
      plugins: "/src/plugins",
      lib: "/src/lib",
      public: "/src/public",
    },
  },
  define: {
    PLAYER_VERSION: JSON.stringify(process.env.npm_package_version),
  },
});
