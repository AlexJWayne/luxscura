import { describe, expect, test } from 'bun:test'
import tgpu from 'typegpu'
import { f32, vec3f } from 'typegpu/data'
import { AABB, aabbExitDistance } from './aabb'

const unitBounds = AABB({ min: vec3f(0), max: vec3f(1) })

describe('aabbExitDistance', () => {
	test('measures an axis-aligned ray from an entry face', () => {
		expect(
			aabbExitDistance(unitBounds, vec3f(0, 0.5, 0.5), vec3f(1, 0, 0)),
		).toBe(1)
	})

	test('uses the nearest exit plane for a diagonal ray', () => {
		const diagonal = Math.SQRT1_2

		expect(
			aabbExitDistance(
				unitBounds,
				vec3f(0, 0.5, 0.5),
				vec3f(diagonal, diagonal, 0),
			),
		).toBeCloseTo(Math.SQRT1_2)
	})

	test('handles negative and axis-parallel directions', () => {
		expect(
			aabbExitDistance(unitBounds, vec3f(0.5, 0.5, 1), vec3f(0, 0, -1)),
		).toBe(1)
	})

	test('resolves as a shader function', () => {
		const shaderFunction = tgpu.fn([AABB, vec3f, vec3f], f32)(aabbExitDistance)

		expect(() => tgpu.resolve([shaderFunction])).not.toThrow()
	})
})
