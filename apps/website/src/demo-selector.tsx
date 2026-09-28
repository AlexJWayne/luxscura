import { useState } from 'preact/hooks'
import { DemoRenderer } from './demo-renderer'
import { DemoSource } from './demo-source'
import { createGlossyDemo } from './demos/glossy'
import { createInstancesDemo } from './demos/instances'
import { createLogoDemo } from './demos/logo'
import { createMatteDemo } from './demos/matte'
import { createPbrDemo } from './demos/pbr'

const demos = [
	{ name: 'Matte', createRenderer: createMatteDemo },
	{ name: 'Glossy', createRenderer: createGlossyDemo },
	{ name: 'PBR', createRenderer: createPbrDemo },
	{ name: 'Instances', createRenderer: createInstancesDemo },
	{ name: 'Logo', createRenderer: createLogoDemo },
] as const

const sourceFiles = import.meta.glob<string>('./demos/*.ts', {
	query: '?raw',
	import: 'default',
})

type DemoName = (typeof demos)[number]['name']
export function DemoSelector() {
	const [activeDemo, setActiveDemo] = useState<DemoName>('Matte')
	const demo = demos.find(({ name }) => name === activeDemo) ?? demos[0]
	const sourcePath = `./demos/${demo.name.toLowerCase()}.ts`
	const loadSource = sourceFiles[sourcePath]
	if (!loadSource) throw new Error(`Missing source file: ${sourcePath}`)

	return (
		<>
			<div class="max-w-4xl flex flex-col items-center my-4">
				<h1 class="text-3xl my-4 text-purple-400 font-bold">Examples</h1>

				<fieldset class="flex rounded-lg p-1">
					{demos.map((demo) => (
						<button
							key={demo.name}
							type="button"
							aria-pressed={activeDemo === demo.name}
							class={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
								activeDemo === demo.name
									? 'bg-violet-900'
									: 'text-slate-300 hover:text-white'
							}`}
							onClick={() => setActiveDemo(demo.name)}
						>
							{demo.name}
						</button>
					))}
				</fieldset>
			</div>

			<DemoRenderer key={demo.name} createRenderer={demo.createRenderer} />
			<DemoSource key={sourcePath} loadSource={loadSource} />
		</>
	)
}
