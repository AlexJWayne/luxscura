import { f32, type Infer, struct, vec3f } from 'typegpu/data'
import { mix } from 'typegpu/std'

/**
 * GPU material schema for an opaque surface with adjustable shiny highlights.
 * Colors are linear RGB. Callers must supply finite values within the documented
 * ranges; constructing this struct does not clamp or validate material values.
 */
export const GlossyMaterial = struct({
	/** Diffuse surface color. Each channel is in [0, 1]. */
	baseColor: vec3f,

	/** Highlight color and strength. Each channel is in [0, 1]; black disables highlights. */
	specular: vec3f,

	/**
	 * Highlight tightness: lower values produce broad highlights, higher values
	 * small ones. Use values of at least 1; shading applies an internal floor of 1.
	 */
	shininess: f32,

	/** Nonnegative outgoing linear RGB added independently of illumination; may exceed 1. */
	emission: vec3f,
})
export type GlossyMaterial = Infer<typeof GlossyMaterial>

/** Linearly blends all material properties. Amount is 0 for a, 1 for b, and is not clamped. */
export function mixGlossyMaterials(
	a: GlossyMaterial,
	b: GlossyMaterial,
	amount: number,
): GlossyMaterial {
	'use gpu'
	return GlossyMaterial({
		baseColor: mix(a.baseColor, b.baseColor, amount),
		specular: mix(a.specular, b.specular, amount),
		shininess: mix(a.shininess, b.shininess, amount),
		emission: mix(a.emission, b.emission, amount),
	})
}
