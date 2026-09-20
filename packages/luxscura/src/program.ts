import { type Infer, struct, type v3f, vec3f } from 'typegpu/data'
import type { AABB } from './aabb'
import type { RaymarchLighting } from './lighting'
import { RaymarchMaterial } from './material'
import type { RaymarchCamera } from './renderer'

export const RaymarchSurfaceSample = struct({
	position: vec3f,
	normal: vec3f,
	material: RaymarchMaterial,
})
export type RaymarchSurfaceSample = Infer<typeof RaymarchSurfaceSample>

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

export type RaymarchMaterialSampler = (
	point: v3f,
	instanceIdx: number,
	aabb: AABB,
) => RaymarchMaterial

export interface RaymarchProgramOptions {
	/** Optional diagnostic metadata for consumers; unused by the renderer. */
	label?: string
	epsilon: number
	/** Normal sampling offset; defaults to epsilon. */
	epsilonNormal?: number
	maxSteps: number
	maxDistance: number
	marchBeyondBounds?: boolean
	depthWriteEnabled?: boolean
	depthCompare?: GPUCompareFunction
}

/** Flat shader definition compiled into a raymarching pipeline. */
export interface RaymarchProgram {
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

	/** GPU function returning the material at a point on the surface. */
	sample: RaymarchMaterialSampler

	/** GPU function providing the current camera state. */
	camera: () => RaymarchCamera

	/** GPU function providing the current lighting state. */
	lighting: () => RaymarchLighting

	/** GPU function sampling environment lighting for reflections. */
	environment: (direction: v3f, roughness: number) => v3f
}

export type RaymarchSurface = Pick<
	RaymarchProgram,
	'init' | 'bounds' | 'isRayVisible' | 'sd' | 'sample'
>

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
 * owns the factory for surface, camera, lighting, and environment callbacks,
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
