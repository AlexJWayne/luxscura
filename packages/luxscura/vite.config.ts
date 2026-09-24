import typegpuPlugin from 'unplugin-typegpu/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [typegpuPlugin()],
	build: {
		lib: {
			entry: {
				index: 'src/index.ts',
				pbr: 'src/appearances/pbr/index.ts',
			},
			formats: ['es'],
		},
		sourcemap: true,
		emptyOutDir: true,
		rolldownOptions: {
			external: /^typegpu(?:\/.*)?$/,
		},
	},
})
