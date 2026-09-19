import { render } from 'preact'
import './index.css'

function App() {
	return (
		<main class="grid min-h-screen place-items-center bg-slate-950 text-slate-50">
			<h1 class="text-4xl font-bold tracking-tight">Hello World</h1>
		</main>
	)
}

const root = document.getElementById('app')

if (!root) {
	throw new Error('App root not found')
}

render(<App />, root)
