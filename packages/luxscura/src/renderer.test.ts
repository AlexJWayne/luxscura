import { expect, mock, test } from 'bun:test'
import tgpu, {
	type ColorAttachment,
	type DepthStencilAttachment,
	type TgpuRoot,
} from 'typegpu'
import { f32, mat4x4f, vec3f } from 'typegpu/data'
import { fwidth } from 'typegpu/std'
import { AABB } from './aabb'
import { createPbrAppearance, PbrMaterial } from './appearances/pbr'
import { createRaymarchConstantLighting } from './index'
import {
	createRaymarchProgram,
	RaymarchCamera,
	type RaymarchHotContext,
	type RaymarchProgram,
	type RaymarchSurface,
} from './program'
import { createRaymarchRenderer } from './renderer'

test('rebuilds the pipeline with updated program callbacks and options', () => {
	const draw = mock((_vertexCount: number, _instanceCount: number) => {})
	const pipeline = {
		withPerformanceCallback() {
			return this
		},
		withColorAttachment() {
			return this
		},
		withDepthStencilAttachment() {
			return this
		},
		draw,
	}
	const createRenderPipeline = mock((_descriptor: unknown) => pipeline)
	// Exercise lifecycle and shader generation without a GPU device.
	const root = { createRenderPipeline } as unknown as TgpuRoot
	const hot: RaymarchHotContext = { data: {} }
	const options = {
		label: 'Lifecycle test',
		epsilon: 0.01,
		epsilonNormal: 0.01,
		maxSteps: 10,
		maxDistance: 1,
	}
	const initialSurface: RaymarchSurface = {
		bounds: () => {
			'use gpu'
			return AABB({ min: vec3f(), max: vec3f(1) })
		},
		sd: () => {
			'use gpu'
			return f32(0)
		},
	}
	const initialBody: RaymarchProgram = {
		surface: initialSurface,
		camera: () => {
			'use gpu'
			return RaymarchCamera({
				position: vec3f(11.25),
				viewProjectionMatrix: mat4x4f(),
			})
		},
		appearance: createPbrAppearance({
			material: (result) => {
				'use gpu'
				return PbrMaterial({
					baseColor: vec3f(fwidth(result.fragmentCoord.x)),
					metallic: 0,
					roughness: 1,
					emission: vec3f(0),
				})
			},
			lighting: createRaymarchConstantLighting({
				ambient: vec3f(0.2),
				directionalLights: [
					{
						direction: vec3f(0, -1, 0),
						color: vec3f(22.25),
						intensity: 1,
					},
				],
			}),
			environment: (_direction, _roughness) => {
				'use gpu'
				return vec3f(33.25)
			},
		}),
	}
	const program = createRaymarchProgram({ ...initialBody, options }, hot)
	const preparedPrograms: RaymarchProgram[] = []
	const colorAttachment = {} as ColorAttachment
	const depthStencilAttachment = {} as DepthStencilAttachment
	const render = createRaymarchRenderer({
		root,
		program,
		prepare: (currentProgram) => {
			preparedPrograms.push(currentProgram)
			const appearance = currentProgram.appearance
			return {
				...currentProgram,
				surface: {
					...currentProgram.surface,
					isRayVisible: () => {
						'use gpu'
						return true
					},
				},
				appearance: (result) => {
					'use gpu'
					return appearance(result) + vec3f(77.25)
				},
			}
		},
	})

	render({ colorAttachment, depthStencilAttachment, instances: 2 })
	render({ colorAttachment, depthStencilAttachment, instances: 3 })
	expect(preparedPrograms).toEqual([initialBody])
	expect(createRenderPipeline).toHaveBeenCalledTimes(1)

	function resolvePipeline(index: number) {
		// Bun has no WebGPU globals. TypeGPU uses these flags while preparing
		// its logging buffers, even when only generating WGSL.
		const previousUsage = Object.getOwnPropertyDescriptor(
			globalThis,
			'GPUBufferUsage',
		)
		Object.defineProperty(globalThis, 'GPUBufferUsage', {
			configurable: true,
			value: { COPY_SRC: 4, COPY_DST: 8, STORAGE: 128 },
		})
		try {
			const shaderRoot = tgpu.initFromDevice({ device: {} as GPUDevice })
			const descriptor = createRenderPipeline.mock.calls[
				index
			]?.[0] as Parameters<TgpuRoot['createRenderPipeline']>[0]
			return tgpu.resolve([shaderRoot.createRenderPipeline(descriptor)])
		} finally {
			if (previousUsage)
				Object.defineProperty(globalThis, 'GPUBufferUsage', previousUsage)
			else Reflect.deleteProperty(globalThis, 'GPUBufferUsage')
		}
	}
	const initialShader = resolvePipeline(0)
	expect(initialShader).toMatch(/marchedDistance \+= \(distance\w* \* 1f\)/)
	expect(initialShader).toMatch(/if \(\(distance\w* < 0\.01f\)\)/)
	expect(initialShader).toContain('fwidth')
	for (const value of ['11.25', '22.25', '33.25', '77.25']) {
		expect(initialShader).toContain(value)
	}

	const updatedSurface: RaymarchSurface = {
		...initialSurface,
		sd: () => {
			'use gpu'
			return f32(1)
		},
	}
	const updatedBody: RaymarchProgram = {
		surface: updatedSurface,
		camera: () => {
			'use gpu'
			return RaymarchCamera({
				position: vec3f(44.25),
				viewProjectionMatrix: mat4x4f(),
			})
		},
		appearance: createPbrAppearance({
			material: () => {
				'use gpu'
				return PbrMaterial()
			},
			lighting: createRaymarchConstantLighting({
				ambient: vec3f(0.2),
				directionalLights: [
					{
						direction: vec3f(0, -1, 0),
						color: vec3f(55.25),
						intensity: 1,
					},
				],
			}),
			environment: () => {
				'use gpu'
				return vec3f(66.25)
			},
		}),
	}
	const updatedProgram = createRaymarchProgram(
		{
			...updatedBody,
			options: { ...options, depthCompare: 'always', stepScale: 0.5 },
		},
		hot,
	)
	render({ colorAttachment, depthStencilAttachment, instances: 4 })
	render({ colorAttachment, depthStencilAttachment, instances: 5 })

	expect(updatedProgram).toBe(program)
	expect(program.version).toBe(2)
	expect(program.program.camera).toBe(updatedBody.camera)
	expect(program.program.surface).toBe(updatedBody.surface)
	expect(program.program.appearance).toBe(updatedBody.appearance)
	expect(preparedPrograms).toEqual([initialBody, updatedBody])
	expect(createRenderPipeline).toHaveBeenCalledTimes(2)
	expect(createRenderPipeline.mock.calls[1]?.[0]).toMatchObject({
		depthStencil: { depthCompare: 'always' },
	})
	expect(draw.mock.calls.map(([, count]) => count)).toEqual([2, 3, 4, 5])
	const updatedShader = resolvePipeline(1)
	expect(updatedShader).toMatch(/marchedDistance \+= \(distance\w* \* 0\.5f\)/)
	expect(updatedShader).toMatch(/if \(\(distance\w* < 0\.01f\)\)/)
	for (const value of ['44.25', '55.25', '66.25', '77.25']) {
		expect(updatedShader).toContain(value)
	}
	for (const value of ['11.25', '22.25', '33.25']) {
		expect(updatedShader).not.toContain(value)
	}
})

test('compiles a custom appearance with screen-space derivatives', () => {
	let descriptor: Parameters<TgpuRoot['createRenderPipeline']>[0] | undefined
	const pipeline = {
		withPerformanceCallback() {
			return this
		},
		withColorAttachment() {
			return this
		},
		withDepthStencilAttachment() {
			return this
		},
		draw() {},
	}
	const root = {
		createRenderPipeline(nextDescriptor: typeof descriptor) {
			descriptor = nextDescriptor
			return pipeline
		},
	} as unknown as TgpuRoot
	const program = createRaymarchProgram({
		options: { epsilon: 0.01 },
		camera: () => {
			'use gpu'
			return RaymarchCamera({
				position: vec3f(0, 0, -3),
				viewProjectionMatrix: mat4x4f(),
			})
		},
		surface: {
			bounds: () => {
				'use gpu'
				return AABB({ min: vec3f(-1), max: vec3f(1) })
			},
			sd: (position) => {
				'use gpu'
				return position.z
			},
		},
		appearance: (result) => {
			'use gpu'
			return vec3f(
				fwidth(result.fragmentCoord.x),
				f32(result.stepCount),
				result.rayDistance,
			)
		},
	})
	createRaymarchRenderer({ root, program })
	if (!descriptor) throw new Error('Expected a render pipeline descriptor')

	const previousUsage = Object.getOwnPropertyDescriptor(
		globalThis,
		'GPUBufferUsage',
	)
	Object.defineProperty(globalThis, 'GPUBufferUsage', {
		configurable: true,
		value: { COPY_SRC: 4, COPY_DST: 8, STORAGE: 128 },
	})
	try {
		const shaderRoot = tgpu.initFromDevice({ device: {} as GPUDevice })
		const shader = tgpu.resolve([shaderRoot.createRenderPipeline(descriptor)])
		expect(shader).toContain('fwidth')
		expect(shader).toContain('@builtin(position)')
	} finally {
		if (previousUsage)
			Object.defineProperty(globalThis, 'GPUBufferUsage', previousUsage)
		else Reflect.deleteProperty(globalThis, 'GPUBufferUsage')
	}
})
