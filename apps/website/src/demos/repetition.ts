import { opSmoothUnion, sdBox3d, sdSphere } from '@typegpu/sdf'
import {
	AABB,
	createRaymarchProgram,
	createRaymarchRenderer,
	RaymarchCamera,
	type RaymarchResult,
} from 'luxscura'
import { tgpu } from 'typegpu'
import { f32, mat4x4f, type v2f, type v3f, vec2f, vec3f } from 'typegpu/data'
import {
	abs,
	clamp,
	discard,
	dot,
	floor,
	fract,
	mix,
	sin,
	smoothstep,
} from 'typegpu/std'
import { mat4 } from 'wgpu-matrix'

/** Starts the animated demo on a canvas with its width and height already set. */
export async function createRepetitionDemo(canvas: HTMLCanvasElement) {
	const root = await tgpu.init()
	const canvasContext = root.configureContext({
		canvas,
		alphaMode: 'premultiplied',
	})

	const camera = createCamera(canvas)
	const elapsedTime = root.createUniform(f32, 0)
	const depthTexture = root
		.createTexture({
			size: [canvas.width, canvas.height],
			format: 'depth24plus',
		})
		.$usage('render')

	// This object defines a repeating field of animated shapes and their shared appearance.
	const repetition = {
		// We will render in a volume from [-1000, -1000, -2] to [1000, 1000, 2].
		bounds: () => {
			'use gpu'
			return AABB({
				min: vec3f(-1000, -1000, -2),
				max: vec3f(1000, 1000, 2),
			})
		},

		// Returns the distance to the repeated surface.
		sd: (point: v3f) => {
			'use gpu'
			const xy = point.xy - vec2f(elapsedTime.$ * 0.15)
			const repeatedPoint = vec3f(fract(xy), point.z) - 0.5
			const cell = floor(xy)
			return repetition.cell.sd(repeatedPoint, cell)
		},

		// This object defines the shading shared by every cell.
		appearance: {
			// The purple surface color
			baseColor: hsvToRgb(vec3f(0.8, 0.5, 0.25)),

			// The alignment between the normal and viewing direction where shading is brightest.
			shadingMidPoint: 0.4,

			// Returns the surface color shaded by its orientation toward the camera.
			shade: (result: RaymarchResult) => {
				'use gpu'
				if (!result.isHit) discard()

				const lighting = dot(-1 * result.rayDirection, result.normal)
				const alpha = mix(
					0.5,
					1,
					smoothstep(0, repetition.appearance.shadingMidPoint, lighting) *
						smoothstep(1, repetition.appearance.shadingMidPoint, lighting),
				)

				return repetition.appearance.baseColor * alpha
			},
		},

		// This object defines one cell containing a smoothly joined sphere and box.
		cell: {
			// The distance that determines the smoothness of the union between the shapes.
			smoothing: 0.3,

			// The maximum distance a cell moves above or below in Z.
			zAmplitude: 0.05,

			// Returns the vertical offset for a cell at the given grid coordinates.
			zOffset: (cell: v2f) => {
				'use gpu'
				return (
					sin(cell.x * 2 + cell.y - elapsedTime.$) * repetition.cell.zAmplitude
				)
			},

			// Returns the distance to the cell surface.
			sd: (point: v3f, cell: v2f) => {
				'use gpu'
				const zOffset = repetition.cell.zOffset(cell)
				const spherePhase = repetition.cell.sphere.phase(cell)
				// The box shrinks as the sphere grows, and grows as the sphere shrinks.
				const boxPhase = 1 - spherePhase
				const animatedPoint = point - vec3f(0, 0, zOffset)

				return opSmoothUnion(
					repetition.cell.sphere.sd(animatedPoint, spherePhase),
					repetition.cell.box.sd(animatedPoint, boxPhase),
					repetition.cell.smoothing,
				)
			},

			// This object defines the sphere within each cell.
			sphere: {
				// Returns the distance to the sphere at its current scale.
				sd: (point: v3f, phase: number) => {
					'use gpu'
					return sdSphere(point, 0.3 * phase)
				},

				// Returns a scale from 0 to 1, traveling as a diagonal wave across the grid.
				phase: (cell: v2f) => {
					'use gpu'
					const diagonalPosition = cell.x - cell.y * 2
					const waveAngle = diagonalPosition * 0.5 - elapsedTime.$
					const wave = sin(waveAngle)

					return wave * 0.5 + 0.5
				},
			},

			// This object defines the rounded box within each cell.
			box: {
				// Returns the distance to the scaled box.
				sd: (point: v3f, phase: number) => {
					'use gpu'
					return sdBox3d(point, vec3f(0.15) * phase) - 0.05
				},
			},
		},
	}

	const program = createRaymarchProgram(
		{ epsilon: 0.001 },
		{
			surface: { bounds: repetition.bounds, sd: repetition.sd },
			appearance: repetition.appearance.shade,
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

	const startTime = performance.now()
	let animationFrame: number

	const render = (timestamp: number) => {
		elapsedTime.write((timestamp - startTime) / 1000)
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
			root.destroy()
		},
	}
}

/** Computes the values for a fixed perspective camera. */
function createCamera({ width, height }: { width: number; height: number }) {
	const aspectRatio = width / height
	const position = vec3f(-5, -5, 7)
	const viewProjectionMatrix = mat4x4f()
	const projectionMatrix = mat4.perspective(Math.PI / 8, aspectRatio, 0.1, 100)
	const viewMatrix = mat4.lookAt(position, vec3f(0, 0, 3.5), vec3f(0, 0, 1))
	mat4.multiply(projectionMatrix, viewMatrix, viewProjectionMatrix)

	return { cameraPosition: position, viewProjectionMatrix }
}

/** Converts HSV in [0, 1] to RGB in [0, 1]. Hue wraps every full turn. */
function hsvToRgb(hsv: v3f): v3f {
	'use gpu'
	const hue = fract(vec3f(hsv.x).add(vec3f(0, 2 / 3, 1 / 3)))
	const rgb = clamp(abs(hue.mul(6).sub(3)).sub(1), vec3f(0), vec3f(1))
	return mix(vec3f(1), rgb, hsv.y).mul(hsv.z)
}
