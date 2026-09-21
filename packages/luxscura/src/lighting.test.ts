import { describe, expect, test } from 'bun:test'
import { type v3f, vec3f } from 'typegpu/data'
import {
	createRaymarchConstantLighting,
	createShadeSurface,
	type RaymarchLight,
} from './lighting'
import { RaymarchMaterial } from './material'
import { RaymarchSurfaceSample } from './program'

const whiteLight: RaymarchLight = {
	direction: vec3f(0, 0, -1),
	color: vec3f(1),
	intensity: 1,
}

function shade({
	material = {},
	lights = [whiteLight],
	view = vec3f(0, 0, 1),
}: {
	material?: Partial<RaymarchMaterial>
	lights?: RaymarchLight[]
	view?: v3f
} = {}) {
	const shadeSurface = createShadeSurface({
		lighting: createRaymarchConstantLighting({
			ambient: vec3f(0),
			directionalLights: lights,
		}),
		environment: () => {
			'use gpu'
			return vec3f(0)
		},
	})
	const sample = RaymarchSurfaceSample({
		position: vec3f(0),
		normal: vec3f(0, 0, 1),
		material: RaymarchMaterial({
			baseColor: vec3f(0.8, 0.2, 0.1),
			metallic: 0,
			roughness: 0.5,
			emission: vec3f(0),
			...material,
		}),
	})
	return shadeSurface(view, sample)
}

function expectColor(actual: v3f, expected: v3f) {
	expect(actual.x).toBeCloseTo(expected.x, 5)
	expect(actual.y).toBeCloseTo(expected.y, 5)
	expect(actual.z).toBeCloseTo(expected.z, 5)
}

describe('direct material lighting', () => {
	test('is black without illumination, but preserves emission', () => {
		expectColor(shade({ lights: [] }), vec3f(0))
		const emission = vec3f(2, 0.5, 0.1)
		expectColor(shade({ lights: [], material: { emission } }), emission)
	})

	test('a black nonmetal still has a neutral direct highlight', () => {
		const color = shade({ material: { baseColor: vec3f(0) } })
		expect(color.x).toBeGreaterThan(0)
		expectColor(color, vec3f(color.x))
	})

	test('a metal reflects direct light with its base color and no diffuse fill', () => {
		// At normal incidence and roughness 1, the pure-metal response is color / (4π).
		expectColor(
			shade({ material: { metallic: 1, roughness: 1 } }),
			vec3f(0.8 / (4 * Math.PI), 0.2 / (4 * Math.PI), 0.1 / (4 * Math.PI)),
		)
	})

	test('adds lights linearly and respects their color and intensity', () => {
		const one = shade()
		expectColor(
			shade({ lights: [whiteLight, whiteLight] }),
			vec3f(one.x * 2, one.y * 2, one.z * 2),
		)
		expectColor(
			shade({
				lights: [{ ...whiteLight, intensity: 2, color: vec3f(1, 0, 0) }],
			}),
			vec3f(one.x * 2, 0, 0),
		)
		expectColor(shade({ lights: [{ ...whiteLight, intensity: 0 }] }), vec3f(0))
	})

	test('intermediate metallic blends the metal and nonmetal responses', () => {
		const nonmetal = shade({ material: { metallic: 0 } })
		const metal = shade({ material: { metallic: 1 } })
		expectColor(
			shade({ material: { metallic: 0.25 } }),
			vec3f(
				nonmetal.x * 0.75 + metal.x * 0.25,
				nonmetal.y * 0.75 + metal.y * 0.25,
				nonmetal.z * 0.75 + metal.z * 0.25,
			),
		)
	})

	test('roughness lowers the highlight peak and broadens its response', () => {
		const smooth = { baseColor: vec3f(1), metallic: 1, roughness: 0.2 }
		const rough = { ...smooth, roughness: 0.7 }
		expect(shade({ material: smooth }).x).toBeGreaterThan(
			shade({ material: rough }).x,
		)
		const view = vec3f(1, 0, 1)
		expect(shade({ material: rough, view }).x).toBeGreaterThan(
			shade({ material: smooth, view }).x,
		)
	})

	test('zero roughness and grazing views remain finite', () => {
		for (const view of [vec3f(0, 0, 1), vec3f(1, 0, 0.000001)]) {
			const color = shade({ material: { roughness: 0 }, view })
			for (const channel of [color.x, color.y, color.z]) {
				expect(Number.isFinite(channel)).toBe(true)
				expect(channel).toBeGreaterThanOrEqual(0)
			}
		}
	})

	test('rejects back-facing and tangent light/view directions without NaNs', () => {
		for (const direction of [vec3f(0, 0, 1), vec3f(1, 0, 0)]) {
			expectColor(shade({ lights: [{ ...whiteLight, direction }] }), vec3f(0))
		}
		for (const view of [vec3f(0, 0, -1), vec3f(1, 0, 0)]) {
			expectColor(shade({ view }), vec3f(0))
		}
	})
})
