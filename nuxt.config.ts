// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: [
    '@milkdown/crepe/theme/common/style.css',
    '@milkdown/crepe/theme/frame.css',
    '~/assets/css/main.css',
    '~/assets/css/markdown-editor.css',
  ],
  nitro: {
    esbuild: {
      options: {
        target: 'esnext'
      }
    },
    externals: {
      external: ['sql.js']
    }
  }
})
