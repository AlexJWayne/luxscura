import { useState } from 'preact/hooks'
import tgpu from 'typegpu'
import { DemoRenderer } from './demo-renderer'
import { createGlossyDemo } from './demos/glossy'
import { createInstancesDemo } from './demos/instances'
import { createLogoDemo } from './demos/logo'
import { createMatteDemo } from './demos/matte'
import { createPbrDemo } from './demos/pbr'
import { Logo } from './logo'

const demos = [
	{ name: 'Logo', createRenderer: createLogoDemo },
	{ name: 'Matte', createRenderer: createMatteDemo },
	{ name: 'Glossy', createRenderer: createGlossyDemo },
	{ name: 'PBR', createRenderer: createPbrDemo },
	{ name: 'Instances', createRenderer: createInstancesDemo },
] as const

type DemoName = (typeof demos)[number]['name']

const root = await tgpu.init()

export function App() {
	const [activeDemo, setActiveDemo] = useState<DemoName>('Logo')
	const demo = demos.find(({ name }) => name === activeDemo) ?? demos[0]

	return (
		<div class="bg-gray-950 min-h-screen text-gray-300 flex flex-col">
			<header class="bg-linear-to-b from-violet-950 to-gray-950 w-full flex items-center justify-center h-72">
				<Logo root={root} size={250} />
				<h1 class="font-orbitron text-[8rem] text-white text-shadow-[0_0_20px_rgba(255,255,255,1)]">
					Luxscura
				</h1>
			</header>

			<main class="flex flex-1 flex-col items-center">
				<div class="max-w-4xl">
					<fieldset class="flex rounded-lg bg-slate-800 p-1">
						<legend class="sr-only">Choose a demo</legend>
						{demos.map((demo) => (
							<button
								key={demo.name}
								type="button"
								aria-pressed={activeDemo === demo.name}
								class={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
									activeDemo === demo.name
										? 'bg-white text-slate-950 shadow-sm'
										: 'text-slate-300 hover:text-white'
								}`}
								onClick={() => setActiveDemo(demo.name)}
							>
								{demo.name}
							</button>
						))}
					</fieldset>
				</div>
				<div class="grid flex-1 place-items-center">
					<DemoRenderer key={demo.name} createRenderer={demo.createRenderer} />
				</div>
			</main>
		</div>
	)
}
