import { opSmoothUnion, sdBox3d, sdSphere } from '@typegpu/sdf'
import {
	AABB,
	createRaymarchConstantLighting,
	createRaymarchProgram,
	createRaymarchRenderer,
	RaymarchCamera,
} from 'luxscura'
import { createGlossyAppearance, GlossyMaterial } from 'luxscura/glossy'
import type { TgpuRoot } from 'typegpu'
import { f32, mat4x4f, type v3f, vec3f } from 'typegpu/data'
import {
	abs,
	clamp,
	cos,
	fract,
	fwidth,
	length,
	max,
	mix,
	sin,
	smoothstep,
} from 'typegpu/std'
import { mat4 } from 'wgpu-matrix'
import { useLuxscuraRenderer } from '../use-luxscura-renderer'

const SHAPE_SMOOTHING = 0.2

function createLogoRenderer(root: TgpuRoot, canvas: HTMLCanvasElement) {
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

	const program = createRaymarchProgram({ epsilon: 0.001 }, () => {
		function sdLogoSphere(point: v3f) {
			'use gpu'
			const animatedScale = cos(elapsedTime.$) * 0.04
			return sdSphere(point, 0.8 + animatedScale)
		}

		function sdLogoBox(point: v3f) {
			'use gpu'
			const animatedScale = sin(elapsedTime.$) * 0.03
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
					return opSmoothUnion(
						sdLogoSphere(point),
						sdLogoBox(point),
						SHAPE_SMOOTHING,
					)
				},
			},
			appearance: createGlossyAppearance({
				lighting: createRaymarchConstantLighting({
					ambient: vec3f(0.35),
					directionalLights: [
						{
							direction: vec3f(-1, 1, -1),
							color: vec3f(1, 1, 1),
							intensity: 1,
						},
						{
							direction: vec3f(5, 1, -5),
							color: vec3f(1, 0.15, 0.1),
							intensity: 0.4,
						},
					],
				}),
				material: (result) => {
					'use gpu'

					const sphereDistance = sdLogoSphere(result.position)
					const boxDistance = sdLogoBox(result.position)

					const isSphere = smoothstep(
						0,
						SHAPE_SMOOTHING,
						boxDistance - sphereDistance + SHAPE_SMOOTHING,
					)

					const sphereColor = vec3f(0.7)
					const boxColor = vec3f(0.3)

					const distance = length(result.position.xz) - 0.35
					const pixelWidth = max(fwidth(distance), 0.000001)
					const halfWidth = 0.07

					const glow = clamp(
						(halfWidth - abs(distance)) / pixelWidth + 0.5,
						0,
						1,
					)
					const glowColor = hsvToRgb(vec3f(elapsedTime.$ * 0.1, 0.75, 1)) * glow

					return GlossyMaterial({
						baseColor: mix(boxColor, sphereColor, isSphere),
						specular: vec3f(0.7),
						shininess: 256,
						emission: glowColor,
					})
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

	return { destroy: () => cancelAnimationFrame(animationFrame) }
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

export function Logo({ size, root }: { size: number; root: TgpuRoot }) {
	const canvas = useLuxscuraRenderer(root, createLogoRenderer)
	return <canvas ref={canvas} width={size} height={size} />
}

/** Converts HSV in [0, 1] to RGB in [0, 1]. Hue wraps every full turn. */
function hsvToRgb(hsv: v3f): v3f {
	'use gpu'
	const hue = fract(vec3f(hsv.x).add(vec3f(0, 2 / 3, 1 / 3)))
	const rgb = clamp(abs(hue.mul(6).sub(3)).sub(1), vec3f(0), vec3f(1))
	return mix(vec3f(1), rgb, hsv.y).mul(hsv.z)
}
