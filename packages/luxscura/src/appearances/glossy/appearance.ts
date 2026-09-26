import { type v3f, vec3f } from 'typegpu/data'
import { dot, max, normalize, pow, saturate } from 'typegpu/std'
import type { RaymarchLighting } from '../../lighting'
import type { RaymarchAppearance, RaymarchResult } from '../../program'
import type { GlossyMaterial } from './material'

/** GPU function sampling a glossy material from the raymarch result. */
export type GlossyMaterialSampler = (result: RaymarchResult) => GlossyMaterial

/**
 * Creates a glossy appearance using diffuse lighting and Blinn-Phong highlights.
 * Ambient fill affects the diffuse color; emission is added independently.
 *
 * Material sampling runs for hits and misses so derivatives remain available.
 * Lighting runs only for hits. Colors and lighting values are linear RGB.
 */
export function createGlossyAppearance({
	material,
	lighting,
}: {
	material: GlossyMaterialSampler
	lighting: () => RaymarchLighting
}): RaymarchAppearance {
	return function glossyAppearance(result: RaymarchResult): v3f {
		'use gpu'
		const materialSample = material(result)
		if (!result.isHit) return vec3f(0)

		const lights = lighting()
		let color =
			materialSample.baseColor * lights.ambient + materialSample.emission
		const viewDirection = -1 * result.rayDirection
		const facingCamera = dot(result.normal, viewDirection) > 0
		const shininess = max(materialSample.shininess, 1)

		for (const light of lights.directionalLights) {
			if (light.intensity === 0) continue

			const lightDirection = -1 * normalize(light.direction)
			const diffuse = saturate(dot(result.normal, lightDirection))
			if (diffuse === 0) continue

			let response = materialSample.baseColor * diffuse
			if (facingCamera) {
				const halfwayDirection = normalize(viewDirection + lightDirection)
				const highlight = pow(
					saturate(dot(result.normal, halfwayDirection)),
					shininess,
				)
				response += materialSample.specular * highlight
			}

			color += light.color * light.intensity * response
		}

		return color
	}
}
