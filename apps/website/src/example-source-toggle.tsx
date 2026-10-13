import { useState } from 'preact/hooks'
import { ExampleSource } from './example-source'

export function ExampleSourceToggle({
	loadSource,
}: {
	loadSource: () => Promise<string>
}) {
	const [sourceOpen, setSourceOpen] = useState(false)

	return (
		<div class="border-t border-brand-300/10">
			<button
				type="button"
				aria-expanded={sourceOpen}
				aria-controls="example-source"
				onClick={() => setSourceOpen(!sourceOpen)}
				class="flex w-full cursor-pointer items-center justify-between gap-4 p-4 text-left text-base text-brand-200 hover:bg-brand-300/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-300 sm:px-6"
			>
				<span>{sourceOpen ? 'Hide source' : 'View source'}</span>
				<span aria-hidden="true" class="text-xl">
					{sourceOpen ? '−' : '+'}
				</span>
			</button>

			<div id="example-source" hidden={!sourceOpen}>
				{sourceOpen && (
					<div class="flex flex-col items-center">
						<ExampleSource loadSource={loadSource} />
						<button
							type="button"
							class="w-full cursor-pointer p-4 text-sm text-brand-200 hover:bg-brand-300/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-300"
							onClick={() => setSourceOpen(false)}
						>
							Hide source
						</button>
					</div>
				)}
			</div>
		</div>
	)
}
