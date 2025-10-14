import { defineConfig } from 'vite';
import { createHtmlPlugin } from 'vite-plugin-html'

export default defineConfig({
    base: './',
    build: {
        outDir: '../module/webui',
    },
    plugins: [
        createHtmlPlugin({
            minify: true
        })
    ]
});