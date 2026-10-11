# Luxscura

A TypeGPU ray marching renderer for custom WebGPU applications. Supply a camera,
geometry as a signed-distance function, and an appearance; Luxscura handles
ray marching, surface normals, depth, and drawing. Use it alongside your other
rendering pipelines, with your application's TypeGPU root and render attachments.

See the [website and interactive examples](https://alexjwayne.github.io/luxscura/).

⚠️ Luxscura is in early development; its public API may change.

## Setup

```sh
npm install luxscura typegpu
npm install --save-dev unplugin-typegpu
```

Configure TypeGPU's build plugin so GPU callbacks can compile from TypeScript:
[TypeGPU setup](https://docs.swmansion.com/TypeGPU/getting-started/) ·
[Build plugin](https://docs.swmansion.com/TypeGPU/tooling/unplugin-typegpu/).
Configuring `tsover` is highly recommended for operator overloading on vectors
and matrices in GPU callbacks, as used in the examples below. Follow the
[TypeGPU setup guide](https://docs.swmansion.com/TypeGPU/getting-started/) for configuration.

Your application needs a browser with WebGPU support.

## Quick start

A program combines a camera callback, a surface, and an appearance. The surface's
`sd` callback returns the signed distance at a world-space point; its `bounds`
callback provides an axis-aligned bounding box enclosing the surface. Marching
stops at the box's exit by default. GPU callbacks use `'use gpu'`.

This example uses `@typegpu/sdf` for a sphere.
`createCamera` belongs to your application; see [Camera](#camera) for an example.

```ts
import { sdSphere } from '@typegpu/sdf'
import {
  AABB,
  createRaymarchConstantLighting,
  createRaymarchProgram,
  createRaymarchRenderer,
  RaymarchCamera,
} from 'luxscura'
import { createMatteAppearance } from 'luxscura/matte'
import { vec3f, vec4f } from 'typegpu/data'

// A canvas with its drawing-buffer width and height already set.
const camera = createCamera(canvas)
const lighting = createRaymarchConstantLighting({
  ambient: vec3f(0.2),
  directionalLights: [{
    direction: vec3f(-1, 1, -1),
    color: vec3f(1, 0.9, 0.75),
    intensity: 1,
  }],
})

const program = createRaymarchProgram({
  options: { epsilon: 0.001 },
  camera: () => {
    'use gpu'
    return RaymarchCamera({
      position: camera.position,
      viewProjectionMatrix: camera.viewProjectionMatrix,
    })
  },
  surface: {
    bounds: () => {
      'use gpu'
      return AABB({ min: vec3f(-1.01), max: vec3f(1.01) })
    },
    sd: (point) => {
      'use gpu'
      return sdSphere(point, 1)
    },
  },
  appearance: createMatteAppearance({
    color: () => {
      'use gpu'
      return vec4f(0.15, 0.5, 0.85, 1)
    },
    lighting,
  }),
})

// Use your application's existing TypeGPU root.
const render = createRaymarchRenderer({ root, program })
render({
  colorAttachment: { view: canvasContext },
  depthStencilAttachment: { view: depthTexture },
})
```

The application owns render targets and scheduling. Call `render` from your render
loop when needed. A depth attachment is required, with format `depth24plus` by
default. Use `renderTarget` when creating the renderer to specify a different
color format, depth format, or sample count matching your attachments.

<details>
<summary>Standalone root and attachment setup</summary>

Run this before the quick start, with a sized `<canvas id="canvas">`:

```ts
import { tgpu } from 'typegpu'

const canvas = document.getElementById('canvas') as HTMLCanvasElement
const root = await tgpu.init()
const canvasContext = root.configureContext({ canvas })
const depthTexture = root
  .createTexture({
    size: [canvas.width, canvas.height],
    format: 'depth24plus',
  })
  .$usage('render')
```

When resizing, recreate the depth texture to match the canvas and update the
camera's aspect ratio. When disposing the application, stop its render loop and
release its resources (`root.destroy()` when the root is no longer needed).

</details>

## Camera

Your application owns the camera, its controls, and its matrices. Luxscura only
needs a GPU callback returning its world-space `position` and
`viewProjectionMatrix`, using WebGPU's depth range of 0–1. Adapt your existing
perspective camera to those two fields. For a moving camera, the callback can read
a TypeGPU buffer that your application updates, without rebuilding the rendering
pipeline.

Here is one way to create a fixed perspective camera using `wgpu-matrix`:

```ts
import { mat4x4f, vec3f } from 'typegpu/data'
import { mat4 } from 'wgpu-matrix'

function createCamera({ width, height }: HTMLCanvasElement) {
  const position = vec3f(0, -3, 0)
  const projection = mat4.perspective(Math.PI / 4, width / height, 0.1, 10)
  const view = mat4.lookAt(position, vec3f(0), vec3f(0, 0, 1))
  const viewProjectionMatrix = mat4x4f()
  mat4.multiply(projection, view, viewProjectionMatrix)
  return { position, viewProjectionMatrix }
}
```

## Appearances

### Custom appearances

Supply an appearance callback directly to control surface shading. It receives
a `RaymarchResult`, including world-space `position`, `normal`, `rayDirection`,
and `instanceIndex`, so appearance can vary across a surface:

```ts
import type { RaymarchAppearance } from 'luxscura'

const appearance: RaymarchAppearance = (result) => {
  'use gpu'
  return vec4f(result.normal * 0.5 + vec3f(0.5), 1)
}
```

A custom appearance returns unpremultiplied linear RGB and opacity (alpha in
0–1). Appearance and material/color sampling callbacks run on both hits and
misses; the renderer only uses color on hits. Keep derivative-dependent sampling
outside hit-dependent branches. Surface hits write depth by default, even with
zero opacity; use `depthWriteEnabled: false` when appropriate for your rendering
setup.

### Built-in appearances

Built-in appearances provide color or material callbacks that receive the same
`RaymarchResult`. They share ambient and directional lighting. Light `direction`
is the world-space direction the light travels. All color and lighting values
use linear RGB.

| Appearance | Import | Inputs |
| --- | --- | --- |
| Matte — diffuse lighting | `luxscura/matte` | Color callback and lighting |
| Glossy — adjustable shiny highlights | `luxscura/glossy` | Material callback and lighting |
| PBR (experimental) — metallic/roughness shading and environment reflections | `luxscura/pbr` | Material callback, lighting, and environment callback |

The quick start uses matte. To use glossy, replace its `appearance` with:

```ts
import { createGlossyAppearance, GlossyMaterial } from 'luxscura/glossy'

const appearance = createGlossyAppearance({
  material: (result) => {
    'use gpu'
    return GlossyMaterial({
      baseColor: vec3f(0.15, 0.5, 0.85),
      specular: vec3f(1),
      shininess: 128,
      emission: vec3f(0),
      opacity: 1,
    })
  },
  lighting,
})
```

`specular` sets highlight color and strength; `shininess` sets highlight tightness
(at least 1). `emission` adds color independently of lighting.

### PBR (experimental)

PBR's API and visual results are still being refined. Its `metallic` and
`roughness` values range from 0 to 1. The required `environment` callback supplies
incoming linear RGB for a reflection direction and roughness; it can return a
procedural color or sample an environment texture.
The caller should use `roughness` to blur the reflection, choosing a filtering
method appropriate for their environment.
This approach is still experimental and somewhat awkward; it is likely to
change in future releases.

```ts
import { createPbrAppearance, PbrMaterial } from 'luxscura/pbr'

const appearance = createPbrAppearance({
  material: (result) => {
    'use gpu'
    return PbrMaterial({
      baseColor: vec3f(0.85, 0.9, 1),
      metallic: 0.5,
      roughness: 0.2,
      emission: vec3f(0),
      opacity: 1,
    })
  },
  lighting,
  environment: (direction, roughness) => {
    'use gpu'
    return vec3f(0.12, 0.35, 0.65)
  },
})
```

## API

### Program — `createRaymarchProgram`

A program describes what to render. `createRaymarchProgram` stores the GPU
callbacks and compilation options in a versioned `RaymarchProgramDefinition`;
it does not allocate GPU resources. Pass that definition to a renderer.

Using named GPU callbacks keeps the call small (their implementations follow the
same pattern as the quick start):

```ts
const program = createRaymarchProgram({
  camera: getCamera,
  surface: {
    bounds: getBounds,
    sd: distanceToSurface,
  },
  appearance: shadeSurface,
  options: {
    epsilon: 0.001,
    maxSteps: 150,
    stepScale: 0.8,
  },
})
```

The property paths below follow the nesting in the call above. Callback types
include argument and return types; `v3f` and `v4f` are TypeGPU float vector types
from `typegpu/data`. Values in `options` are used when compiling the pipeline.

#### `camera`

| Type | Default |
| --- | --- |
| `() => RaymarchCamera` | Required |

Returns the current `RaymarchCamera`: world-space position and view-projection matrix.

#### `surface`

| Type | Default |
| --- | --- |
| `RaymarchSurface` | Required |

Supplies geometry, bounds, and optional per-fragment initialization and visibility.

#### `surface.bounds`

| Type | Default |
| --- | --- |
| `(instanceIndex: number) => AABB` | Required |

Returns the instance's world-space `AABB`, which determines the area rasterized and
normally limits marching.

#### `surface.sd`

| Type | Default |
| --- | --- |
| `(point: v3f, instanceIndex: number, bounds: AABB) => number` | Required |

Returns the signed distance to the surface from a world-space point. Also used to
estimate normals.

#### `surface.init`

| Type | Default |
| --- | --- |
| `(instanceIndex: number) => void` | None |

Initializes per-fragment state before visibility testing and marching.
If omitted, no initialization callback runs.

#### `surface.isRayVisible`

| Type | Default |
| --- | --- |
| `(point: v3f, instanceIndex: number, bounds: AABB) => boolean` | None |

Returns false to discard a fragment before marching. The point is on the rasterized
bounding box.
If omitted, all rasterized fragments are eligible for marching.

#### `appearance`

| Type | Default |
| --- | --- |
| `(result: RaymarchResult) => v4f` | Required |

Returns linear RGBA after marching. See [Appearances](#appearances).

#### `options`

| Type | Default |
| --- | --- |
| `RaymarchProgramOptions` | Required |

Controls marching and depth behavior.

#### `options.label`

| Type | Default |
| --- | --- |
| `string` | None |

Diagnostic metadata for your application; unused by the renderer.
If omitted, the program has no label.

#### `options.epsilon`

| Type | Default |
| --- | --- |
| `number` | Required |

Surface hit tolerance in world units. Smaller values give a tighter tolerance but may
require more steps.

#### `options.epsilonNormal`

| Type | Default |
| --- | --- |
| `number` | None |

Offset in world units used to sample the distance function for surface normals. Adjust
separately when normal detail needs a different scale.
If omitted, normal sampling uses `options.epsilon`.

#### `options.maxSteps`

| Type | Default |
| --- | --- |
| `number` | `100` |

Maximum marching iterations per ray. Marching stops without a hit if this limit is reached.

#### `options.stepScale`

| Type | Default |
| --- | --- |
| `number` | `1` |

Multiplies each distance-based step. A value between 0 and 1 may be necessary when
your distance function overestimates the distance to the surface, for example after
coordinate-space warping or when using an approximate SDF. Smaller steps help avoid
stepping past the surface, at the cost of more marching iterations.

#### `options.maxDistance`

| Type | Default |
| --- | --- |
| `number` | None |

If present, applies an additional maximum marching distance from the bounding-box
entry point, in world units. If absent, rays stop marching at the bounds. With
`options.marchBeyondBounds: true`, this value is required and replaces the bounds
exit limit.

#### `options.marchBeyondBounds`

| Type | Default |
| --- | --- |
| `boolean` | `false` |

Allows marching past the box exit; requires an explicit `options.maxDistance` when true.
This extends the march along existing rays; the bounding box still controls which pixels
are rasterized.

#### `options.depthWriteEnabled`

| Type | Default |
| --- | --- |
| `boolean` | `true` |

Writes surface hit depth, allowing other pipelines to share depth with raymarched
geometry. Disable when your rendering setup needs depth testing without writes.

#### `options.depthCompare`

| Type | Default |
| --- | --- |
| `GPUCompareFunction` | `'less'` |

WebGPU depth comparison used to test surface hits against the depth attachment. Match
your application's depth convention.

### Renderer — `createRaymarchRenderer`

A renderer compiles a program into a GPU pipeline and returns a draw function.
Its configuration connects that program to your application's GPU resources.

Pass the `program` from above here. This example specifies the render target settings;
the preparation hooks simply return their inputs to show where they belong:

```ts
const render = createRaymarchRenderer({
  root,
  program,
  renderTarget: {
    colorFormat: navigator.gpu.getPreferredCanvasFormat(),
    depthStencilFormat: 'depth24plus',
    sampleCount: 1,
  },
  prepare: (body) => body, // Optionally adapt the program callbacks.
  preparePipeline: (pipeline) => pipeline, // Optionally attach performance monitoring.
})
```

#### `root`

| Type | Default |
| --- | --- |
| `TgpuRoot` | Required |

Your application's TypeGPU root, used to create the pipeline.

#### `program`

| Type | Default |
| --- | --- |
| `Readonly<RaymarchProgramDefinition>` | Required |

The definition returned by `createRaymarchProgram`.

#### `renderTarget`

| Type | Default |
| --- | --- |
| `Readonly<RaymarchRenderTargetOptions>` | None |

Attachment formats and sample count used for pipeline compatibility. They must match the
attachments used when drawing.
If omitted, the pipeline uses the preferred canvas color format, `'depth24plus'`,
and one sample per pixel.

#### `renderTarget.colorFormat`

| Type | Default |
| --- | --- |
| `GPUTextureFormat` | `navigator.gpu.getPreferredCanvasFormat()` |

Color attachment format. Set explicitly for targets using another format.

#### `renderTarget.depthStencilFormat`

| Type | Default |
| --- | --- |
| ``Extract<GPUTextureFormat, `depth${string}`>`` | `'depth24plus'` |

Depth/stencil attachment format. A depth attachment is always required.

#### `renderTarget.sampleCount`

| Type | Default |
| --- | --- |
| `1 \| 4` | `1` |

Samples per pixel: `1` or `4`. Use `4` with matching multisampled attachments and a
color resolve target.

#### `prepare`

| Type | Default |
| --- | --- |
| `(program: RaymarchProgram) => RaymarchProgram` | None |

Transforms the camera, surface, or appearance callbacks before compilation. Return the
resulting `RaymarchProgram`, for example to adapt callbacks to application resources.

#### `preparePipeline`

| Type | Default |
| --- | --- |
| `(pipeline: TgpuRenderPipeline<{ color: Vec4f }>) => TgpuRenderPipeline<{ color: Vec4f }>` | None |

Transforms the created TypeGPU pipeline before it is captured for drawing. Return the
resulting pipeline. For example, attach GPU performance monitoring with
`pipeline.withPerformanceCallback(...)`. This requires enabling the `timestamp-query`
device feature; see TypeGPU's [Timing Your Pipelines guide](https://docs.swmansion.com/TypeGPU/advanced/timestamp-queries/).

`TgpuRenderPipeline` comes from `typegpu`; `Vec4f` is the vector schema type from
`typegpu/data`. Both preparation hooks run during initial creation and again when
a program version change triggers recompilation. They do not run on every frame.

### Draw — `render(options)`

Call the returned function whenever your application needs to submit a raymarch
draw. It uses TypeGPU attachment descriptors, so you can configure clearing,
loading, and storage to fit the surrounding rendering passes.

Call `render` from above in your application's render loop, supplying attachments
that match its `renderTarget` configuration:

```ts
render({
  colorAttachment: { view: colorTexture }, // Uses the preferred canvas format.
  depthStencilAttachment: { view: depthTexture }, // depth24plus.
  instances: 5,
})
```

#### `colorAttachment`

| Type | Default |
| --- | --- |
| `ColorAttachment` | Required |

TypeGPU color attachment descriptor: the target view and its load/store settings.

#### `depthStencilAttachment`

| Type | Default |
| --- | --- |
| `DepthStencilAttachment` | Required |

TypeGPU depth/stencil attachment descriptor: the depth view and its load/store settings.
Required because Luxscura is designed to work alongside other pipelines in a TypeGPU
application. Sharing a depth buffer lets raymarched surfaces and other rendered objects
occlude one another according to their depth.

#### `instances`

| Type | Default |
| --- | --- |
| `number` | `1` |

Number of bounds instances to draw. The instance index lets your callbacks look up
per-instance values in a GPU buffer to change how the program renders that instance.

## Hot module reloading

If shader edits cause a full page reload or do not update the renderer, enable
Luxscura's hot reload support. With Vite, pass `import.meta.hot` as the second
argument to `createRaymarchProgram` and call `import.meta.hot?.accept()`:

```ts
const program = createRaymarchProgram({
  options: { epsilon: 0.001 },
  camera,
  surface,
  appearance,
}, import.meta.hot)

import.meta.hot?.accept()
```

On a module update, Luxscura preserves the program definition and increments its
version. The existing renderer rebuilds its pipeline on the next draw using the
updated callbacks and options.

Currently, only one HMR-backed program can be defined per module.
