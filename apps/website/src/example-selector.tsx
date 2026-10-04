import { useState } from 'preact/hooks'
import { ExampleRenderer } from './example-renderer'
import { ExampleSource } from './example-source'
import { createGlossyExample } from './examples/glossy'
import { createInstancesExample } from './examples/instances'
import { createLogoExample } from './examples/logo'
import { createMatteExample } from './examples/matte'
import { createMouseExample } from './examples/mouse'
import { createPbrExample } from './examples/pbr'
import { createRepetitionExample } from './examples/repetition'

const examples = [
	{ name: 'Repetition', createRenderer: createRepetitionExample },
	{ name: 'Logo', createRenderer: createLogoExample },
	{ name: 'Mouse', createRenderer: createMouseExample },
	{ name: 'Matte', createRenderer: createMatteExample },
	{ name: 'Glossy', createRenderer: createGlossyExample },
	{ name: 'PBR', createRenderer: createPbrExample },
	{ name: 'Instances', createRenderer: createInstancesExample },
] as const

const sourceFiles = import.meta.glob<string>('./examples/*.ts', {
	query: '?raw',
	import: 'default',
})

type ExampleName = (typeof examples)[number]['name']
export function ExampleSelector() {
	const [activeExample, setActiveExample] = useState<ExampleName>('Repetition')
	const example =
		examples.find(({ name }) => name === activeExample) ?? examples[0]
	const sourcePath = `./examples/${example.name.toLowerCase()}.ts`
	const loadSource = sourceFiles[sourcePath]
	if (!loadSource) throw new Error(`Missing source file: ${sourcePath}`)

	return (
		<>
			<div class="max-w-4xl flex flex-col items-center my-4 font-oxanium">
				<h1 class="text-3xl my-4 text-purple-400 font-bold">Examples</h1>

				<fieldset class="flex rounded-lg p-1">
					{examples.map((example) => (
						<button
							key={example.name}
							type="button"
							aria-pressed={activeExample === example.name}
							class={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
								activeExample === example.name
									? 'bg-violet-900'
									: 'text-slate-300 hover:text-white'
							}`}
							onClick={() => setActiveExample(example.name)}
						>
							{example.name}
						</button>
					))}
				</fieldset>
			</div>

			<ExampleRenderer
				key={example.name}
				createRenderer={example.createRenderer}
			/>
			<ExampleSource key={sourcePath} loadSource={loadSource} />
		</>
	)
}
