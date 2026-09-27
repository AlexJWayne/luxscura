import { useEffect, useRef } from 'preact/hooks'
import type { TgpuRoot } from 'typegpu'

export function useLuxscuraRenderer(
	root: TgpuRoot,
	createRenderer: (
		root: TgpuRoot,
		canvas: HTMLCanvasElement,
	) => Promise<{ destroy: () => void }>,
) {
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		let renderer: Awaited<Promise<{ destroy: () => void }>> | undefined
		let disposed = false

		void createRenderer(root, canvas)
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
	}, [createRenderer, root])

	return canvasRef
}
