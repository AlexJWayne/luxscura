import {
	opSmoothDifference,
	opSmoothUnion,
	sdBox3d,
	sdSphere,
} from '@typegpu/sdf'
import {
	AABB,
	createRaymarchConstantLighting,
	createRaymarchProgram,
	createRaymarchRenderer,
	RaymarchCamera,
	type RaymarchResult,
} from 'luxscura'
import { createGlossyAppearance, GlossyMaterial } from 'luxscura/glossy'
import { tgpu } from 'typegpu'
import { f32, mat4x4f, type v3f, vec2f, vec3f } from 'typegpu/data'
import { abs, fract, saturate, smoothstep } from 'typegpu/std'
import { mat4, vec3 } from 'wgpu-matrix'

/** Starts the interactive example on a canvas with its width and height already set. */
export async function createMouseExample(canvas: HTMLCanvasElement) {
	const root = await tgpu.init()
	const canvasContext = root.configureContext({
		canvas,
		alphaMode: 'premultiplied',
	})
	const depthTexture = root
		.createTexture({
			size: [canvas.width, canvas.height],
			format: 'depth24plus',
		})
		.$usage('render')

	const camera = createCamera(canvas)
	const spherePosition = root.createUniform(vec3f, vec3f(0))

	// -1 subtracts the sphere, 0 leaves the grid alone, and 1 adds the sphere.
	const sphereEffect = root.createUniform(f32, 1)

	// A repeated grid of cubes with a mouse-controlled sphere that adds or removes volume.
	const mouse = {
		smoothing: 0.8,

		bounds: () => {
			'use gpu'
			return AABB({
				min: vec3f(-1000, -1000, -1.5),
				max: vec3f(1000, 1000, 1.5),
			})
		},

		sd: (point: v3f) => {
			'use gpu'
			const gridDistance = mouse.grid.sd(point)
			const scale = mouse.sphere.scale()
			if (scale === 0) return gridDistance

			const sphereDistance = mouse.sphere.sd(point)
			const smoothing = mouse.smoothing * scale
			if (sphereEffect.$ < 0) {
				return opSmoothDifference(gridDistance, sphereDistance, smoothing)
			} else {
				return opSmoothUnion(gridDistance, sphereDistance, smoothing)
			}
		},

		grid: {
			spacing: 1.25,

			// Repeat in X and Y.
			point: (point: v3f) => {
				'use gpu'
				const xy =
					(fract(point.xy / mouse.grid.spacing + vec2f(0.5)) - vec2f(0.5)) *
					mouse.grid.spacing
				return vec3f(xy, point.z)
			},

			sd: (point: v3f) => {
				'use gpu'
				return mouse.grid.cube.sd(mouse.grid.point(point))
			},

			cube: {
				halfSize: 0.4,

				sd: (point: v3f) => {
					'use gpu'
					return sdBox3d(point, vec3f(mouse.grid.cube.halfSize))
				},
			},
		},

		sphere: {
			radius: 1.3,

			// Ease to zero halfway through the transition, then grow the opposite effect.
			scale: () => {
				'use gpu'
				return smoothstep(0, 1, abs(sphereEffect.$))
			},

			sd: (point: v3f) => {
				'use gpu'
				return sdSphere(
					point - spherePosition.$,
					mouse.sphere.radius * mouse.sphere.scale(),
				)
			},
		},

		// A shared glossy material makes the shapes look like one continuous surface.
		material: (result: RaymarchResult) => {
			'use gpu'
			const height = abs(result.position.z)
			const blue = saturate((height * 2) ** 2)
			return GlossyMaterial({
				baseColor: vec3f(0.5, 0.14, blue),
				specular: vec3f(0.6),
				shininess: 96,
				emission: vec3f(0),
			})
		},
	}

	const lighting = createRaymarchConstantLighting({
		ambient: vec3f(0.25),
		directionalLights: [
			{
				direction: vec3f(-3, -4, -6),
				color: vec3f(1),
				intensity: 1,
			},
		],
	})

	const program = createRaymarchProgram(
		{ epsilon: 0.001 },
		{
			surface: { bounds: mouse.bounds, sd: mouse.sd },
			appearance: createGlossyAppearance({
				material: mouse.material,
				lighting,
			}),
			camera: () => {
				'use gpu'
				return RaymarchCamera({
					position: camera.cameraPosition,
					viewProjectionMatrix: camera.viewProjectionMatrix,
				})
			},
		},
	)
	const raymarchRender = createRaymarchRenderer({ root, program })

	const onPointerMove = (event: PointerEvent) => {
		const bounds = canvas.getBoundingClientRect()
		const x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
		const y = 1 - ((event.clientY - bounds.top) / bounds.height) * 2

		// Unproject the cursor, then intersect its camera ray with the grid's Z = 0 plane.
		const farPoint = vec3.transformMat4([x, y, 1], camera.inverseViewProjection)
		const direction = vec3.subtract(farPoint, camera.cameraPosition)
		const distance = -camera.cameraPosition.z / direction[2]
		spherePosition.write(
			vec3f(
				camera.cameraPosition.x + direction[0] * distance,
				camera.cameraPosition.y + direction[1] * distance,
				0,
			),
		)
	}
	canvas.addEventListener('pointermove', onPointerMove)

	const transitionDuration = 350 // Milliseconds for a complete shrink-and-grow cycle.
	let effect = 1
	let targetEffect = 1
	const onClick = () => {
		// Reversing the target also reverses an in-progress transition.
		targetEffect *= -1
	}
	canvas.addEventListener('click', onClick)

	let previousTime = performance.now()
	let animationFrame: number
	const render = (timestamp: number) => {
		const step = ((timestamp - previousTime) / transitionDuration) * 2
		previousTime = timestamp
		effect =
			targetEffect > effect
				? Math.min(targetEffect, effect + step)
				: Math.max(targetEffect, effect - step)
		sphereEffect.write(effect)

		raymarchRender({
			colorAttachment: { view: canvasContext },
			depthStencilAttachment: { view: depthTexture },
		})
		animationFrame = requestAnimationFrame(render)
	}
	animationFrame = requestAnimationFrame(render)

	return {
		destroy: () => {
			cancelAnimationFrame(animationFrame)
			canvas.removeEventListener('pointermove', onPointerMove)
			canvas.removeEventListener('click', onClick)
			root.destroy()
		},
	}
}

/** Computes a fixed perspective camera and its inverse for pointer picking. */
function createCamera({ width, height }: { width: number; height: number }) {
	const position = vec3f(0, -5, 9)
	const viewProjectionMatrix = mat4x4f()
	const projectionMatrix = mat4.perspective(
		Math.PI / 4,
		width / height,
		0.1,
		100,
	)
	const viewMatrix = mat4.lookAt(position, vec3f(0), vec3f(0, 0, 1))
	mat4.multiply(projectionMatrix, viewMatrix, viewProjectionMatrix)

	return {
		cameraPosition: position,
		viewProjectionMatrix,
		inverseViewProjection: mat4.inverse(viewProjectionMatrix),
	}
}
