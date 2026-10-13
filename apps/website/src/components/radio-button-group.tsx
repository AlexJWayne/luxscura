export function RadioButtonGroup<Value extends string>({
	label,
	name,
	values,
	value,
	setValue,
}: {
	label: string
	name: string
	values: readonly Value[]
	value: Value
	setValue: (value: Value) => void
}) {
	return (
		<fieldset class="flow-root">
			<legend class="mb-2 text-sm text-gray-400 sm:float-left sm:mb-0 sm:mr-4 sm:w-28 sm:pt-2">
				{label}
			</legend>
			<div class="flex flex-wrap gap-2">
				{values.map((option) => (
					<label key={option} class="cursor-pointer">
						<input
							class="peer sr-only"
							type="radio"
							name={name}
							value={option}
							checked={value === option}
							onChange={() => setValue(option)}
						/>
						<span class="block rounded px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-brand-300/5 hover:text-gray-100 peer-checked:bg-brand-300/15 peer-checked:text-brand-100 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-brand-300">
							{option}
						</span>
					</label>
				))}
			</div>
		</fieldset>
	)
}
