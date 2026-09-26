import { sdSphere } from '@typegpu/sdf'
import {
	AABB,
	createRaymarchProgram,
	createRaymarchRenderer,
	RaymarchCamera,
} from 'luxscura'
import { tgpu } from 'typegpu'
import { mat4x4f, vec3f } from 'typegpu/data'
import { dot, normalize, saturate } from 'typegpu/std'
import { mat4 } from 'wgpu-matrix'

/** Renders once on a canvas with its width and height already set. */
export async function createDemoRenderer(canvas: HTMLCanvasElement) {
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

			appearance: (result) => {
				'use gpu'
				const lightDir = normalize(vec3f(1, -1, 1))
				const lighting = saturate(dot(result.normal, lightDir))
				return vec3f(lighting)
			},
		}
	})

	const render = createRaymarchRenderer({
		root,
		program,
	})

	render({
		colorAttachment: { view: canvasContext },
		depthStencilAttachment: { view: depthTexture },
	})

	return { destroy: () => root.destroy() }
}

/** Computes the values for a fixed perspective camera. */
function createCamera({ width, height }: { width: number; height: number }) {
	const aspectRatio = width / height
	const position = vec3f(0, -3, 0)
	const viewProjectionMatrix = mat4x4f()
	const projectionMatrix = mat4.perspective(Math.PI / 4, aspectRatio, 0.1, 10)
	const viewMatrix = mat4.lookAt(position, vec3f(0), vec3f(0, 0, 1))
	mat4.multiply(projectionMatrix, viewMatrix, viewProjectionMatrix)

	return { cameraPosition: position, viewProjectionMatrix }
}
