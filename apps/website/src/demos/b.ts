import { sdSphere } from '@typegpu/sdf'
import {
	AABB,
	createRaymarchConstantLighting,
	createRaymarchProgram,
	RaymarchCamera,
	RaymarchMaterial,
} from 'luxscura'
import { vec3f } from 'typegpu/data'
import { createCamera } from '../create-camera'

export const programB = createRaymarchProgram({ epsilon: 0.001 }, () => {
	const { cameraPosition, viewProjectionMatrix } = createCamera({
		position: vec3f(0, -4, 0),
		target: vec3f(0),
		fieldOfView: Math.PI / 4,
		near: 0.1,
		far: 100,
	})

	return {
		bounds: () => {
			'use gpu'
			return AABB({ min: vec3f(-1), max: vec3f(1) })
		},
		sd: (point) => {
			'use gpu'
			return sdSphere(point, 0.8)
		},
		sample: () => {
			'use gpu'
			return RaymarchMaterial({
				baseColor: vec3f(1),
				metallic: 0,
				roughness: 0.3,
				emission: vec3f(0),
			})
		},
		lighting: createRaymarchConstantLighting({
			ambient: vec3f(0.05),
			directionalLights: [
				{
					direction: vec3f(-1, 1, -1),
					color: vec3f(1),
					intensity: 2,
				},
			],
		}),
		environment: () => {
			'use gpu'
			return vec3f(0)
		},
		camera: () => {
			'use gpu'
			return RaymarchCamera({ position: cameraPosition, viewProjectionMatrix })
		},
	}
})
