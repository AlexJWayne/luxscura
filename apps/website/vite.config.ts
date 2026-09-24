import { fileURLToPath } from 'node:url'
import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'
import typegpuPlugin from 'unplugin-typegpu/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [typegpuPlugin(), preact(), tailwindcss()],
	resolve: {
		alias: [
			{
				find: /^luxscura$/,
				replacement: fileURLToPath(
					new URL('../../packages/luxscura/src/index.ts', import.meta.url),
				),
			},
			{
				find: /^luxscura\/pbr$/,
				replacement: fileURLToPath(
					new URL(
						'../../packages/luxscura/src/appearances/pbr/index.ts',
						import.meta.url,
					),
				),
			},
		],
		dedupe: ['typegpu'],
	},
})
