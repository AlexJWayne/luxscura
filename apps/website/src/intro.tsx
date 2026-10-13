import { Callout } from './components/callout'
import { TextLink } from './components/text-link'

export function Intro() {
	return (
		<div class="mx-auto my-10 w-full max-w-6xl px-6 text-lg sm:px-8">
			<section
				class="grid gap-8 text-base leading-relaxed lg:grid-cols-2 lg:gap-16"
				aria-label="About Luxscura"
			>
				<AboutLuxscura />
				<GetStarted />
			</section>

			<section
				class="mt-12 grid gap-8 border-t border-brand-300/10 pt-8 md:grid-cols-3"
				aria-label="How it works"
			>
				<Callout title="Shapes as functions">
					A signed distance function (SDF) measures distance to a surface:
					negative inside, positive outside, zero on the surface.
				</Callout>
				<Callout title="Raymarching">
					Step along camera rays using those distances to find a surface, then
					shade it with the appearance you choose.
				</Callout>
				<Callout title="Built on TypeGPU">
					<TextLink href="https://docs.swmansion.com/TypeGPU/">
						TypeGPU
					</TextLink>{' '}
					lets you write WebGPU pipelines in TypeScript. Luxscura uses it to run
					your shape and shading functions on the GPU.
				</Callout>
			</section>
		</div>
	)
}

function AboutLuxscura() {
	return (
		<div class="space-y-4">
			<h2 class="font-oxanium text-3xl font-medium leading-tight text-heading">
				Raymarching with TypeScript
			</h2>
			<p>
				Luxscura is a{' '}
				<TextLink href="https://docs.swmansion.com/TypeGPU/">TypeGPU</TextLink>{' '}
				library for rendering signed distance functions with raymarching. Define
				your shapes, camera, and appearance to create a custom shader.
			</p>
		</div>
	)
}

function GetStarted() {
	return (
		<div class="min-w-0 space-y-4">
			<h2 class="font-oxanium text-xl font-medium text-heading">Get started</h2>
			<pre class="overflow-x-auto rounded-lg border border-brand-300/10 bg-gray-900 p-4 text-sm leading-6">
				<code class="text-brand-100">{`npm install luxscura typegpu
npm install --save-dev unplugin-typegpu`}</code>
			</pre>
			<p class="text-sm text-gray-400">
				Requires WebGPU and TypeGPU’s build plugin.{' '}
				<TextLink href="https://github.com/AlexJWayne/luxscura/blob/main/packages/luxscura/README.md">
					Setup & documentation
				</TextLink>
			</p>
		</div>
	)
}
