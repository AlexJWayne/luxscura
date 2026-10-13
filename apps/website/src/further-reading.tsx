import type { ComponentChildren } from 'preact'
import { TextLink } from './components/text-link'

export function FurtherReading() {
	return (
		<footer class="mt-12 space-y-4 border-t border-brand-300/10 pt-8 text-base leading-relaxed">
			<h2 class="font-heading text-xl font-medium text-heading">
				Further reading
			</h2>
			<ul class="space-y-2">
				<ReferenceLink
					href="https://imadrahmoune.com/raymarching-explained-interactively/"
					attribution="Imad Rahmoune"
				>
					Raymarching explained interactively
				</ReferenceLink>
				<ReferenceLink
					href="https://tutorials.tektite.studio/ray-marching/"
					attribution="Tektite Studio"
				>
					Ray marching, sphere tracing, and SDF shading
				</ReferenceLink>
				<ReferenceLink
					href="https://iquilezles.org/articles/distfunctions/"
					attribution="Inigo Quilez"
				>
					3D distance functions
				</ReferenceLink>
			</ul>
		</footer>
	)
}

function ReferenceLink({
	href,
	attribution,
	children,
}: {
	href: string
	attribution: string
	children: ComponentChildren
}) {
	return (
		<li>
			<TextLink href={href}>{children}</TextLink>
			<span class="text-gray-400"> — {attribution}</span>
		</li>
	)
}
