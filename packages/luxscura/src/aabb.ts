import { f32, type Infer, struct, type v3f, vec3b, vec3f } from 'typegpu/data'
import { min, select } from 'typegpu/std'

export const AABB = struct({
	min: vec3f,
	max: vec3f,
})
export type AABB = Infer<typeof AABB>

export function aabbPoint(aabb: AABB, corner: v3f): v3f {
	'use gpu'
	return select(
		aabb.min,
		aabb.max,
		vec3b(corner.x > 0, corner.y > 0, corner.z > 0),
	)
}

export function aabbCenter(aabb: AABB): v3f {
	'use gpu'
	return (aabb.min + aabb.max) * 0.5
}

export function aabbExitDistance(
	aabb: AABB,
	point: v3f,
	direction: v3f,
): number {
	'use gpu'

	return min(
		axisExitDistance(point.x, direction.x, aabb.min.x, aabb.max.x),
		min(
			axisExitDistance(point.y, direction.y, aabb.min.y, aabb.max.y),
			axisExitDistance(point.z, direction.z, aabb.min.z, aabb.max.z),
		),
	)
}

function axisExitDistance(
	position: number,
	direction: number,
	minimum: number,
	maximum: number,
): number {
	'use gpu'

	if (direction > 0) return (maximum - position) / direction
	if (direction < 0) return (minimum - position) / direction
	return f32(1e9)
}
