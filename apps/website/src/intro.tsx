export function Intro() {
	return (
		<div className="w-200 mx-auto text-lg my-10 [&_a]:underline [&_a]:text-fuchsia-200 [&_a]:hover:text-fuchsia-400">
			<p>
				Luxscura is a <a href="https://docs.swmansion.com/TypeGPU/">TypeGPU</a>{' '}
				library for rendering signed distance functions (SDFs) with raymarching.
				Define your shapes, camera, and appearance to create a custom
				raymarching shader.
			</p>

			<h3 class="text-xl mt-8 font-oxanium font-bold text-purple-300">
				Why Luxscura?
			</h3>
			<p>
				Luxscura handles raymarching and provides lighting models, so you can
				focus on the art you want to create.
			</p>

			<h3 class="text-xl mt-8 font-oxanium font-bold text-purple-300">
				What's raymarching?
			</h3>
			<p>
				A technique for rendering 3D scenes by stepping along rays from the
				camera, using distance estimates to find object surfaces.
			</p>

			<h3 class="text-xl mt-8 font-oxanium font-bold text-purple-300">
				What's an SDF?
			</h3>
			<p>
				A signed distance function describes a shape by giving the distance from
				any point to its nearest surface: negative inside, positive outside, and
				zero on the surface.
			</p>

			<h3 class="text-xl mt-8 font-oxanium font-bold text-purple-300">
				Why TypeGPU?
			</h3>
			<p>
				<a href="https://docs.swmansion.com/TypeGPU/">TypeGPU</a> lets you write
				WebGPU pipelines in TypeScript. Familiarity with its basics will help
				you get started with Luxscura.
			</p>

			<h3 class="text-xl mt-8 font-oxanium font-bold text-purple-300">
				Further Reading
			</h3>
			<ul class="list-disc ml-6">
				<li>
					<a href="https://imadrahmoune.com/raymarching-explained-interactively/">
						Raymarching explained interactively
					</a>{' '}
					by Imad Rahmoune
				</li>
				<li>
					<a href="https://tutorials.tektite.studio/ray-marching/">
						Ray Marching: Signed Distance Fields, Sphere Tracing, and SDF
						Shading
					</a>{' '}
					from Tektite Studio
				</li>
				<li>
					<a href="https://iquilezles.org/articles/distfunctions/">
						3D distance functions
					</a>{' '}
					by Inigo Quilez
				</li>
			</ul>
		</div>
	)
}
