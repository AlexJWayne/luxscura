import typegpuPlugin from 'unplugin-typegpu/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [typegpuPlugin()],
	build: {
		lib: {
			entry: 'src/index.ts',
			formats: ['es'],
			fileName: 'index',
		},
		sourcemap: true,
		emptyOutDir: true,
		rolldownOptions: {
			external: /^typegpu(?:\/.*)?$/,
		},
	},
})
