# Standalone demos

Each demo is a complete TypeScript file. Copy `matte.ts` for a colored sphere with
directional lighting and ambient fill, `glossy.ts` for the same sphere with a shiny
highlight, `pbr.ts` for a metallic sphere reflecting a procedural environment at
8% roughness, or `logo.ts` for an animated scene with PBR lighting. The demos do
not depend on Preact or other files in this repository.

Install the runtime dependencies:

```sh
npm install luxscura typegpu @typegpu/sdf wgpu-matrix
```

Configure your bundler with the TypeGPU plugin to compile the GPU functions. For
Vite, install `unplugin-typegpu` and include it in your existing plugins:

```sh
npm install -D unplugin-typegpu @webgpu/types
```

```ts
import typegpu from 'unplugin-typegpu/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [typegpu()],
})
```

For TypeScript, include `@webgpu/types` in your `compilerOptions.types` alongside
any other types your project uses.

Set your canvas's drawing dimensions before starting the demo in a browser with
WebGPU support:

```ts
import { createMatteDemo } from './matte'

const canvas = document.createElement('canvas')
canvas.width = 800
canvas.height = 800
document.body.append(canvas)

const demo = await createMatteDemo(canvas)

// When removing the canvas or leaving the page:
// demo.destroy()
```

All demos use the canvas dimensions for the camera's aspect ratio and depth
texture. If you change those dimensions, destroy and recreate the demo. The logo
demo's `destroy()` also stops its animation loop.
