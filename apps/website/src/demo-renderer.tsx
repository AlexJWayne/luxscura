import {
	createRaymarchRenderer,
	type RaymarchProgramDefinition,
} from 'luxscura'
import { useEffect, useRef } from 'preact/hooks'
import { type TgpuUniform, tgpu } from 'typegpu'
import { f32 } from 'typegpu/data'

export interface DemoContext {
	elapsedTime: TgpuUniform<typeof f32>
}

type DemoProgram = Readonly<RaymarchProgramDefinition<DemoContext>>

async function createDemoRenderer(
	canvas: HTMLCanvasElement,
	program: DemoProgram,
) {
	const root = await tgpu.init()
	const canvasContext = root.configureContext({ canvas })
	const elapsedTime = root.createUniform(f32, 0)
	const demoContext: DemoContext = { elapsedTime }

	const depthTexture = root
		.createTexture({
			size: [canvas.width, canvas.height],
			format: 'depth24plus',
		})
		.$usage('render')

	const raymarchRender = createRaymarchRenderer({
		root,
		program,
		context: demoContext,
	})
	const startTime = performance.now()
	const render = (timestamp: number) => {
		elapsedTime.write((timestamp - startTime) / 1000)
		raymarchRender({
			colorAttachment: { view: canvasContext },
			depthStencilAttachment: { view: depthTexture },
		})
		requestAnimationFrame(render)
	}
	requestAnimationFrame(render)

	return {
		destroy: () => root.destroy(),
	}
}

function useDemoRenderer(program: DemoProgram) {
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		let renderer: Awaited<ReturnType<typeof createDemoRenderer>> | undefined
		let disposed = false

		void createDemoRenderer(canvas, program).then((nextRenderer) => {
			if (disposed) nextRenderer.destroy()
			else renderer = nextRenderer
		})

		return () => {
			disposed = true
			renderer?.destroy()
		}
	}, [program])

	return canvasRef
}

export function DemoRenderer({ program }: { program: DemoProgram }) {
	const canvasRef = useDemoRenderer(program)

	return (
		<canvas
			class="h-auto max-h-[calc(100vh-8rem)] w-full max-w-[min(800px,calc(100vw-3rem))]"
			ref={canvasRef}
			width={800}
			height={800}
		/>
	)
}
