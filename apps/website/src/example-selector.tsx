import { useState } from 'preact/hooks'
import { RadioButtonGroup } from './components/radio-button-group'
import { ExampleRenderer } from './example-renderer'
import { ExampleSourceToggle } from './example-source-toggle'
import { createGlossyExample } from './examples/glossy'
import { createInstancesExample } from './examples/instances'
import { createLogoExample } from './examples/logo'
import { createMatteExample } from './examples/matte'
import { createMouseExample } from './examples/mouse'
import { createPbrExample } from './examples/pbr'
import { createRepetitionExample } from './examples/repetition'

const examples = [
	{
		name: 'Repetition',
		description:
			'Repeat a distance function across a grid and animate each cell.',
		createRenderer: createRepetitionExample,
	},
	{
		name: 'Logo',
		description:
			'Combine shapes and vary their materials across a single surface.',
		createRenderer: createLogoExample,
	},
	{
		name: 'Mouse',
		description:
			'Use the pointer to add or subtract a sphere from a grid of cubes.',
		createRenderer: createMouseExample,
	},
	{
		name: 'Matte',
		description: 'Apply diffuse shading with the "matte" appearance.',
		createRenderer: createMatteExample,
	},
	{
		name: 'Glossy',
		description: 'Apply glossy, specular shading with the "glossy" appearance.',
		createRenderer: createGlossyExample,
	},
	{
		name: 'PBR',
		description:
			'(Experimental) Set metallic and roughness values and sample an environment for reflections.',
		createRenderer: createPbrExample,
	},
	{
		name: 'Instances',
		description:
			'Render multiple shapes with per-instance positions and colors.',
		createRenderer: createInstancesExample,
	},
] as const

const sourceFiles = import.meta.glob<string>('./examples/*.ts', {
	query: '?raw',
	import: 'default',
})

type ExampleName = (typeof examples)[number]['name']

const exampleGroups: { label: string; names: ExampleName[] }[] = [
	{ label: 'Techniques', names: ['Repetition', 'Logo', 'Mouse', 'Instances'] },
	{ label: 'Appearances', names: ['Matte', 'Glossy', 'PBR'] },
]

export function ExampleSelector() {
	const { activeExample, setActiveExample, example, loadSource } = useExample()

	return (
		<section
			class="w-full max-w-6xl space-y-6 px-6 sm:px-8"
			aria-labelledby="gallery-examples-title"
		>
			<h2
				id="gallery-examples-title"
				class="font-oxanium text-2xl font-medium text-heading"
			>
				Examples
			</h2>
			<div class="rounded-lg border border-brand-300/15">
				<nav
					class="space-y-2 border-b border-brand-300/10 p-4 sm:p-6"
					aria-label="Examples"
				>
					{exampleGroups.map((group) => (
						<RadioButtonGroup
							key={group.label}
							label={group.label}
							name="example"
							values={group.names}
							value={activeExample}
							setValue={setActiveExample}
						/>
					))}
				</nav>

				<div class="flex flex-col items-center">
					<div class="w-full bg-radial from-brand-950/20 to-transparent">
						<ExampleRenderer
							key={example.name}
							createRenderer={example.createRenderer}
						/>
					</div>
					<p
						class="w-full p-4 text-base leading-relaxed sm:p-6"
						aria-live="polite"
					>
						{example.description}
					</p>
				</div>

				<ExampleSourceToggle loadSource={loadSource} />
			</div>
		</section>
	)
}

function useExample() {
	const [activeExample, setActiveExample] = useState<ExampleName>('Repetition')
	const example =
		examples.find(({ name }) => name === activeExample) ?? examples[0]

	const sourcePath = `./examples/${example.name.toLowerCase()}.ts`
	const loadSource = sourceFiles[sourcePath]
	if (!loadSource) throw new Error(`Missing source file: ${sourcePath}`)

	return { activeExample, setActiveExample, example, loadSource }
}
