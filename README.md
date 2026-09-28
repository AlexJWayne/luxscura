# Luxscura

This repository is the home of Luxscura, a TypeGPU ray marching renderer.
It is organized as a Bun workspace so the publishable library and website can
keep independent dependencies and build configurations.

## Workspace

- `packages/luxscura` — the npm package
- `apps/website` — the website and interactive examples

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
