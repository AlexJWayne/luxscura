import { sdSphere } from '@typegpu/sdf'
import {
	AABB,
	createRaymarchedProgram,
	createRaymarchedRenderer,
	RaymarchCamera,
	RaymarchLighting,
	RaymarchMaterial,
} from 'luxscura'
import { useEffect, useRef } from 'preact/hooks'
import { type TgpuRoot, tgpu } from 'typegpu'
import { mat4x4f, vec3f } from 'typegpu/data'
import { mat4 } from 'wgpu-matrix'

const sphereProgram = createRaymarchedProgram(
	{
		label: 'Hello sphere',
		epsilon: 0.001,
		epsilonNormal: 0.001,
		maxSteps: 100,
		maxDistance: 10,
	},
	() => {
		const cameraPosition = vec3f(0, 0, 4)
		const viewProjectionMatrix = mat4x4f()
		const projectionMatrix = mat4.perspective(Math.PI / 4, 1, 0.1, 100)
		const viewMatrix = mat4.lookAt(
			cameraPosition,
			vec3f(0, 0, 0),
			vec3f(0, 1, 0),
		)
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
			lighting: () => {
				'use gpu'
				return RaymarchLighting({
					lightPosition: vec3f(2, 2, 3),
					ambientCoefficient: 0.15,
					falloffStart: 0,
					falloffEnd: 10,
				})
			},
			environment: () => {
				'use gpu'
				return vec3f(0.04)
			},
		}
	},
)

function useSphereRenderer() {
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		let root: TgpuRoot | undefined
		let disposed = false

		async function renderSphere(canvasElement: HTMLCanvasElement) {
			const nextRoot = await tgpu.init()
			if (disposed) {
				nextRoot.destroy()
				return
			}

			root = nextRoot
			const context = root.configureContext({
				canvas: canvasElement,
				alphaMode: 'opaque',
			})

			const colorTexture = root
				.createTexture({
					size: [canvasElement.width, canvasElement.height],
					format: navigator.gpu.getPreferredCanvasFormat(),
					sampleCount: 4,
				})
				.$usage('render')

			const depthTexture = root
				.createTexture({
					size: [canvasElement.width, canvasElement.height],
					format: 'depth24plus',
					sampleCount: 4,
				})
				.$usage('render')

			const render = createRaymarchedRenderer({
				root,
				program: sphereProgram,
				context: undefined,
			})

			render(
				{
					view: colorTexture,
					resolveTarget: context,
					loadOp: 'clear',
					clearValue: [0, 0, 0, 1],
				},
				{
					view: depthTexture,
					depthLoadOp: 'clear',
					depthClearValue: 1,
					depthStoreOp: 'store',
				},
				1,
			)
		}

		void renderSphere(canvas).catch((error: unknown) => {
			console.error('Failed to render the Luxscura sphere', error)
		})

		return () => {
			disposed = true
			root?.destroy()
		}
	}, [])

	return canvasRef
}

export function TempCanvas() {
	const canvasRef = useSphereRenderer()
	return <canvas ref={canvasRef} width={800} height={800} />
}
