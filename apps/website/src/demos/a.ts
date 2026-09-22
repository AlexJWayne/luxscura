import { opSmoothUnion, sdBox3d, sdSphere } from '@typegpu/sdf'
import {
	AABB,
	createRaymarchConstantLighting,
	createRaymarchProgram,
	RaymarchCamera,
	RaymarchMaterial,
} from 'luxscura'
import { vec3f } from 'typegpu/data'
import { atan2, mix, sin, smoothstep } from 'typegpu/std'
import { createCamera } from '../create-camera'

export const programA = createRaymarchProgram({ epsilon: 0.001 }, () => {
	const { cameraPosition, viewProjectionMatrix } = createCamera({
		position: vec3f(0, -4, 0),
		target: vec3f(0),
		fieldOfView: Math.PI / 4,
		near: 0.1,
		far: 100,
	})

	// Return the raymarch program
	return {
		bounds: () => {
			'use gpu'
			return AABB({ min: vec3f(-1), max: vec3f(1) })
		},
		sd: (point) => {
			'use gpu'
			return opSmoothUnion(
				sdSphere(point - vec3f(0), 0.8),
				sdBox3d(point - vec3f(0.5, 0, 0.5), vec3f(0.45)),
				0.3,
			)
		},
		sample: () => {
			'use gpu'
			return RaymarchMaterial({
				baseColor: vec3f(0.12, 0.45, 0.9),
				metallic: 0.5,
				roughness: 0.2,
				emission: vec3f(0),
			})
		},
		lighting: createRaymarchConstantLighting({
			ambient: vec3f(0),
			directionalLights: [
				{
					direction: vec3f(-1, 1, -1),
					color: vec3f(1, 1, 1),
					intensity: 1.6,
				},
				{
					direction: vec3f(5, 1, -8),
					color: vec3f(1, 0.15, 0.1),
					intensity: 0.75,
				},
			],
		}),

		environment: (direction, roughness) => {
			'use gpu'

			const angle = atan2(direction.x, -direction.y) * Math.PI
			const z =
				direction.z + //
				sin(angle * 3) * 0.08 +
				sin(angle * 1) * 0.12

			const skyOrGround = smoothstep(-roughness, roughness, z)
			return mix(vec3f(0.3, 0.15, 0), vec3f(0, 0.3, 0.6), skyOrGround)
		},

		camera: () => {
			'use gpu'
			return RaymarchCamera({ position: cameraPosition, viewProjectionMatrix })
		},
	}
})
