import { opSmoothUnion, sdBox3d, sdSphere } from '@typegpu/sdf'
import {
	AABB,
	createRaymarchConstantLighting,
	createRaymarchProgram,
	createRaymarchRenderer,
	RaymarchCamera,
	type RaymarchResult,
} from 'luxscura'
import {
	createGlossyAppearance,
	GlossyMaterial,
	mixGlossyMaterials,
} from 'luxscura/glossy'
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

	const logo = {
		bounds: () => {
			'use gpu'
			return AABB({ min: vec3f(-1), max: vec3f(1) })
		},

		smoothing: 0.2,

		sd: (point: v3f) => {
			'use gpu'
			return opSmoothUnion(
				logo.sphere.sd(point),
				logo.box.sd(point),
				logo.smoothing,
			)
		},

		material: (result: RaymarchResult) => {
			'use gpu'

			const sphereDistance = logo.sphere.sd(result.position)
			const boxDistance = logo.box.sd(result.position)
			const sphereWeight = smoothstep(
				0,
				logo.smoothing,
				boxDistance - sphereDistance + logo.smoothing,
			)

			return mixGlossyMaterials(
				logo.box.material(),
				logo.sphere.material(result),
				sphereWeight,
			)
		},

		sphere: {
			sd: (point: v3f) => {
				'use gpu'
				const animatedScale = cos(elapsedTime.$) * 0.04
				return sdSphere(point, 0.8 + animatedScale)
			},

			ring: {
				color: () => {
					'use gpu'
					return hsvToRgb(vec3f(elapsedTime.$ * 0.1, 0.75, 1))
				},

				mask: (result: RaymarchResult) => {
					'use gpu'
					const distance = length(result.position.xz) - 0.35
					const pixelWidth = max(fwidth(distance), 0.000001)
					const halfWidth = 0.07
					return clamp((halfWidth - abs(distance)) / pixelWidth + 0.5, 0, 1)
				},

				emission: (result: RaymarchResult) => {
					'use gpu'
					const mask = logo.sphere.ring.mask(result)
					const color = logo.sphere.ring.color()
					return mask * color
				},
			},

			material: (result: RaymarchResult) => {
				'use gpu'
				return GlossyMaterial({
					baseColor: vec3f(0.7),
					specular: vec3f(0.7),
					shininess: 256,
					emission: logo.sphere.ring.emission(result),
				})
			},
		},

		box: {
			sd: (point: v3f) => {
				'use gpu'
				const animatedScale = sin(elapsedTime.$) * 0.03
				const center = vec3f(0.45 - animatedScale, 0, 0.45 - animatedScale)
				const halfSize = vec3f(0.5 + animatedScale, 0.5, 0.5 + animatedScale)
				return sdBox3d(point - center, halfSize) - 0.02
			},

			material: () => {
				'use gpu'
				return GlossyMaterial({
					baseColor: vec3f(0.25),
					specular: vec3f(0.3),
					shininess: 64,
					emission: vec3f(0),
				})
			},
		},
	}

	const lighting = createRaymarchConstantLighting({
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
	})

	const program = createRaymarchProgram({
		options: { epsilon: 0.001 },
		surface: { bounds: logo.bounds, sd: logo.sd },
		appearance: createGlossyAppearance({ material: logo.material, lighting }),
		camera: () => {
			'use gpu'
			return RaymarchCamera({
				position: camera.cameraPosition,
				viewProjectionMatrix: camera.viewProjectionMatrix,
			})
		},
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
	return (
		<canvas
			ref={canvas}
			width={size * window.devicePixelRatio * 1.5}
			height={size * window.devicePixelRatio * 1.5}
			style={{ width: size, height: size }}
		/>
	)
}

/** Converts HSV in [0, 1] to RGB in [0, 1]. Hue wraps every full turn. */
function hsvToRgb(hsv: v3f): v3f {
	'use gpu'
	const hue = fract(vec3f(hsv.x).add(vec3f(0, 2 / 3, 1 / 3)))
	const rgb = clamp(abs(hue.mul(6).sub(3)).sub(1), vec3f(0), vec3f(1))
	return mix(vec3f(1), rgb, hsv.y).mul(hsv.z)
}
