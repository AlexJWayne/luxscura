import { useEffect, useRef } from 'preact/hooks'

type CreateDemoRenderer = (
	canvas: HTMLCanvasElement,
) => Promise<{ destroy: () => void }>

function useDemoRenderer(createRenderer: CreateDemoRenderer) {
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		let renderer: Awaited<ReturnType<CreateDemoRenderer>> | undefined
		let disposed = false

		void createRenderer(canvas)
			.then((nextRenderer) => {
				if (disposed) nextRenderer.destroy()
				else renderer = nextRenderer
			})
			.catch((error: unknown) => {
				console.error('Failed to initialize demo', error)
			})

		return () => {
			disposed = true
			renderer?.destroy()
		}
	}, [createRenderer])

	return canvasRef
}

export function DemoRenderer({
	createRenderer,
}: {
	createRenderer: CreateDemoRenderer
}) {
	const canvasRef = useDemoRenderer(createRenderer)

	return (
		<canvas
			class="h-auto max-h-[calc(100vh-8rem)] w-full max-w-[min(800px,calc(100vw-3rem))]"
			ref={canvasRef}
			width={800}
			height={800}
		/>
	)
}
