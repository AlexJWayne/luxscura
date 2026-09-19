# Luxscura

This repository is the home of Luxscura, a TypeGPU ray marching renderer.
It is organized as a Bun workspace so the publishable library and its future
website can keep independent dependencies and build configurations.

## Workspace

- `packages/luxscura` — the npm package
- `apps/website` — reserved for the future documentation and examples site

The website directory does not exist yet. When it is added, it will have its
own `package.json`; dependencies such as React and Tailwind will remain there
and will not be included in the Luxscura package manifest.

## Development

From the repository root:

```sh
bun install
bun run build
bun run test
bun run typecheck
bun run check
```

See [`packages/luxscura/README.md`](packages/luxscura/README.md) for package
usage and local linking instructions.
