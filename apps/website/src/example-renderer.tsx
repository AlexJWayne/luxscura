import { useEffect, useRef } from 'preact/hooks'

type CreateExampleRenderer = (
	canvas: HTMLCanvasElement,
) => Promise<{ destroy: () => void }>

function useExampleRenderer(createRenderer: CreateExampleRenderer) {
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		let renderer: Awaited<ReturnType<CreateExampleRenderer>> | undefined
		let disposed = false

		void createRenderer(canvas)
			.then((nextRenderer) => {
				if (disposed) nextRenderer.destroy()
				else renderer = nextRenderer
			})
			.catch((error: unknown) => {
				console.error('Failed to initialize example', error)
			})

		return () => {
			disposed = true
			renderer?.destroy()
		}
	}, [createRenderer])

	return canvasRef
}

export function ExampleRenderer({
	createRenderer,
}: {
	createRenderer: CreateExampleRenderer
}) {
	const canvasRef = useExampleRenderer(createRenderer)

	return (
		<canvas
			class="h-auto max-h-[calc(100vh-8rem)] w-full max-w-[min(800px,calc(100vw-3rem))]"
			ref={canvasRef}
			width={800}
			height={800}
		/>
	)
}
