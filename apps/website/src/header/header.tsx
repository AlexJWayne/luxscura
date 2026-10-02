import type { TgpuRoot } from 'typegpu'
import { LuxscuraHeaderBg } from './header-bg'
import { Logo } from './logo'

export function LuxscuraHeader({ root }: { root: TgpuRoot }) {
	return (
		<header class="bg-linear-to-b from-fuchsia-950 to-gray-950 w-full flex flex-col items-center justify-center h-120 relative">
			<LuxscuraHeaderBg root={root} />

			<div class="absolute w-full h-full bg-linear-to-b from-violet-950 to-30% to-transparent" />
			<div class="absolute w-full h-full bg-linear-to-t from-gray-950 to-60% to-transparent" />
			<div class="absolute w-full h-full bg-linear-to-r from-gray-950 to-20% to-transparent" />
			<div class="absolute w-full h-full bg-linear-to-l from-gray-950 to-20% to-transparent" />

			<div class="relative flex items-center">
				<Logo root={root} size={250} />
				<div>
					<h1 class="font-orbitron text-9xl text-white text-shadow-[0_0_20px_rgba(255,255,255,1)] relative -top-6">
						Luxscura
					</h1>
					<h2 class="font-oxanium text-[2.5rem] text-purple-200/75 relative -top-4 font-light flex justify-center tracking-wide">
						TypeGPU Raymarching Renderer
					</h2>
				</div>
			</div>
		</header>
	)
}
