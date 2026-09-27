import { opSmoothUnion, sdBox3d, sdSphere } from '@typegpu/sdf'
import {
	AABB,
	createRaymarchProgram,
	createRaymarchRenderer,
	RaymarchCamera,
} from 'luxscura'
import type { RenderFlag, TgpuRoot, TgpuTexture } from 'typegpu'
import { f32, mat4x4f, vec3f } from 'typegpu/data'
import { discard, dot, floor, fract, mix, sin, smoothstep } from 'typegpu/std'
import { mat4 } from 'wgpu-matrix'
import { hsvToRgb } from '../hsv'
import { useLuxscuraRenderer } from '../use-luxscura-renderer'

const Z_AMPLITUDE = 0.05
const BASE_COLOR = hsvToRgb(vec3f(0.8, 0.5, 0.25))

const SHADING_MID_POINT = 0.4

export function LuxscuraHeaderBg({ root }: { root: TgpuRoot }) {
	const canvas = useLuxscuraRenderer(root, createHeaderBgRenderer)
	return <canvas ref={canvas} class="absolute w-full h-full" />
}

export function createHeaderBgRenderer(
	root: TgpuRoot,
	canvas: HTMLCanvasElement,
) {
	function resize() {
		canvas.width = canvas.clientWidth
		canvas.height = canvas.clientHeight

		depthTexture = root
			.createTexture({
				size: [canvas.width, canvas.height],
				format: 'depth24plus',
			})
			.$usage('render')

		const cameraValues = createCamera(canvas)
		cameraUniform.write(
			RaymarchCamera({
				viewProjectionMatrix: cameraValues.viewProjectionMatrix,
				position: cameraValues.cameraPosition,
			}),
		)
	}

	const cameraUniform = root.createUniform(RaymarchCamera)
	let depthTexture: TgpuTexture<{
		size: [number, number]
		format: 'depth24plus'
	}> &
		RenderFlag

	resize()

	const canvasContext = root.configureContext({
		canvas,
		alphaMode: 'premultiplied',
	})

	const elapsedTime = root.createUniform(f32, 0)

	const program = createRaymarchProgram({ epsilon: 0.001 }, () => {
		return {
			surface: {
				bounds: () => {
					'use gpu'
					return AABB({
						min: vec3f(-1000, -1000, -2),
						max: vec3f(1000, 1000, 2),
					})
				},

				sd: (point) => {
					'use gpu'

					const repeatedPoint = vec3f(fract(point).xy, point.z) - 0.5
					const cell = floor(point.xy)

					const zOffset = sin(cell.x * 2 + cell.y - elapsedTime.$) * Z_AMPLITUDE
					const spherePhase =
						sin((cell.x - cell.y * 2) * 0.5 - elapsedTime.$) * 0.5 + 0.5
					const cubePhase = 1 - spherePhase

					const sphereDistance = sdSphere(
						repeatedPoint - vec3f(0, 0, zOffset),
						0.3 * spherePhase,
					)
					const cubeDistance =
						sdBox3d(
							repeatedPoint - vec3f(0, 0, zOffset),
							vec3f(0.15) * cubePhase,
						) - 0.05

					return opSmoothUnion(sphereDistance, cubeDistance, 0.3)
				},
			},

			appearance: (result) => {
				'use gpu'
				if (!result.isHit) discard()

				const lighting = dot(-1 * result.rayDirection, result.normal)
				const alpha = mix(
					0.5,
					1,
					smoothstep(0, SHADING_MID_POINT, lighting) *
						smoothstep(1, SHADING_MID_POINT, lighting),
				)

				return BASE_COLOR * alpha
			},

			camera: () => {
				'use gpu'
				return RaymarchCamera(cameraUniform.$)
			},
		}
	})

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
		destroy: () => cancelAnimationFrame(animationFrame),
		resize,
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
