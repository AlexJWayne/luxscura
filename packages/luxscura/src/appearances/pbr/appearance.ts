import { type Infer, struct, type v3f, vec3f } from 'typegpu/data'
import {
	clamp,
	dot,
	max,
	mix,
	normalize,
	pow,
	reflect,
	sqrt,
} from 'typegpu/std'
import type { RaymarchAppearance, RaymarchResult } from '../../program'
import type { RaymarchLighting } from './lighting'
import { PbrMaterial } from './material'

/** Position, normal, and PBR material consumed by the lighting calculation. */
export const PbrSurfaceSample = struct({
	position: vec3f,
	normal: vec3f,
	material: PbrMaterial,
})
export type PbrSurfaceSample = Infer<typeof PbrSurfaceSample>

/** Schlick Fresnel approximation; cosTheta is the incident angle's cosine in [0, 1]. */
function fresnelSchlick(cosTheta: number, specularF0: v3f): v3f {
	'use gpu'
	return specularF0 + (1 - specularF0) * pow(1 - cosTheta, 5)
}

/**
 * GGX microfacet distribution; normalDotHalf is in [0, 1].
 * alpha is material roughness squared, with a positive floor applied by the caller.
 */
function distributionGGX(normalDotHalf: number, alpha: number): number {
	'use gpu'
	const alphaSquared = alpha * alpha
	const denominator = normalDotHalf * normalDotHalf * (alphaSquared - 1) + 1
	return alphaSquared / (Math.PI * denominator * denominator)
}

/**
 * Height-correlated Smith GGX visibility, including G / (4 NdotL NdotV).
 * Both cosines must be in (0, 1]; alpha uses the same positive floor as GGX.
 */
function visibilitySmithGGX(
	normalDotView: number,
	normalDotLight: number,
	alpha: number,
): number {
	'use gpu'
	const alphaSquared = alpha * alpha
	const viewTerm =
		normalDotLight *
		sqrt(normalDotView * normalDotView * (1 - alphaSquared) + alphaSquared)
	const lightTerm =
		normalDotView *
		sqrt(normalDotLight * normalDotLight * (1 - alphaSquared) + alphaSquared)
	return 0.5 / (viewTerm + lightTerm)
}

/** Combines the microfacet distribution, visibility, and Fresnel response. */
function calculateSpecularResponse(
	normalDotView: number,
	normalDotLight: number,
	normalDotHalf: number,
	alpha: number,
	fresnel: v3f,
): v3f {
	'use gpu'
	const distribution = distributionGGX(normalDotHalf, alpha)
	const visibility = visibilitySmithGGX(normalDotView, normalDotLight, alpha)
	return distribution * visibility * fresnel
}

/** Material response including the surface-facing factor, before light color/intensity. */
function evaluateDirectLightResponse(
	normal: v3f,
	viewDirection: v3f,
	lightDirection: v3f,
	normalDotView: number,
	diffuseColor: v3f,
	specularF0: v3f,
	alpha: number,
): v3f {
	'use gpu'
	const normalDotLight = clamp(dot(normal, lightDirection), 0, 1)
	if (normalDotView === 0 || normalDotLight === 0) return vec3f(0)

	const halfwayDirection = normalize(viewDirection + lightDirection)
	const normalDotHalf = clamp(dot(normal, halfwayDirection), 0, 1)
	const viewDotHalf = clamp(dot(viewDirection, halfwayDirection), 0, 1)
	const fresnel = fresnelSchlick(viewDotHalf, specularF0)
	const specular = calculateSpecularResponse(
		normalDotView,
		normalDotLight,
		normalDotHalf,
		alpha,
		fresnel,
	)

	// Only the nonmetal response contributes diffuse reflection.
	const dielectricFresnel = fresnelSchlick(viewDotHalf, vec3f(0.04))
	const diffuse = ((1 - dielectricFresnel) * diffuseColor) / Math.PI
	return normalDotLight * (diffuse + specular)
}

/**
 * Creates a GPU surface shader combining direct lighting, material emission,
 * and environment reflections.
 */
export function createPbrShadeSurface({
	lighting,
	environment,
}: {
	lighting: () => RaymarchLighting
	environment: (direction: v3f, roughness: number) => v3f
}) {
	function calculateDirectLighting(
		viewDirection: v3f,
		normal: v3f,
		material: PbrMaterial,
		specularF0: v3f,
	): v3f {
		'use gpu'

		const diffuseColor = material.baseColor * (1 - material.metallic)
		let accumulatedLight = lighting().ambient * diffuseColor
		const directionalLights = lighting().directionalLights
		const normalDotView = clamp(dot(normal, viewDirection), 0, 1)
		if (normalDotView === 0) return accumulatedLight

		const minimumAlpha = 0.001 // Keep the GGX response finite even for material roughness zero.
		const alpha = max(material.roughness * material.roughness, minimumAlpha)

		for (const light of directionalLights) {
			if (light.intensity === 0) continue

			const lightDirection = -1 * normalize(light.direction)
			const response = evaluateDirectLightResponse(
				normal,
				viewDirection,
				lightDirection,
				normalDotView,
				diffuseColor,
				specularF0,
				alpha,
			)
			accumulatedLight += light.color * light.intensity * response
		}

		return accumulatedLight
	}

	function calculateReflection(
		viewDirection: v3f,
		normal: v3f,
		specularF0: v3f,
		roughness: number,
	): v3f {
		'use gpu'

		const reflectionDirection = reflect(-1 * viewDirection, normal)
		const environmentColor = environment(reflectionDirection, roughness)
		const facing = max(dot(normal, viewDirection), 0)
		const fresnel = fresnelSchlick(facing, specularF0)

		return environmentColor * fresnel
	}

	return function shadeSurface(
		cameraPosition: v3f,
		sample: PbrSurfaceSample,
	): v3f {
		'use gpu'

		const material = sample.material
		const viewDirection = normalize(cameraPosition - sample.position)

		const dielectricF0 = vec3f(0.04) // Normal-incidence reflectance for a nonmetal with IOR 1.5.
		const specularF0 = mix(dielectricF0, material.baseColor, material.metallic)

		const directLighting = calculateDirectLighting(
			viewDirection,
			sample.normal,
			material,
			specularF0,
		)

		const reflection = calculateReflection(
			viewDirection,
			sample.normal,
			specularF0,
			material.roughness,
		)

		return directLighting + material.emission + reflection
	}
}

/** GPU function sampling a PBR material from the raymarch result. */
export type PbrMaterialSampler = (result: RaymarchResult) => PbrMaterial

/**
 * Creates a metallic/roughness appearance for a raymarch program.
 *
 * Material sampling runs for hits and misses so derivatives remain available.
 * Lighting runs only for hits. The returned color on a miss is ignored by the
 * renderer.
 */
export function createPbrAppearance({
	sampleMaterial,
	lighting,
	environment,
}: {
	sampleMaterial: PbrMaterialSampler
	lighting: () => RaymarchLighting
	/**
	 * Incoming linear RGB from a normalized reflection direction. Called only on
	 * hits; texture sampling here should use an explicit level of detail.
	 */
	environment: (direction: v3f, roughness: number) => v3f
}): RaymarchAppearance {
	const shadeSurface = createPbrShadeSurface({ lighting, environment })

	return function pbrAppearance(result: RaymarchResult): v3f {
		'use gpu'
		const material = sampleMaterial(result)
		if (!result.isHit) return vec3f(0)

		return shadeSurface(
			result.rayOrigin,
			PbrSurfaceSample({
				position: result.position,
				normal: result.normal,
				material,
			}),
		)
	}
}
