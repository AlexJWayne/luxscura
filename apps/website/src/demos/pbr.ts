import { sdSphere } from '@typegpu/sdf'
import {
	AABB,
	createRaymarchConstantLighting,
	createRaymarchProgram,
	createRaymarchRenderer,
	RaymarchCamera,
} from 'luxscura'
import { createPbrAppearance, PbrMaterial } from 'luxscura/pbr'
import { tgpu } from 'typegpu'
import { i32, mat4x4f, vec3f } from 'typegpu/data'
import { abs, floor, fract, max, mix, smoothstep } from 'typegpu/std'
import { mat4 } from 'wgpu-matrix'

/** Renders once on a canvas with its width and height already set. */
export async function createPbrDemo(canvas: HTMLCanvasElement) {
	const root = await tgpu.init()
	const canvasContext = root.configureContext({ canvas })

	const camera = createCamera(canvas)
	const depthTexture = root
		.createTexture({
			size: [canvas.width, canvas.height],
			format: 'depth24plus',
		})
		.$usage('render')

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

			appearance: createPbrAppearance({
				material: () => {
					'use gpu'
					return PbrMaterial({
						baseColor: vec3f(0.85, 0.9, 1),
						metallic: 0.5,
						roughness: 0.08,
						emission: vec3f(0),
					})
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
				environment: (direction, roughness) => {
					'use gpu'
					// A blue sky above a warm floor with soft light and dark squares.
					const sky = smoothstep(-0.1 - roughness, 0.1 + roughness, direction.z)
					const color = mix(
						vec3f(0.45, 0.16, 0.06),
						vec3f(0.12, 0.35, 0.65),
						sky,
					)
					const x = direction.x * 2.5
					const z = direction.z * 2.5
					const box = max(abs(fract(x) - 0.5), abs(fract(z) - 0.5))
					const panel = (1 - smoothstep(0.28, 0.3 + roughness, box)) * (1 - sky)
					const isLight = i32(floor(x) + floor(z)) % 2 === 0
					return mix(color, isLight ? vec3f(0.65) : vec3f(0.04), panel)
				},
			}),
		}
	})

	const render = createRaymarchRenderer({ root, program })

	render({
		colorAttachment: { view: canvasContext },
		depthStencilAttachment: { view: depthTexture },
	})

	return { destroy: () => root.destroy() }
}

/** Computes the values for a fixed perspective camera. */
function createCamera({ width, height }: { width: number; height: number }) {
	const aspectRatio = width / height
	const position = vec3f(0, -3, 1)
	const viewProjectionMatrix = mat4x4f()
	const projectionMatrix = mat4.perspective(Math.PI / 4, aspectRatio, 0.1, 10)
	const viewMatrix = mat4.lookAt(position, vec3f(0), vec3f(0, 0, 1))
	mat4.multiply(projectionMatrix, viewMatrix, viewProjectionMatrix)

	return { cameraPosition: position, viewProjectionMatrix }
}
