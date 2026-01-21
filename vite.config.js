import { defineConfig } from 'vite'
import { resolve } from 'path'

// Vite 配置 - 多页面应用
export default defineConfig({
  // 多入口配置：前台首页 + 后台管理
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html')
      }
    }
  },
  // 路径别名
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@css': resolve(__dirname, 'src/css'),
      '@js': resolve(__dirname, 'src/js'),
      '@components': resolve(__dirname, 'src/js/components'),
      '@utils': resolve(__dirname, 'src/js/utils')
    }
  },
  // 开发服务器配置
  server: {
    port: 3000,
    open: true
  }
})
