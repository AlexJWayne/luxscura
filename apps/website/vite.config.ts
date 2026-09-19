import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'
import typegpuPlugin from 'unplugin-typegpu/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [typegpuPlugin(), preact(), tailwindcss()],
})
