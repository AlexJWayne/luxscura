import { sdSphere } from '@typegpu/sdf'
import {
	AABB,
	createRaymarchConstantLighting,
	createRaymarchProgram,
	createRaymarchRenderer,
	RaymarchCamera,
	RaymarchMaterial,
} from 'luxscura'
import { useEffect, useRef } from 'preact/hooks'
import {
	type ColorAttachment,
	type DepthStencilAttachment,
	tgpu,
} from 'typegpu'
import { mat4x4f, vec3f } from 'typegpu/data'
import { mat4 } from 'wgpu-matrix'

const sphereProgram = createRaymarchProgram({ epsilon: 0.001 }, () => {
	const cameraPosition = vec3f(0, 0, 4)
	const viewProjectionMatrix = mat4x4f()
	const projectionMatrix = mat4.perspective(Math.PI / 4, 1, 0.1, 100)
	const viewMatrix = mat4.lookAt(cameraPosition, vec3f(0, 0, 0), vec3f(0, 1, 0))
	mat4.multiply(projectionMatrix, viewMatrix, viewProjectionMatrix)

	return {
		bounds: () => {
			'use gpu'
			return AABB({ min: vec3f(-1), max: vec3f(1) })
		},
		sd: (point) => {
			'use gpu'
			return sdSphere(point, 0.8)
		},
		sample: () => {
			'use gpu'
			return RaymarchMaterial({
				albedo: vec3f(0.12, 0.45, 0.9),
				specular: vec3f(0),
				roughness: 1,
				emissive: vec3f(0),
			})
		},
		camera: () => {
			'use gpu'
			return RaymarchCamera({
				position: cameraPosition,
				viewProjectionMatrix,
			})
		},
		lighting: createRaymarchConstantLighting({
			ambient: vec3f(0, 0.1, 0),
			directionalLights: [
				{
					direction: vec3f(1, -1, -1),
					color: vec3f(1, 0, 0),
					intensity: 1.6,
				},
				{
					direction: vec3f(-1, 0, -0.4),
					color: vec3f(0.05, 0.45, 1),
					intensity: 0.75,
				},
			],
		}),

		environment: () => {
			'use gpu'
			return vec3f(0.04)
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

	const colorTextureTarget: ColorAttachment = { view: context }
	const depthTextureTarget: DepthStencilAttachment = { view: depthTexture }
	render(colorTextureTarget, depthTextureTarget, 1)

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
