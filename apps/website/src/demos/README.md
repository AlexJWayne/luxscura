# Standalone demos

Each demo is a complete TypeScript file. Copy `hello.ts` for a minimal sphere that
renders once, or `logo.ts` for an animated scene with PBR lighting. Neither demo
depends on Preact or other files in this repository.

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
import { createDemoRenderer } from './hello'

const canvas = document.createElement('canvas')
canvas.width = 800
canvas.height = 800
document.body.append(canvas)

const demo = await createDemoRenderer(canvas)

// When removing the canvas or leaving the page:
// demo.destroy()
```

Both demos use the canvas dimensions for the camera's aspect ratio and depth
texture. If you change those dimensions, destroy and recreate the demo. The logo
demo's `destroy()` also stops its animation loop.
