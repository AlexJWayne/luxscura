import {
	type ColorAttachment,
	type DepthStencilAttachment,
	type TgpuRenderPipeline,
	type TgpuRoot,
	tgpu,
} from 'typegpu'
import {
	bool,
	builtin,
	f32,
	type Infer,
	interpolate,
	mat4x4f,
	struct,
	u32,
	type Vec4f,
	type v3f,
	vec2f,
	vec3f,
	vec4f,
} from 'typegpu/data'
import { discard, length, min, normalize } from 'typegpu/std'
import { type AABB, aabbExitDistance, aabbPoint } from './aabb'
import { cubeVertices } from './cube-vertices'
import { createShadeSurface, type RaymarchLighting } from './lighting'
import {
	type RaymarchDistanceFunction,
	type RaymarchProgram,
	type RaymarchProgramDefinition,
	type RaymarchProgramOptions,
	type RaymarchSurface,
	RaymarchSurfaceSample,
	type RaymarchVisibilityTest,
} from './program'

export const RaymarchCamera = struct({
	viewProjectionMatrix: mat4x4f,
	position: vec3f,
})
export type RaymarchCamera = Infer<typeof RaymarchCamera>

export interface RaymarchRenderTargetOptions {
	/**
	 * Format of the color attachment.
	 * @default navigator.gpu.getPreferredCanvasFormat()
	 */
	colorFormat?: GPUTextureFormat

	/**
	 * Format of the depth/stencil attachment.
	 * @default 'depth24plus'
	 */
	depthStencilFormat?: Extract<GPUTextureFormat, `depth${string}`>

	/**
	 * Number of samples per pixel in each attachment.
	 * @default 1
	 */
	sampleCount?: 1 | 4
}

const RayHit = struct({ isHit: bool, pos: vec3f, depth: f32 })
type RayHit = Infer<typeof RayHit>

function createRaymarch({
	sdSurface,
	maxSteps,
	maxDistance,
	epsilon,
	marchBeyondBounds,
}: {
	sdSurface: RaymarchDistanceFunction
	maxSteps: number
	maxDistance: number
	epsilon: number
	marchBeyondBounds: boolean
}) {
	return function raymarch(
		camera: RaymarchCamera,
		worldPosition: v3f,
		aabb: AABB,
		instanceIndex: number,
	): RayHit {
		'use gpu'
		const triangleDifference = worldPosition.xyz - camera.position
		const triangleDistance = length(triangleDifference)
		const rayDirection = normalize(triangleDifference)

		let marchedDistance = f32(0)
		let point = camera.position + rayDirection * triangleDistance
		let marchLimit = f32(maxDistance)
		if (!marchBeyondBounds) {
			marchLimit = min(marchLimit, aabbExitDistance(aabb, point, rayDirection))
		}

		for (let stepIndex = 0; stepIndex < maxSteps; stepIndex++) {
			if (marchedDistance > marchLimit) break

			point =
				camera.position + rayDirection * (triangleDistance + marchedDistance)

			const distance = sdSurface(point, instanceIndex, aabb)

			if (distance < epsilon) {
				const hitClipPosition = camera.viewProjectionMatrix * vec4f(point, 1)

				return RayHit({
					isHit: true,
					pos: point,
					depth: hitClipPosition.z / hitClipPosition.w,
				})
			}
			marchedDistance += distance
		}

		return RayHit({
			isHit: false,
			pos: vec3f(),
			depth: 1,
		})
	}
}

function createCalculateNormal({
	sdSurface,
	epsilonNormal,
}: {
	sdSurface: RaymarchDistanceFunction
	epsilonNormal: number
}) {
	return function calculateNormal(
		point: v3f,
		aabb: AABB,
		instanceIndex: number,
	): v3f {
		'use gpu'
		const k = vec2f(1, -1)
		return normalize(
			k.xyy * sdSurface(point + k.xyy * epsilonNormal, instanceIndex, aabb) +
				(k.yyx * sdSurface(point + k.yyx * epsilonNormal, instanceIndex, aabb) +
					(k.yxy *
						sdSurface(point + k.yxy * epsilonNormal, instanceIndex, aabb) +
						k.xxx *
							sdSurface(point + k.xxx * epsilonNormal, instanceIndex, aabb))),
		)
	}
}

/**
 * Creates a GPU pipeline that renders a raymarched surface.
 *
 * @returns A function that draws the requested number of instances.
 */
function createRaymarchPipeline({
	root,
	options,
	camera,
	lighting,
	environment,
	surface,
	preparePipeline = (pipeline) => pipeline,
	renderTarget,
}: {
	root: TgpuRoot
	options: RaymarchProgramOptions
	camera: () => RaymarchCamera
	lighting: () => RaymarchLighting
	environment: (direction: v3f, roughness: number) => v3f
	surface: RaymarchSurface
	preparePipeline?: (
		pipeline: TgpuRenderPipeline<{ color: Vec4f }>,
	) => TgpuRenderPipeline<{ color: Vec4f }>
	renderTarget?: Readonly<RaymarchRenderTargetOptions>
}) {
	const shadeSurface = createShadeSurface({
		lighting,
		environment,
	})

	const isRayVisible: RaymarchVisibilityTest =
		surface.isRayVisible ??
		(() => {
			'use gpu'
			return true
		})

	const calculateNormal = createCalculateNormal({
		sdSurface: surface.sd,
		epsilonNormal: options.epsilonNormal,
	})

	const raymarch = createRaymarch({
		sdSurface: surface.sd,
		epsilon: options.epsilon,
		maxSteps: options.maxSteps,
		maxDistance: options.maxDistance,
		marchBeyondBounds: options.marchBeyondBounds ?? false,
	})

	const pipeline = preparePipeline(
		root.createRenderPipeline({
			multisample: { count: renderTarget?.sampleCount },
			depthStencil: {
				format: renderTarget?.depthStencilFormat ?? 'depth24plus',
				depthWriteEnabled: options.depthWriteEnabled ?? true,
				depthCompare: options.depthCompare ?? 'less',
			},
			primitive: { topology: 'triangle-list', cullMode: 'back' },
			targets: {
				color: {
					format: renderTarget?.colorFormat,
					blend: {
						color: {
							srcFactor: 'src-alpha',
							dstFactor: 'one-minus-src-alpha',
							operation: 'add',
						},
						alpha: {
							srcFactor: 'one',
							dstFactor: 'one-minus-src-alpha',
							operation: 'add',
						},
					},
				},
			},

			vertex: tgpu.vertexFn({
				in: {
					vertexIdx: builtin.vertexIndex,
					instanceIdx: builtin.instanceIndex,
				},
				out: {
					position: builtin.position,
					worldPos: vec3f,
					instanceIdx: interpolate('flat, either', u32),
				},
			})(({ vertexIdx, instanceIdx }) => {
				'use gpu'

				const aabb = surface.bounds(instanceIdx)
				const localPos = cubeVertices.$[vertexIdx]
				const worldPos = aabbPoint(aabb, localPos)
				const position = camera().viewProjectionMatrix * vec4f(worldPos, 1)

				return {
					position,
					worldPos,
					instanceIdx,
				}
			}),

			fragment: ({ worldPos, instanceIdx }) => {
				'use gpu'

				const aabb = surface.bounds(instanceIdx)
				if (surface.init !== undefined) surface.init(instanceIdx)
				if (!isRayVisible(worldPos.xyz, instanceIdx, aabb)) discard()

				const hit = raymarch(camera(), worldPos.xyz, aabb, instanceIdx)
				let normal = vec3f()

				if (hit.isHit) {
					normal = calculateNormal(hit.pos, aabb, instanceIdx)
				}

				// Keep material sampling in uniform control flow so surfaces may use
				// screen-space derivatives such as fwidth.
				const material = surface.sample(hit.pos, instanceIdx, aabb)

				if (hit.isHit) {
					const sample = RaymarchSurfaceSample({
						position: hit.pos,
						normal,
						material,
					})
					const color = shadeSurface(camera().position, sample)

					return {
						color: vec4f(color, 1),
						$fragDepth: hit.depth,
					}
				}

				return {
					color: vec4f(),
					$fragDepth: 1,
				}
			},
		}),
	)

	return function render(
		colorAttachment: ColorAttachment,
		depthStencilAttachment: DepthStencilAttachment,
		instanceCount: number,
	) {
		pipeline
			.withColorAttachment({ color: colorAttachment })
			.withDepthStencilAttachment(depthStencilAttachment)
			.draw(cubeVertices.$.length, instanceCount)
	}
}

/**
 * Creates a renderer for a raymarch program. It adds bounds rendering,
 * raymarching, normal calculation, lighting, depth, and draw submission to the
 * surface supplied by the program.
 *
 * Program creation and preparation are repeated when the program version
 * changes, allowing shader HMR to rebuild the pipeline without replacing the
 * supplied setup-time context.
 *
 * @returns A function that draws a requested number of raymarched instances.
 */
export function createRaymarchRenderer<TContext = undefined>({
	root,
	program,
	context = undefined as TContext,
	renderTarget,
	prepare = (program) => program,
	preparePipeline,
}: {
	root: TgpuRoot

	/** Program providing pipeline options, a version, and the shader factory. */
	program: Readonly<RaymarchProgramDefinition<TContext>>

	/** Render target configuration used to create a compatible pipeline. */
	renderTarget?: Readonly<RaymarchRenderTargetOptions>

	/**
	 * Optional program transformation applied after program creation and before
	 * pipeline compilation.
	 */
	prepare?: (program: RaymarchProgram) => RaymarchProgram

	/**
	 * Optional pipeline transformation applied after pipeline creation and before
	 * the pipeline is captured by the render function.
	 */
	preparePipeline?: (
		pipeline: TgpuRenderPipeline<{ color: Vec4f }>,
	) => TgpuRenderPipeline<{ color: Vec4f }>
} & (undefined extends TContext
	? { context?: TContext }
	: { context: TContext })) {
	function createRenderer() {
		const { camera, lighting, environment, ...surface } = prepare(
			program.create(context),
		)
		const renderer = createRaymarchPipeline({
			root,
			options: program.options,
			surface,
			camera,
			lighting,
			environment,
			preparePipeline,
			renderTarget,
		})

		return renderer
	}

	let activeVersion = program.version
	let activeRenderer = createRenderer()

	return function renderRaymarchedInstances(
		colorAttachment: ColorAttachment,
		depthStencilAttachment: DepthStencilAttachment,
		instanceCount: number,
	) {
		if (activeVersion !== program.version) {
			const nextRenderer = createRenderer()

			activeRenderer = nextRenderer
			activeVersion = program.version
		}

		activeRenderer(colorAttachment, depthStencilAttachment, instanceCount)
	}
}
