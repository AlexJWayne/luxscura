import type { TgpuRoot } from 'typegpu'
import { createRaymarchProgram, type RaymarchProgram } from '../src/program'
import { createRaymarchRenderer } from '../src/renderer'

// Compiled by tsc, never invoked: invalid calls must remain type errors.
export function checkRendererContextTypes(
	root: TgpuRoot,
	body: RaymarchProgram,
) {
	const options = { epsilon: 0.001 }
	const direct = createRaymarchProgram({ ...body, options })
	createRaymarchRenderer({ root, program: direct })
	const independent = createRaymarchProgram(options, () => body)
	createRaymarchRenderer({ root, program: independent })
	const dependent = createRaymarchProgram(
		options,
		(context: { radius: number }) => {
			void context.radius
			return body
		},
	)
	createRaymarchRenderer({ root, program: dependent, context: { radius: 1 } })
	// @ts-expect-error The program requires context.
	createRaymarchRenderer({ root, program: dependent })
	// @ts-expect-error Required context cannot be undefined.
	createRaymarchRenderer({ root, program: dependent, context: undefined })
	// @ts-expect-error The required radius dependency is missing.
	createRaymarchRenderer({ root, program: dependent, context: {} })
	createRaymarchRenderer({
		root,
		program: dependent,
		// @ts-expect-error Context must match the program, not widen its requirements.
		context: { radius: 'large' },
	})
}
