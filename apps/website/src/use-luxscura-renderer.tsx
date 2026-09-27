import { useEffect, useRef } from 'preact/hooks'
import type { TgpuRoot } from 'typegpu'

export function useLuxscuraRenderer(
	root: TgpuRoot,
	createRenderer: (
		root: TgpuRoot,
		canvas: HTMLCanvasElement,
	) => { destroy: () => void },
) {
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		let renderer: { destroy: () => void } | undefined
		let disposed = false

		const nextRenderer = createRenderer(root, canvas)
		if (disposed) nextRenderer.destroy()
		else renderer = nextRenderer

		return () => {
			disposed = true
			renderer?.destroy()
		}
	}, [createRenderer, root])

	return canvasRef
}
