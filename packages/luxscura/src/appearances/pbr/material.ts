import { f32, type Infer, struct, vec3f } from 'typegpu/data'
import { mix } from 'typegpu/std'

/**
 * GPU material schema for an opaque surface using metallic/roughness shading.
 * Colors are linear RGB. Callers must supply finite values within the documented
 * ranges; constructing this struct does not clamp or validate material values.
 */
export const PbrMaterial = struct({
	/** Diffuse color for nonmetals, specular reflection color for metals. Each channel is in [0, 1]. */
	baseColor: vec3f,

	/** Nonmetal at 0, metal at 1; intermediate values blend the responses. Not a shininess control. */
	metallic: f32,

	/**
	 * Surface roughness in [0, 1]: 0 produces sharp direct highlights, 1 broad ones.
	 * Direct shading applies a small internal floor at the smooth end for stability.
	 * Passed to the environment callback; the consumer owns reflection filtering.
	 */
	roughness: f32,

	/**
	 * Nonnegative outgoing linear RGB added independently of illumination; may exceed 1.
	 * Does not illuminate other surfaces or disable this material's reflections.
	 */
	emission: vec3f,
})
export type PbrMaterial = Infer<typeof PbrMaterial>

/** Debug material for visualizing a normalized float That varies over the surface. */
export function debugPbrMaterial(luminance: number): PbrMaterial {
	'use gpu'
	return PbrMaterial({
		baseColor: vec3f(0),
		metallic: f32(0),
		roughness: f32(1),
		emission: vec3f(luminance),
	})
}

export function mixPbrMaterials(
	a: PbrMaterial,
	b: PbrMaterial,
	amount: number,
): PbrMaterial {
	'use gpu'
	return PbrMaterial({
		baseColor: mix(a.baseColor, b.baseColor, amount),
		metallic: mix(a.metallic, b.metallic, amount),
		roughness: mix(a.roughness, b.roughness, amount),
		emission: mix(a.emission, b.emission, amount),
	})
}
