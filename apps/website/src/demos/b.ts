import { sdSphere } from '@typegpu/sdf'
import { AABB, createRaymarchProgram, RaymarchCamera } from 'luxscura'
import { vec3f } from 'typegpu/data'
import { createCamera } from '../create-camera'
import type { DemoContext } from '../demo-renderer'

export const programB = createRaymarchProgram<DemoContext>(
	{ epsilon: 0.001 },
	() => {
		const { cameraPosition, viewProjectionMatrix } = createCamera({
			position: vec3f(0, -4, 0),
			target: vec3f(0),
			fieldOfView: Math.PI / 4,
			near: 0.1,
			far: 100,
		})

		return {
			camera: () => {
				'use gpu'
				return RaymarchCamera({
					position: cameraPosition,
					viewProjectionMatrix,
				})
			},

			surface: {
				bounds: () => {
					'use gpu'
					return AABB({ min: vec3f(-1), max: vec3f(1) })
				},
				sd: (point) => {
					'use gpu'
					return sdSphere(point, 0.8)
				},
			},

			appearance: (result) => {
				'use gpu'
				return vec3f(result.normal)
			},
		}
	},
)
