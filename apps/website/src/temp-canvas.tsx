import { opSmoothUnion, sdBox3d, sdSphere } from '@typegpu/sdf'
import {
	AABB,
	createRaymarchConstantLighting,
	createRaymarchProgram,
	createRaymarchRenderer,
	RaymarchCamera,
	RaymarchMaterial,
} from 'luxscura'
import { useEffect, useRef } from 'preact/hooks'
import { tgpu } from 'typegpu'
import { vec2f, vec3f } from 'typegpu/data'
import { atan2, mix, sin, smoothstep } from 'typegpu/std'
import { createCamera } from './create-camera'

const sphereProgram = createRaymarchProgram({ epsilon: 0.001 }, () => {
	const { cameraPosition, viewProjectionMatrix } = createCamera({
		position: vec3f(0, 0, 4),
		target: vec3f(0),
		fieldOfView: Math.PI / 4,
		near: 0.1,
		far: 100,
	})

	// Return the raymarch program
	return {
		bounds: () => {
			'use gpu'
			return AABB({ min: vec3f(-1), max: vec3f(1) })
		},
		sd: (point) => {
			'use gpu'
			return opSmoothUnion(
				sdSphere(point - vec3f(0), 0.8),
				sdBox3d(point - vec3f(vec2f(0.5), 0), vec3f(0.45)),
				0.3,
			)
		},
		sample: () => {
			'use gpu'
			return RaymarchMaterial({
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
					direction: vec3f(-1, -1, -1),
					color: vec3f(1, 1, 1),
					intensity: 1.6,
				},
				{
					direction: vec3f(5, -8, -1),
					color: vec3f(1, 0.15, 0.1),
					intensity: 0.75,
				},
			],
		}),

		environment: (direction, roughness) => {
			'use gpu'

			const angle = atan2(direction.x, direction.z) * Math.PI
			const y =
				direction.y + //
				sin(angle * 3) * 0.08 +
				sin(angle * 1) * 0.12

			const skyOrGround = smoothstep(-roughness, roughness, y)
			return mix(vec3f(0.3, 0.15, 0), vec3f(0, 0.3, 0.6), skyOrGround)
		},

		camera: () => {
			'use gpu'
			return RaymarchCamera({ position: cameraPosition, viewProjectionMatrix })
		},
	}
})

async function createSphereRenderer(canvas: HTMLCanvasElement) {
	const root = await tgpu.init()
	const context = root.configureContext({ canvas })

	const depthTexture = root
		.createTexture({
			size: [canvas.width, canvas.height],
			format: 'depth24plus',
		})
		.$usage('render')

	const render = createRaymarchRenderer({
		root,
		program: sphereProgram,
	})

	// render the scene
	render({
		colorAttachment: { view: context },
		depthStencilAttachment: { view: depthTexture },
	})

	return {
		destroy: () => root.destroy(),
	}
}

function useSphereRenderer() {
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		let renderer: Awaited<ReturnType<typeof createSphereRenderer>> | undefined
		let disposed = false

		void createSphereRenderer(canvas).then((nextRenderer) => {
			if (disposed) nextRenderer.destroy()
			else renderer = nextRenderer
		})

		return () => {
			disposed = true
			renderer?.destroy()
		}
	}, [])

	return canvasRef
}

export function TempCanvas() {
	const canvasRef = useSphereRenderer()
	return <canvas ref={canvasRef} width={800} height={800} />
}
