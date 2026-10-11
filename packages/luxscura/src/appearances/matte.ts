import { type v4f, vec3f, vec4f } from 'typegpu/data'
import { dot, normalize, saturate } from 'typegpu/std'
import type { RaymarchLighting } from '../lighting'
import type { RaymarchAppearance, RaymarchResult } from '../program'

/** GPU function sampling unpremultiplied linear RGB with alpha as opacity in [0, 1]. */
export type MatteColorSampler = (result: RaymarchResult) => v4f

/**
 * Creates a matte appearance using ambient fill and Lambert diffuse lighting.
 * Surfaces facing a light receive its full contribution, with no shiny highlights.
 * Lighting affects RGB only; the sampled alpha passes through as opacity.
 *
 * Color sampling runs for hits and misses so derivatives remain available.
 * Lighting runs only for hits. Colors and lighting values are linear RGB.
 */
export function createMatteAppearance({
	color,
	lighting,
}: {
	color: MatteColorSampler
	lighting: () => RaymarchLighting
}): RaymarchAppearance {
	return function matteAppearance(result: RaymarchResult): v4f {
		'use gpu'
		const surfaceColor = color(result)
		if (!result.isHit) return vec4f(0)

		const lights = lighting()
		let illumination = vec3f(lights.ambient)
		for (const light of lights.directionalLights) {
			if (light.intensity === 0) continue

			const lightDirection = -1 * normalize(light.direction)
			const diffuse = saturate(dot(result.normal, lightDirection))
			illumination += light.color * light.intensity * diffuse
		}

		return vec4f(surfaceColor.rgb * illumination, surfaceColor.a)
	}
}
