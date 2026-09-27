import { type v3f, vec3f } from 'typegpu/data'
import { abs, clamp, fract, mix } from 'typegpu/std'

/** Converts HSV in [0, 1] to RGB in [0, 1]. Hue wraps every full turn. */
export function hsvToRgb(hsv: v3f): v3f {
	'use gpu'
	const hue = fract(vec3f(hsv.x).add(vec3f(0, 2 / 3, 1 / 3)))
	const rgb = clamp(abs(hue.mul(6).sub(3)).sub(1), vec3f(0), vec3f(1))
	return mix(vec3f(1), rgb, hsv.y).mul(hsv.z)
}
