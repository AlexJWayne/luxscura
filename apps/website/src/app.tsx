import tgpu from 'typegpu'
import { ExampleSelector } from './example-selector'
import { LuxscuraHeader } from './header/header'

const root = await tgpu.init()

export function App() {
	return (
		<div class="bg-gray-950 min-h-screen text-gray-300 flex flex-col font-outfit">
			<LuxscuraHeader root={root} />
			<main class="flex flex-1 flex-col items-center">
				<ExampleSelector />
			</main>
		</div>
	)
}
