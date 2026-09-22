import { mat4x4f, type v3f, vec3f } from 'typegpu/data'
import { mat4 } from 'wgpu-matrix'

export interface CameraOptions {
	position: v3f
	target: v3f
	/** Vertical field of view in radians. */
	fieldOfView: number
	near: number
	far: number
	/** Width divided by height. Defaults to a square viewport. */
	aspectRatio?: number
}

/** Computes the values for a fixed perspective camera. */
export function createCamera({
	position,
	target,
	fieldOfView,
	near,
	far,
	aspectRatio = 1,
}: CameraOptions) {
	const viewProjectionMatrix = mat4x4f()
	const projectionMatrix = mat4.perspective(fieldOfView, aspectRatio, near, far)
	const viewMatrix = mat4.lookAt(position, target, vec3f(0, 1, 0))
	mat4.multiply(projectionMatrix, viewMatrix, viewProjectionMatrix)

	return { cameraPosition: position, viewProjectionMatrix }
}
