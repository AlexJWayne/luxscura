import { arrayOf, f32, type Infer, struct, vec3f } from 'typegpu/data'

/** GPU schema for a directional light contributing diffuse and specular illumination. */
export const RaymarchDirectionalLight = struct({
	/** Nonzero world-space direction of travel; normalized during shading. */
	direction: vec3f,

	/** Linear RGB light color. */
	color: vec3f,

	/** Brightness multiplier; zero disables the light. */
	intensity: f32,
})

/** Directional-light values accepted by lighting providers. */
export type RaymarchLight = Infer<typeof RaymarchDirectionalLight>

const fallbackDirectionalLights = [
	RaymarchDirectionalLight({
		direction: vec3f(0, -1, 0),
		color: vec3f(0),
		intensity: 0,
	}),
]

/**
 * Creates a GPU lighting schema with a fixed number of light slots.
 * @throws {RangeError} If capacity is not a positive integer.
 */
export function createRaymarchLightingStruct(capacity: number) {
	if (!Number.isInteger(capacity) || capacity < 1) {
		throw new RangeError('Lighting capacity must be a positive integer.')
	}

	return struct({
		/** Additive linear RGB diffuse fill; black adds no ambient illumination. */
		ambient: vec3f,

		/** Directional lights evaluated independently and added together. */
		directionalLights: arrayOf(RaymarchDirectionalLight, capacity),
	})
}
/** Ambient fill and directional-light values returned by a GPU lighting provider. */
export type RaymarchLighting = Infer<
	ReturnType<typeof createRaymarchLightingStruct>
>

/**
 * Creates a GPU lighting callback with values embedded during shader compilation.
 * Infers capacity from directionalLights; an empty list uses one disabled slot.
 */
export function createRaymarchConstantLighting(lighting: RaymarchLighting) {
	const directionalLights =
		lighting.directionalLights.length > 0
			? lighting.directionalLights
			: fallbackDirectionalLights

	const RaymarchConstantLighting = createRaymarchLightingStruct(
		directionalLights.length,
	)

	return function raymarchLighting() {
		'use gpu'
		return RaymarchConstantLighting({
			ambient: lighting.ambient,
			directionalLights: directionalLights,
		})
	}
}
