import { defineConfig } from "vite";

// 用相对 base，方便部署到 GitHub Pages 等子路径环境。
export default defineConfig({
  base: "./",
  server: {
    host: true,
  },
});
