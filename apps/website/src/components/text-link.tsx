import type { ComponentProps } from 'preact'

export function TextLink({
	class: classValue,
	className,
	...props
}: ComponentProps<'a'>) {
	return (
		<a
			{...props}
			class={[
				'text-brand-200 underline decoration-brand-300/40 underline-offset-4 hover:text-brand-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-300',
				classValue,
				className,
			]
				.filter(Boolean)
				.join(' ')}
		/>
	)
}
