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

		const renderer = createRenderer(root, canvas)

		const resizeObserver = new ResizeObserver(() => renderer.resize?.())
		resizeObserver.observe(canvas)

		return () => {
			renderer.destroy()
			resizeObserver.disconnect()
		}
	}, [createRenderer, root])

	return canvasRef
}
