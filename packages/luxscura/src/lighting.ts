import { f32, type Infer, struct, type v3f, vec3f } from 'typegpu/data'
import {
	dot,
	length,
	max,
	mix,
	normalize,
	pow,
	reflect,
	saturate,
} from 'typegpu/std'
import type { RaymarchSurfaceSample } from './program'

export const RaymarchLighting = struct({
	lightPosition: vec3f,
	ambientCoefficient: f32,
	falloffStart: f32,
	falloffEnd: f32,
})
export type RaymarchLighting = Infer<typeof RaymarchLighting>

export function createShadeSurface({
	lighting,
	environment,
}: {
	lighting: () => RaymarchLighting
	environment: (direction: v3f, roughness: number) => v3f
}) {
	function calculateDiffuseLighting(surfacePosition: v3f, normal: v3f): number {
		'use gpu'

		const lightDirection = lighting().lightPosition.sub(surfacePosition)
		const normalizedLightDirection = normalize(lightDirection)

		let diffuse = max(dot(normalizedLightDirection, normal), 0)
		const distance = length(lightDirection)
		const attenuation = saturate(
			(lighting().falloffEnd - distance) /
				(lighting().falloffEnd - lighting().falloffStart),
		)
		diffuse *= attenuation
		diffuse = mix(lighting().ambientCoefficient, 1, diffuse)

		return diffuse
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
		const diffuse = calculateDiffuseLighting(sample.position, sample.normal)
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
