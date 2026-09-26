# Luxscura

A TypeGPU ray marching renderer extracted from Plasma Planet.

Luxscura is currently in early development. Its package structure and public API
may change before the first release.

## Consumer setup

Luxscura requires TypeGPU. Applications that define TypeGPU functions in
JavaScript or TypeScript must also configure `unplugin-typegpu` for their build
tool. Luxscura itself ships pre-transformed JavaScript and does not require a
particular consumer bundler.

## Appearances

The core renderer and shared lighting helpers are available from `luxscura`.
Optional PBR shading is available from `luxscura/pbr`:

```ts
import {
  createRaymarchConstantLighting,
  createRaymarchProgram,
  createRaymarchRenderer,
} from 'luxscura'
import { createPbrAppearance, PbrMaterial } from 'luxscura/pbr'
```

Import shared lighting helpers and types from `luxscura`; appearance entry points
export only their appearance-specific APIs.

For simple lighting without shiny highlights, use `luxscura/matte`:

```ts
import { createRaymarchConstantLighting } from 'luxscura'
import { createMatteAppearance } from 'luxscura/matte'
import { vec3f } from 'typegpu/data'

const appearance = createMatteAppearance({
  color: () => {
    'use gpu'
    return vec3f(0.15, 0.5, 0.85)
  },
  lighting: createRaymarchConstantLighting({
    ambient: vec3f(0.08, 0.12, 0.2),
    directionalLights: [{
      direction: vec3f(-1, 1, -1), // Direction the light travels.
      color: vec3f(1, 0.9, 0.75),
      intensity: 0.8,
    }],
  }),
})
```

The color callback can vary the surface color using the raymarch result.
Ambient fill and directional light contributions are multiplied by that color;
all colors are linear RGB. Matte uses Lambert diffuse lighting and does not
require an environment callback.

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
