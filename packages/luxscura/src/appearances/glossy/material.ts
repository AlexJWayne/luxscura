import { f32, type Infer, struct, vec3f } from 'typegpu/data'

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
