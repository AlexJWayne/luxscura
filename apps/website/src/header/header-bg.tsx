import { opSmoothUnion, sdBox3d, sdSphere } from '@typegpu/sdf'
import {
	AABB,
	createRaymarchProgram,
	createRaymarchRenderer,
	RaymarchCamera,
	type RaymarchResult,
} from 'luxscura'
import type { RenderFlag, TgpuRoot, TgpuTexture } from 'typegpu'
import { f32, mat4x4f, type v2f, type v3f, vec2f, vec3f } from 'typegpu/data'
import { discard, dot, floor, fract, mix, sin, smoothstep } from 'typegpu/std'
import { mat4 } from 'wgpu-matrix'
import { hsvToRgb } from '../hsv'
import { useLuxscuraRenderer } from '../use-luxscura-renderer'

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

	const background = {
		bounds: () => {
			'use gpu'
			return AABB({
				min: vec3f(-1000, -1000, -2),
				max: vec3f(1000, 1000, 2),
			})
		},

		sd: (point: v3f) => {
			'use gpu'
			const xy = point.xy - vec2f(elapsedTime.$ * 0.15)
			const repeatedPoint = vec3f(fract(xy), point.z) - 0.5
			const cell = floor(xy)
			return background.cell.sd(repeatedPoint, cell)
		},

		appearance: {
			baseColor: hsvToRgb(vec3f(0.8, 0.5, 0.25)),
			shadingMidPoint: 0.4,

			shade: (result: RaymarchResult) => {
				'use gpu'
				if (!result.isHit) discard()

				const lighting = dot(-1 * result.rayDirection, result.normal)
				const alpha = mix(
					0.5,
					1,
					smoothstep(0, background.appearance.shadingMidPoint, lighting) *
						smoothstep(1, background.appearance.shadingMidPoint, lighting),
				)

				return background.appearance.baseColor * alpha
			},
		},

		cell: {
			smoothing: 0.3,
			zAmplitude: 0.05,

			zOffset: (cell: v2f) => {
				'use gpu'
				return (
					sin(cell.x * 2 + cell.y - elapsedTime.$) * background.cell.zAmplitude
				)
			},

			sd: (point: v3f, cell: v2f) => {
				'use gpu'
				const zOffset = background.cell.zOffset(cell)
				const spherePhase = background.cell.sphere.phase(cell)
				const boxPhase = 1 - spherePhase
				const animatedPoint = point - vec3f(0, 0, zOffset)

				return opSmoothUnion(
					background.cell.sphere.sd(animatedPoint, spherePhase),
					background.cell.box.sd(animatedPoint, boxPhase),
					background.cell.smoothing,
				)
			},

			sphere: {
				phase: (cell: v2f) => {
					'use gpu'
					const diagonalPosition = cell.x - cell.y * 2
					const waveAngle = diagonalPosition * 0.5 - elapsedTime.$
					const wave = sin(waveAngle)

					return wave * 0.5 + 0.5
				},

				sd: (point: v3f, phase: number) => {
					'use gpu'
					return sdSphere(point, 0.3 * phase)
				},
			},

			box: {
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
			surface: { bounds: background.bounds, sd: background.sd },
			appearance: background.appearance.shade,
			camera: () => {
				'use gpu'
				return RaymarchCamera(cameraUniform.$)
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
