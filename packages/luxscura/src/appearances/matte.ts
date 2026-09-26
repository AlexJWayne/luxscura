import { type v3f, vec3f } from 'typegpu/data'
import { dot, normalize, saturate } from 'typegpu/std'
import type { RaymarchLighting } from '../lighting'
import type { RaymarchAppearance, RaymarchResult } from '../program'

/** GPU function sampling a surface's linear RGB color from the raymarch result. */
export type MatteColorSampler = (result: RaymarchResult) => v3f

/**
 * Creates a matte appearance using ambient fill and Lambert diffuse lighting.
 * Surfaces facing a light receive its full contribution, with no shiny highlights.
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
	return function matteAppearance(result: RaymarchResult): v3f {
		'use gpu'
		const surfaceColor = color(result)
		if (!result.isHit) return vec3f(0)

		const lights = lighting()
		let illumination = vec3f(lights.ambient)
		for (const light of lights.directionalLights) {
			if (light.intensity === 0) continue

			const lightDirection = -1 * normalize(light.direction)
			const diffuse = saturate(dot(result.normal, lightDirection))
			illumination += light.color * light.intensity * diffuse
		}

		return surfaceColor * illumination
	}
}
