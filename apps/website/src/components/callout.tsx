import type { ComponentChildren } from 'preact'

export function Callout({
	title,
	children,
}: {
	title: string
	children: ComponentChildren
}) {
	return (
		<div class="space-y-2 text-base leading-relaxed">
			<h3 class="font-oxanium text-xl font-medium text-heading">{title}</h3>
			<p>{children}</p>
		</div>
	)
}
