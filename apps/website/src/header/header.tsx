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

			<a
				href="https://github.com/AlexJWayne/luxscura"
				class="absolute right-4 top-4 z-10 inline-flex min-h-11 items-center gap-2 rounded-lg border border-brand-300/25 bg-gray-950/70 px-4 py-2 text-sm font-medium text-brand-100 backdrop-blur-sm transition-colors hover:border-brand-300/60 hover:bg-violet-950/80 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-300 sm:right-8 sm:top-6"
			>
				<svg
					viewBox="0 0 24 24"
					fill="currentColor"
					class="size-5 shrink-0"
					aria-hidden="true"
				>
					<path d="M12 .297C5.37.297 0 5.67 0 12.297c0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.043-1.61-4.043-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.084 1.838 1.237 1.838 1.237 1.07 1.835 2.809 1.305 3.495.998.108-.776.418-1.305.762-1.605-2.665-.3-5.467-1.332-5.467-5.93 0-1.31.469-2.381 1.236-3.221-.124-.303-.536-1.524.117-3.176 0 0 1.008-.322 3.301 1.23a11.52 11.52 0 0 1 3.003-.404c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.655 1.652.243 2.873.12 3.176.77.84 1.235 1.911 1.235 3.221 0 4.61-2.807 5.625-5.479 5.922.43.372.823 1.102.823 2.222 0 1.606-.015 2.898-.015 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.595 24 12.297c0-6.627-5.373-12-12-12" />
				</svg>
				View on GitHub
			</a>

			<div class="relative flex items-center">
				<Logo root={root} size={250} />
				<div>
					<h1 class="font-orbitron text-9xl text-white text-shadow-[0_0_20px_rgba(255,255,255,1)] relative -top-6">
						Luxscura
					</h1>
					<h2 class="font-heading text-[2.5rem] text-brand-200/75 relative -top-4 font-light flex justify-center tracking-wide">
						TypeGPU Raymarching Renderer
					</h2>
				</div>
			</div>
		</header>
	)
}
