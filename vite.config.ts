import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfig_paths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [reactRouter(), tsconfig_paths()],
  server: {
    port: 5173,
  },
});
