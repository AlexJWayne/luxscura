import { useEffect, useRef } from 'preact/hooks'
import type { TgpuRoot } from 'typegpu'

export function useLuxscuraRenderer(
	root: TgpuRoot,
	createRenderer: (
		root: TgpuRoot,
		canvas: HTMLCanvasElement,
	) => { destroy: () => void; resize?: () => void },
) {
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		let renderer: { destroy: () => void; resize?: () => void } | undefined
		let disposed = false

		const nextRenderer = createRenderer(root, canvas)
		if (disposed) nextRenderer.destroy()
		else renderer = nextRenderer

		const resizeObserver = new ResizeObserver(() => renderer?.resize?.())
		if (canvasRef.current) resizeObserver.observe(canvasRef.current)

		return () => {
			disposed = true
			renderer?.destroy()
			resizeObserver.disconnect()
		}
	}, [createRenderer, root])

	return canvasRef
}
