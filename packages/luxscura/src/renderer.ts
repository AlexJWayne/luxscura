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
import {
	type RaymarchAppearance,
	type RaymarchCamera,
	type RaymarchDistanceFunction,
	type RaymarchProgram,
	type RaymarchProgramDefinition,
	type RaymarchProgramOptions,
	RaymarchResult,
	type RaymarchSurface,
	type RaymarchVisibilityTest,
} from './program'

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

/** Attachments and instance count for one raymarch draw submission. */
export interface RaymarchRenderOptions {
	colorAttachment: ColorAttachment
	depthStencilAttachment: DepthStencilAttachment
	/** @default 1 */
	instances?: number
}

const RayHit = struct({
	isHit: bool,
	pos: vec3f,
	depth: f32,
	rayDirection: vec3f,
	rayDistance: f32,
	stepCount: u32,
})
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
	maxDistance?: number
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
		let stepCount = u32(0)

		let marchLimit = aabbExitDistance(aabb, point, rayDirection)
		if (marchBeyondBounds) {
			marchLimit = f32(maxDistance ?? 0)
		} else if (maxDistance !== undefined) {
			marchLimit = min(marchLimit, maxDistance)
		}

		for (let stepIndex = 0; stepIndex < maxSteps; stepIndex++) {
			if (marchedDistance > marchLimit) break
			stepCount += 1

			point =
				camera.position + rayDirection * (triangleDistance + marchedDistance)

			const distance = sdSurface(point, instanceIndex, aabb)

			if (distance < epsilon) {
				const hitClipPosition = camera.viewProjectionMatrix * vec4f(point, 1)

				return RayHit({
					isHit: true,
					pos: point,
					depth: hitClipPosition.z / hitClipPosition.w,
					rayDirection,
					rayDistance: triangleDistance + marchedDistance,
					stepCount,
				})
			}
			marchedDistance += distance
		}

		return RayHit({
			isHit: false,
			pos: point,
			depth: 1,
			rayDirection,
			rayDistance: length(point - camera.position),
			stepCount,
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
	appearance,
	surface,
	preparePipeline = (pipeline) => pipeline,
	renderTarget,
}: {
	root: TgpuRoot
	options: RaymarchProgramOptions
	camera: () => RaymarchCamera
	appearance: RaymarchAppearance
	surface: RaymarchSurface
	preparePipeline?: (
		pipeline: TgpuRenderPipeline<{ color: Vec4f }>,
	) => TgpuRenderPipeline<{ color: Vec4f }>
	renderTarget?: Readonly<RaymarchRenderTargetOptions>
}) {
	const isRayVisible: RaymarchVisibilityTest =
		surface.isRayVisible ??
		(() => {
			'use gpu'
			return true
		})

	const calculateNormal = createCalculateNormal({
		sdSurface: surface.sd,
		epsilonNormal: options.epsilonNormal ?? options.epsilon,
	})

	const raymarch = createRaymarch({
		sdSurface: surface.sd,
		epsilon: options.epsilon,
		maxSteps: options.maxSteps ?? 100,
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

			fragment: ({ $position, worldPos, instanceIdx }) => {
				'use gpu'

				const aabb = surface.bounds(instanceIdx)
				if (surface.init !== undefined) surface.init(instanceIdx)
				if (!isRayVisible(worldPos.xyz, instanceIdx, aabb)) discard()

				const activeCamera = camera()
				const hit = raymarch(activeCamera, worldPos.xyz, aabb, instanceIdx)
				let normal = -1 * hit.rayDirection

				if (hit.isHit) {
					normal = calculateNormal(hit.pos, aabb, instanceIdx)
				}

				// Appearance runs before the hit branch so it may use derivatives.
				const color = appearance(
					RaymarchResult({
						isHit: hit.isHit,
						position: hit.pos,
						normal,
						rayOrigin: activeCamera.position,
						rayDirection: hit.rayDirection,
						rayDistance: hit.rayDistance,
						stepCount: hit.stepCount,
						projectedDepth: hit.depth,
						fragmentCoord: $position.xy,
						instanceIndex: instanceIdx,
						bounds: aabb,
					}),
				)

				if (hit.isHit) {
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

	return function render({
		colorAttachment,
		depthStencilAttachment,
		instances = 1,
	}: RaymarchRenderOptions) {
		pipeline
			.withColorAttachment({ color: colorAttachment })
			.withDepthStencilAttachment(depthStencilAttachment)
			.draw(cubeVertices.$.length, instances)
	}
}

/**
 * Creates a renderer for a raymarch program. It adds bounds rendering,
 * raymarching, normal calculation, appearance, depth, and draw submission to the
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
		const { camera, surface, appearance } = prepare(program.create(context))
		const renderer = createRaymarchPipeline({
			root,
			options: program.options,
			surface,
			camera,
			appearance,
			preparePipeline,
			renderTarget,
		})

		return renderer
	}

	let activeVersion = program.version
	let activeRenderer = createRenderer()

	return function renderRaymarchedInstances(options: RaymarchRenderOptions) {
		if (activeVersion !== program.version) {
			const nextRenderer = createRenderer()

			activeRenderer = nextRenderer
			activeVersion = program.version
		}

		activeRenderer(options)
	}
}
