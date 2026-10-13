import tgpu from 'typegpu'
import { ExampleSelector } from './example-selector'
import { FurtherReading } from './further-reading'
import { LuxscuraHeader } from './header/header'
import { Intro } from './intro'

const root = await tgpu.init()

export function App() {
	return (
		<div class="bg-gray-950 min-h-screen text-gray-300 flex flex-col font-sans">
			<LuxscuraHeader root={root} />

			<Intro />

			<main class="flex flex-1 flex-col items-center">
				<ExampleSelector />
			</main>

			<div class="mx-auto mb-10 w-full max-w-6xl px-6 sm:px-8">
				<FurtherReading />
			</div>
		</div>
	)
}
