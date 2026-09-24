import {
	bool,
	f32,
	type Infer,
	mat4x4f,
	struct,
	u32,
	type v3f,
	vec2f,
	vec3f,
} from 'typegpu/data'
import { AABB } from './aabb'

export const RaymarchCamera = struct({
	viewProjectionMatrix: mat4x4f,
	position: vec3f,
})
export type RaymarchCamera = Infer<typeof RaymarchCamera>

/** Result of the primary ray march, with data available for appearance. */
export const RaymarchResult = struct({
	/** Whether the primary ray reached the surface within the march limits. */
	isHit: bool,
	/** Hit position, or the final ray sample position on a miss, in world space. */
	position: vec3f,
	/** Outward surface normal on a hit; -rayDirection on a miss. */
	normal: vec3f,
	/** Camera position in world space. */
	rayOrigin: vec3f,
	/** Unit direction from the camera into the scene. */
	rayDirection: vec3f,
	/** World-space distance from rayOrigin to position. */
	rayDistance: f32,
	/** Number of primary ray-march iterations, excluding normal/shadow samples. */
	stepCount: u32,
	/** Projected depth written for a hit; 1 on a miss. */
	projectedDepth: f32,
	/** Pixel-space fragment coordinates, with pixel centers at half-integers. */
	fragmentCoord: vec2f,
	/** Index of the bounds instance being rendered. */
	instanceIndex: u32,
	/** World-space bounds for this instance. */
	bounds: AABB,
})
export type RaymarchResult = Infer<typeof RaymarchResult>

/**
 * GPU function calculating linear RGB for every visible fragment after marching.
 * The renderer uses the result only on hits, with opaque coverage and its own
 * depth. Derivative-dependent work must run outside hit-dependent branches.
 */
export type RaymarchAppearance = (result: RaymarchResult) => v3f

export type RaymarchBoundsProvider = (instanceIdx: number) => AABB

export type RaymarchInitializer = (instanceIdx: number) => void

export type RaymarchVisibilityTest = (
	rayPoint: v3f,
	instanceIdx: number,
	bounds: AABB,
) => boolean

export type RaymarchDistanceFunction = (
	point: v3f,
	instanceIdx: number,
	aabb: AABB,
) => number

export type RaymarchProgramOptions = {
	/** Diagnostic metadata for consumers. Unused by the renderer. */
	label?: string
	/** Surface hit tolerance in world units. */
	epsilon: number
	/** Normal sampling offset; defaults to epsilon. */
	epsilonNormal?: number
	/** Maximum number of marching steps per ray; defaults to 100. */
	maxSteps?: number
	/** Write surface hit depth to the depth buffer; defaults to true. */
	depthWriteEnabled?: boolean
	/** Comparison used to test surface hit depth against the depth buffer; defaults to 'less'. */
	depthCompare?: GPUCompareFunction
} & (
	| {
			/** Allow marching past the bounding-box exit. Defaults to false; requires maxDistance when true. */
			marchBeyondBounds?: false
			/** Maximum distance to march from the bounding-box entry point, in world units. */
			maxDistance?: number
	  }
	| {
			/** Allow marching past the bounding-box exit. Defaults to false; requires maxDistance when true. */
			marchBeyondBounds: true
			/** Maximum distance to march from the bounding-box entry point, in world units. */
			maxDistance: number
	  }
)

/** Geometry and visibility callbacks compiled into a raymarching pipeline. */
export interface RaymarchSurface {
	/** GPU function initializing per-fragment state before raymarching. */
	init?: RaymarchInitializer

	/** GPU function providing each instance's axis-aligned bounding box. */
	bounds: RaymarchBoundsProvider

	/**
	 * GPU function masking out rays that should not render. Returning false
	 * skips raymarching for that fragment.
	 */
	isRayVisible?: RaymarchVisibilityTest

	/** GPU function returning the signed distance from a point to the surface. */
	sd: RaymarchDistanceFunction
}

/** Camera, geometry, and appearance compiled into one raymarching pipeline. */
export interface RaymarchProgram {
	/** GPU function providing the current camera state. */
	camera: () => RaymarchCamera

	/** Surface bounds, signed distance, and optional visibility behavior. */
	surface: RaymarchSurface

	/** GPU function returning linear RGB for the raymarch result. */
	appearance: RaymarchAppearance
}

/** Versioned factory that creates a program from setup-time context. */
export interface RaymarchProgramDefinition<TContext> {
	version: number
	options: RaymarchProgramOptions
	create: (context: TContext) => RaymarchProgram
}

/** Minimal hot-module context used to retain a program across reevaluations. */
export interface RaymarchHotContext {
	data: Record<string, unknown>
}

const HOT_DATA_KEY = 'raymarchProgramDefinition'

/**
 * Creates a versioned program definition without allocating GPU resources. It
 * owns the factory for surface, camera, and appearance callbacks,
 * and the options used to compile them into a raymarching pipeline. Callbacks
 * may read changing buffer data without rebuilding the pipeline.
 *
 * When `hot` is provided, reevaluating the module updates the existing program
 * definition and increments its version. Renderer instances observe that
 * version and rebuild their pipelines while retaining setup-time resources. The
 * defining module must call `import.meta.hot?.accept()` for this behavior, and
 * may currently define only one HMR-backed raymarch program.
 *
 * ```ts
 * const program = createRaymarchProgram(options, create, import.meta.hot)
 * import.meta.hot?.accept()
 * ```
 *
 * @returns A read-only program definition consumed by raymarch renderer factories.
 */
export function createRaymarchProgram<TContext = undefined>(
	options: RaymarchProgramOptions,
	create: (context: TContext) => RaymarchProgram,

	/**
	 * Optional hot-module context used to preserve and update the program
	 * across module reevaluations.
	 */
	hot?: RaymarchHotContext,
): Readonly<RaymarchProgramDefinition<TContext>> {
	const definition = (hot?.data[HOT_DATA_KEY] as
		| RaymarchProgramDefinition<TContext>
		| undefined) ?? { version: 0, options, create }

	definition.version += 1
	definition.options = options
	definition.create = create
	if (hot) hot.data[HOT_DATA_KEY] = definition

	return definition
}
