# Luxscura

A TypeGPU ray marching renderer extracted from Plasma Planet.

Luxscura is currently in early development. Its package structure and public API
may change before the first release.

## Consumer setup

Luxscura requires TypeGPU. Applications that define TypeGPU functions in
JavaScript or TypeScript must also configure `unplugin-typegpu` for their build
tool. Luxscura itself ships pre-transformed JavaScript and does not require a
particular consumer bundler.

## Development

Install dependencies and build the package:

```sh
bun install
bun run build
```

Run the tests and typecheck:

```sh
bun test
bun run typecheck
```

## Local linking

Register Luxscura from this directory:

```sh
bun link
```

Then link it from the consuming project:

```sh
bun link luxscura
```

Run `bun run build` after changing Luxscura so the linked package receives fresh
JavaScript and declarations.

When linking into a Vite application, configure `resolve.dedupe` for `typegpu`
if Vite resolves a second TypeGPU installation from Luxscura's development
dependencies.
