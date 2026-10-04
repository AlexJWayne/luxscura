import { sdBox3d, sdCappedCylinder, sdSphere } from '@typegpu/sdf'
import {
	AABB,
	createRaymarchConstantLighting,
	createRaymarchProgram,
	createRaymarchRenderer,
	RaymarchCamera,
} from 'luxscura'
import { createGlossyAppearance, GlossyMaterial } from 'luxscura/glossy'
import { tgpu } from 'typegpu'
import { arrayOf, f32, mat4x4f, struct, u32, vec3f } from 'typegpu/data'
import { mat4 } from 'wgpu-matrix'

const GRID_SIZE = 5
const INSTANCE_COUNT = GRID_SIZE * GRID_SIZE

enum Shape {
	Sphere,
	Cube,
	Cylinder,
}

const shapes = [Shape.Sphere, Shape.Cube, Shape.Cylinder]

const Instance = struct({
	position: vec3f,
	shape: u32,
	color: vec3f,
	scale: f32,
})

const colors = [
	vec3f(1, 0.08, 0.12), // Red
	vec3f(1, 0.3, 0.04), // Orange
	vec3f(1, 0.8, 0.05), // Yellow
	vec3f(0.15, 0.9, 0.12), // Green
	vec3f(0.04, 0.85, 1), // Cyan
	vec3f(0.08, 0.25, 1), // Blue
	vec3f(0.65, 0.08, 1), // Violet
]

export async function createInstancesExample(canvas: HTMLCanvasElement) {
	const root = await tgpu.init()
	const canvasContext = root.configureContext({ canvas })

	const camera = createCamera(canvas)
	const depthTexture = root
		.createTexture({
			size: [canvas.width, canvas.height],
			format: 'depth24plus',
		})
		.$usage('render')

	const instances = root
		.createBuffer(
			arrayOf(Instance, INSTANCE_COUNT),
			Array.from({ length: INSTANCE_COUNT }, (_, index) => {
				const scale = 0.5 + Math.random() * 0.5
				const x = (index % GRID_SIZE) - (GRID_SIZE - 1) / 2
				const y = Math.floor(index / GRID_SIZE) - (GRID_SIZE - 1) / 2
				return {
					position: vec3f(x * 1.25, y * 1.25, scale * 0.5),
					shape: shapes[Math.floor(Math.random() * shapes.length)],
					color: colors[Math.floor(Math.random() * colors.length)],
					scale,
				}
			}),
		)
		.$usage('storage')
		.as('readonly')

	const program = createRaymarchProgram({
		options: { epsilon: 0.001 },
		camera: () => {
			'use gpu'
			return RaymarchCamera({
				position: camera.cameraPosition,
				viewProjectionMatrix: camera.viewProjectionMatrix,
			})
		},

		surface: {
			bounds: (instanceIndex) => {
				'use gpu'
				const instance = instances.$[instanceIndex]
				// All three shapes fit these bounds, with a little surface padding.
				const halfSize = vec3f(instance.scale * 0.5 + 0.001)
				return AABB({
					min: instance.position - halfSize,
					max: instance.position + halfSize,
				})
			},

			sd: (point, instanceIndex) => {
				'use gpu'
				const instance = instances.$[instanceIndex]
				const localPoint = point - instance.position
				const halfSize = instance.scale * 0.5

				switch (instance.shape) {
					case Shape.Sphere:
						return sdSphere(localPoint, halfSize)
					case Shape.Cube:
						return sdBox3d(localPoint, vec3f(halfSize))
					case Shape.Cylinder:
						return sdCappedCylinder(localPoint.xzy, halfSize, halfSize)
					default:
						return 1e9
				}
			},
		},

		appearance: createGlossyAppearance({
			material: (result) => {
				'use gpu'
				return GlossyMaterial({
					baseColor: vec3f(instances.$[result.instanceIndex].color),
					specular: vec3f(0.6),
					shininess: 64,
					emission: vec3f(0),
				})
			},

			lighting: createRaymarchConstantLighting({
				ambient: vec3f(0.3),
				directionalLights: [
					{
						direction: vec3f(-1, -1, -2),
						color: vec3f(1),
						intensity: 0.7,
					},
				],
			}),
		}),
	})

	const render = createRaymarchRenderer({ root, program })

	render({
		colorAttachment: { view: canvasContext },
		depthStencilAttachment: { view: depthTexture },
		instances: INSTANCE_COUNT,
	})

	return { destroy: () => root.destroy() }
}

/** Uses the glossy example's Z-up view, raised 60 degrees above the XY grid. */
function createCamera({ width, height }: { width: number; height: number }) {
	const elevation = Math.PI / 3
	const distance = GRID_SIZE * 2
	const position = vec3f(
		0,
		-Math.cos(elevation) * distance,
		Math.sin(elevation) * distance,
	)
	const viewProjectionMatrix = mat4x4f()
	const projectionMatrix = mat4.perspective(
		Math.PI / 4,
		width / height,
		0.1,
		100,
	)
	const viewMatrix = mat4.lookAt(position, vec3f(0), vec3f(0, 0, 1))
	mat4.multiply(projectionMatrix, viewMatrix, viewProjectionMatrix)

	return { cameraPosition: position, viewProjectionMatrix }
}
