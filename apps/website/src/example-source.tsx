import typescript from '@shikijs/langs/typescript'
import catppuccinMocha from '@shikijs/themes/catppuccin-mocha'
import { useEffect, useState } from 'preact/hooks'
import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

const highlighter = createHighlighterCore({
	themes: [catppuccinMocha],
	langs: [typescript],
	engine: createJavaScriptRegexEngine(),
})

type SourceState =
	| { status: 'loading' }
	| { status: 'ready'; source: string; html: string }
	| { status: 'error' }

export function ExampleSource({
	loadSource,
}: {
	loadSource: () => Promise<string>
}) {
	const [sourceState, setSourceState] = useState<SourceState>({
		status: 'loading',
	})
	const [copyStatus, setCopyStatus] = useState<'ready' | 'copied' | 'error'>(
		'ready',
	)

	useEffect(() => {
		let active = true
		setSourceState({ status: 'loading' })
		setCopyStatus('ready')

		void Promise.all([loadSource(), highlighter])
			.then(([source, instance]) => {
				if (!active) return
				setSourceState({
					status: 'ready',
					source,
					html: instance.codeToHtml(source, {
						lang: 'typescript',
						theme: catppuccinMocha,
					}),
				})
			})
			.catch((error: unknown) => {
				console.error('Failed to load example source', error)
				if (active) setSourceState({ status: 'error' })
			})

		return () => {
			active = false
		}
	}, [loadSource])

	async function copySource() {
		if (sourceState.status !== 'ready') return
		try {
			await navigator.clipboard.writeText(sourceState.source)
			setCopyStatus('copied')
		} catch {
			setCopyStatus('error')
		}
	}

	return (
		<section aria-label="Source code" class="w-full bg-[#1e1e2e]">
			<div class="sticky top-3 z-10 flex h-0 items-start justify-end pr-3 pt-3">
				<button
					type="button"
					disabled={sourceState.status !== 'ready'}
					onClick={copySource}
					class="cursor-pointer rounded-md border border-white/20 bg-gray-900/90 px-3 py-1.5 text-sm font-medium text-gray-100 shadow-lg backdrop-blur transition-colors hover:border-brand-400 hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-300 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{copyStatus === 'copied'
						? 'Copied!'
						: copyStatus === 'error'
							? 'Could not copy'
							: 'Copy code'}
				</button>
			</div>
			{sourceState.status === 'ready' ? (
				<div
					class="example-source overflow-x-auto"
					// Shiki escapes the source before producing highlighted HTML.
					dangerouslySetInnerHTML={{ __html: sourceState.html }}
				/>
			) : (
				<p class="p-6 pt-16 text-sm leading-6 text-gray-400" role="status">
					{sourceState.status === 'error'
						? 'Could not load the source code.'
						: 'Loading source code…'}
				</p>
			)}
		</section>
	)
}
