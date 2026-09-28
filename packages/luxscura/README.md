# Luxscura

## A TypeGPU Raymarching Renderer

Luxscura is currently in early development. Its package structure and public API
may change.

## TypeGPU setup

Luxscura is build on top of TypeGPU. You will want to set it up in your project as well as the the build plugin so your shaders can get compiled from TypeScript.

- https://docs.swmansion.com/TypeGPU/getting-started/
- https://docs.swmansion.com/TypeGPU/tooling/unplugin-typegpu/

## Usage

1. Create a raymarching program:

```ts
import { createRaymarchProgram } from 'luxscura'

// This is a camera position and view projection matrix
const camera = createCamera() 

const program = createRaymarchProgram({ epsilon: 0.001 }, () => {
	return {
		camera: () => {
			'use gpu'
			return RaymarchCamera({
				position: camera.cameraPosition,
				viewProjectionMatrix: camera.viewProjectionMatrix,
			})
		},

		surface: {
			bounds: () => {
				'use gpu'
				return AABB({ min: vec3f(-1), max: vec3f(1) })
			},
			sd: (point) => {
				'use gpu'
				return sdSphere(point, 1)
			},
		},

		appearance: createMatteAppearance({
			color: () => {
				'use gpu'
				return vec3f(0.15, 0.5, 0.85)
			},
			lighting: createRaymarchConstantLighting({
				ambient: vec3f(0.2, 0.05, 0.05),
				directionalLights: [
					{
						direction: vec3f(-1, 1, -1),
						color: vec3f(1, 0.9, 0.75),
						intensity: 1,
					},
				],
			}),
		}),
	}
})
```

2. And then create a renderer

```ts
import { createRaymarchRenderer } from 'luxscura'

const canvas = document.getElementById('canvas') as HTMLCanvasElement
const root = await tgpu.init()
const renderer = createRaymarchRenderer()

// A depth buffer is currently required
const depthTexture = root
	.createTexture({
		size: [canvas.width, canvas.height],
		format: 'depth24plus',
	})
	.$usage('render')

// This function renders the scene
const render = createRaymarchRenderer({ root, program })

// Render loop
function renderFrame() {
	render({
		colorAttachment: { view: canvasContext },
		depthStencilAttachment: { view: depthTexture },
	})
	requestAnimationFrame(renderFrame)
}
requestAnimationFrame(renderFrame)
```

## More documentation coming soon

See the examples on the website.
