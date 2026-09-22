import {
	createRaymarchRenderer,
	type RaymarchProgramDefinition,
} from 'luxscura'
import { useEffect, useRef } from 'preact/hooks'
import { tgpu } from 'typegpu'

type DemoProgram = Readonly<RaymarchProgramDefinition<undefined>>

async function createDemoRenderer(
	canvas: HTMLCanvasElement,
	program: DemoProgram,
) {
	const root = await tgpu.init()
	const context = root.configureContext({ canvas })

	const depthTexture = root
		.createTexture({
			size: [canvas.width, canvas.height],
			format: 'depth24plus',
		})
		.$usage('render')

	const raymarchRender = createRaymarchRenderer({ root, program })
	const render = () => {
		raymarchRender({
			colorAttachment: { view: context },
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
