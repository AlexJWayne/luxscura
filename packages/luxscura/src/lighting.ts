import { arrayOf, f32, type Infer, struct, type v3f, vec3f } from 'typegpu/data'
import { dot, max, normalize, pow, reflect } from 'typegpu/std'
import type { RaymarchSurfaceSample } from './program'

/** GPU schema for a directional light contributing diffuse illumination. */
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

/**
 * Creates a GPU surface shader combining diffuse lighting, material emission,
 * and environment reflections.
 */
export function createShadeSurface({
	lighting,
	environment,
}: {
	lighting: () => RaymarchLighting
	environment: (direction: v3f, roughness: number) => v3f
}) {
	function calculateDiffuseLighting(normal: v3f): v3f {
		'use gpu'

		let accumulatedLight = lighting().ambient
		const directionalLights = lighting().directionalLights

		for (const light of directionalLights) {
			if (light.intensity === 0) continue
			const normalizedLightDirection = normalize(light.direction)
			const lambertFactor = max(dot(normal, -1 * normalizedLightDirection), 0)
			accumulatedLight += light.color * light.intensity * lambertFactor
		}

		return accumulatedLight
	}

	function calculateReflection(
		viewDirection: v3f,
		normal: v3f,
		specular: v3f,
		roughness: number,
	): v3f {
		'use gpu'

		const reflectionDirection = reflect(vec3f(-viewDirection), normal)
		const environmentColor = environment(reflectionDirection, roughness)
		const facing = max(dot(normal, viewDirection), 0)
		const fresnel = specular + (1 - specular) * pow(1 - facing, 5)

		return environmentColor * fresnel
	}

	return function shadeSurface(
		cameraPosition: v3f,
		sample: RaymarchSurfaceSample,
	): v3f {
		'use gpu'

		const viewDirection = normalize(cameraPosition - sample.position)
		const diffuse = calculateDiffuseLighting(sample.normal)
		const reflection = calculateReflection(
			viewDirection,
			sample.normal,
			sample.material.specular,
			sample.material.roughness,
		)

		return (
			sample.material.albedo * diffuse + sample.material.emissive + reflection
		)
	}
}
