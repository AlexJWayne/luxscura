import { expect, mock, test } from 'bun:test'
import tgpu, {
	type ColorAttachment,
	type DepthStencilAttachment,
	type TgpuRoot,
} from 'typegpu'
import { f32, mat4x4f, vec3f } from 'typegpu/data'
import { AABB } from './aabb'
import { createRaymarchConstantLighting } from './lighting'
import { RaymarchMaterial } from './material'
import {
	createRaymarchProgram,
	type RaymarchHotContext,
	type RaymarchProgram,
	type RaymarchSurface,
} from './program'
import { createRaymarchRenderer, RaymarchCamera } from './renderer'

test('rebuilds all program callbacks with current options and the same setup context', () => {
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
	const resource = { value: 1 }
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
		sample: () => {
			'use gpu'
			return RaymarchMaterial()
		},
	}
	const initialBody: RaymarchProgram = {
		...initialSurface,
		camera: () => {
			'use gpu'
			return RaymarchCamera({
				position: vec3f(11.25),
				viewProjectionMatrix: mat4x4f(),
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
	}
	const initialFactory = mock(
		(_context: { resource: typeof resource }) => initialBody,
	)
	const program = createRaymarchProgram(options, initialFactory, hot)
	const preparedPrograms: RaymarchProgram[] = []
	const colorAttachment = {} as ColorAttachment
	const depthStencilAttachment = {} as DepthStencilAttachment
	const render = createRaymarchRenderer({
		root,
		program,
		context: { resource },
		prepare: (createdProgram) => {
			preparedPrograms.push(createdProgram)
			const environment = createdProgram.environment
			return {
				...createdProgram,
				isRayVisible: () => {
					'use gpu'
					return true
				},
				environment: (direction, roughness) => {
					'use gpu'
					return environment(direction, roughness) + vec3f(77.25)
				},
			}
		},
	})

	render({ colorAttachment, depthStencilAttachment, instances: 2 })
	render({ colorAttachment, depthStencilAttachment, instances: 3 })
	expect(initialFactory).toHaveBeenCalledTimes(1)
	expect(initialFactory).toHaveBeenCalledWith({ resource })
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
		...updatedSurface,
		camera: () => {
			'use gpu'
			return RaymarchCamera({
				position: vec3f(44.25),
				viewProjectionMatrix: mat4x4f(),
			})
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
	}
	const updatedFactory = mock(
		(_context: { resource: typeof resource }) => updatedBody,
	)
	createRaymarchProgram(
		{ ...options, depthCompare: 'always' },
		updatedFactory,
		hot,
	)
	render({ colorAttachment, depthStencilAttachment, instances: 4 })
	render({ colorAttachment, depthStencilAttachment, instances: 5 })

	expect(updatedFactory).toHaveBeenCalledTimes(1)
	expect(updatedFactory.mock.calls[0]?.[0]).toEqual({ resource })
	expect(preparedPrograms).toEqual([initialBody, updatedBody])
	expect(createRenderPipeline).toHaveBeenCalledTimes(2)
	expect(createRenderPipeline.mock.calls[1]?.[0]).toMatchObject({
		depthStencil: { depthCompare: 'always' },
	})
	expect(draw.mock.calls.map(([, count]) => count)).toEqual([2, 3, 4, 5])
	const updatedShader = resolvePipeline(1)
	for (const value of ['44.25', '55.25', '66.25', '77.25']) {
		expect(updatedShader).toContain(value)
	}
	for (const value of ['11.25', '22.25', '33.25']) {
		expect(updatedShader).not.toContain(value)
	}
})
