import { useState } from 'preact/hooks'
import { DemoRenderer } from './demo-renderer'
import { programA } from './demos/a'
import { programB } from './demos/b'

const demos = [
	{ name: 'A', program: programA },
	{ name: 'B', program: programB },
] as const

type DemoName = (typeof demos)[number]['name']

export function App() {
	const [activeDemo, setActiveDemo] = useState<DemoName>('A')
	const demo = demos.find(({ name }) => name === activeDemo) ?? demos[0]

	return (
		<main class="flex min-h-screen flex-col items-center bg-slate-950 px-6 py-8 text-slate-50">
			<div class="flex w-full max-w-4xl items-center justify-between gap-6">
				<h1 class="text-2xl font-bold tracking-tight">Luxscura</h1>
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
				<DemoRenderer key={demo.name} program={demo.program} />
			</div>
		</main>
	)
}
