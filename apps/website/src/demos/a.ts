import { opSmoothUnion, sdBox3d, sdSphere } from '@typegpu/sdf'
import {
	AABB,
	createRaymarchProgram,
	createRaymarchRenderer,
	RaymarchCamera,
} from 'luxscura'
import {
	createPbrAppearance,
	createRaymarchConstantLighting,
	PbrMaterial,
} from 'luxscura/pbr'
import { tgpu } from 'typegpu'
import { f32, mat4x4f, type v3f, vec3f } from 'typegpu/data'
import { atan2, cos, mix, sin, smoothstep } from 'typegpu/std'
import { mat4 } from 'wgpu-matrix'

/** Starts the animated demo on a canvas with its width and height already set. */
export async function createDemoRenderer(canvas: HTMLCanvasElement) {
	const root = await tgpu.init()
	const canvasContext = root.configureContext({ canvas })

	const camera = createCamera(canvas)
	const elapsedTime = root.createUniform(f32, 0)
	const depthTexture = root
		.createTexture({
			size: [canvas.width, canvas.height],
			format: 'depth24plus',
		})
		.$usage('render')

	const program = createRaymarchProgram({ epsilon: 0.001 }, () => {
		function sdMySphere(point: v3f) {
			'use gpu'
			const animatedScale = sin(elapsedTime.$) * 0.08
			return sdSphere(point, 0.8 + animatedScale)
		}

		function sdMyBox(point: v3f) {
			'use gpu'
			const animatedScale = cos(elapsedTime.$) * 0.06
			const center = vec3f(0.45 - animatedScale, 0, 0.45 - animatedScale)
			const halfSize = vec3f(0.5 + animatedScale, 0.5, 0.5 + animatedScale)
			return sdBox3d(point - center, halfSize) - 0.02
		}

		return {
			surface: {
				bounds: () => {
					'use gpu'
					return AABB({ min: vec3f(-1), max: vec3f(1) })
				},
				sd: (point) => {
					'use gpu'
					return opSmoothUnion(sdMySphere(point), sdMyBox(point), 0.2)
				},
			},
			appearance: createPbrAppearance({
				material: () => {
					'use gpu'
					return PbrMaterial({
						baseColor: vec3f(0.12, 0.45, 0.9),
						metallic: 0.5,
						roughness: 0.2,
						emission: vec3f(0),
					})
				},
				lighting: createRaymarchConstantLighting({
					ambient: vec3f(0),
					directionalLights: [
						{
							direction: vec3f(-1, 1, -1),
							color: vec3f(1, 1, 1),
							intensity: 1.6,
						},
						{
							direction: vec3f(5, 1, -8),
							color: vec3f(1, 0.15, 0.1),
							intensity: 0.75,
						},
					],
				}),

				environment: (direction, roughness) => {
					'use gpu'

					const angle =
						atan2(direction.x, -direction.y) * Math.PI + elapsedTime.$
					const z =
						direction.z + //
						sin(angle * 3) * 0.08 +
						sin(-angle * 1) * 0.12

					const skyOrGround = smoothstep(-roughness, roughness, z)
					return mix(vec3f(0.3, 0.15, 0), vec3f(0, 0.3, 0.6), skyOrGround)
				},
			}),

			camera: () => {
				'use gpu'
				return RaymarchCamera({
					position: camera.cameraPosition,
					viewProjectionMatrix: camera.viewProjectionMatrix,
				})
			},
		}
	})

	const raymarchRender = createRaymarchRenderer({
		root,
		program,
	})

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
	const position = vec3f(0, -4, 0)
	const viewProjectionMatrix = mat4x4f()
	const projectionMatrix = mat4.perspective(Math.PI / 5, aspectRatio, 0.1, 100)
	const viewMatrix = mat4.lookAt(position, vec3f(0), vec3f(0, 0, 1))
	mat4.multiply(projectionMatrix, viewMatrix, viewProjectionMatrix)

	return { cameraPosition: position, viewProjectionMatrix }
}
