import { f32, type Infer, struct, vec3f } from 'typegpu/data'
import { mix } from 'typegpu/std'

export const RaymarchMaterial = struct({
	albedo: vec3f,
	specular: vec3f,
	roughness: f32,
	emissive: vec3f,
})
export type RaymarchMaterial = Infer<typeof RaymarchMaterial>

/** Debug material for visualizing a normalized float That varies over the surface. */
export function debugMaterial(luminance: number): RaymarchMaterial {
	'use gpu'
	return RaymarchMaterial({
		albedo: vec3f(0),
		specular: vec3f(0),
		roughness: f32(1),
		emissive: vec3f(luminance),
	})
}

export function mixMaterials(
	a: RaymarchMaterial,
	b: RaymarchMaterial,
	amount: number,
): RaymarchMaterial {
	'use gpu'
	return RaymarchMaterial({
		albedo: mix(a.albedo, b.albedo, amount),
		specular: mix(a.specular, b.specular, amount),
		roughness: mix(a.roughness, b.roughness, amount),
		emissive: mix(a.emissive, b.emissive, amount),
	})
}
