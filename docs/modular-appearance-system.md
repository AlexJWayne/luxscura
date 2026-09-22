# Modular Appearance System

> [!NOTE]
> This document records an idea worth exploring. It is not a proposed final
> interface, an implementation plan, or a commitment to any particular set of
> lighting or appearance models. The names and TypeScript examples below are
> illustrative only.

## Motivation

Luxscura currently combines two distinct jobs in a ray-marching program:

1. Finding the surface hit and its geometric properties.
2. Turning that hit into a pixel color.

The current renderer performs metallic/roughness PBR shading after a hit. That
model looks good, but it is only one of many useful ways to render an SDF
surface. A consuming project might instead want Phong-style lighting, flat or
unlit color, toon shading, a matcap, a debug visualization, or an entirely
custom effect.

An embeddable renderer should make the existing appearance easy to use without
making it the definition of what a ray-marched surface is.

## The conceptual handoff

Ray marching is complete once the renderer has found the surface and derived
the geometric information needed for shading. Appearance begins after that
point:

```text
camera + surface
       |
       v
bounds rendering -> ray march -> surface position -> surface normal
                                                        |
                                                        v
                                                   appearance
                                                        |
                                                        v
                                                     color
```

Position and normal form the essential handoff. Other information may also be
useful, such as the camera position, view direction, instance index, or surface
bounds, but the interface should expose only information that appearances
actually need.

Depth remains owned by the renderer. This allows independently compiled
ray-marching pipelines to compose through the same depth buffer regardless of
how each pipeline calculates color.

## Possible program structure

A ray-marching program could conceptually compose three modules:

- **Camera**: information used to construct rays and project hit depth.
- **Surface**: bounds, the signed distance function, visibility, and any
  per-fragment initialization needed to find a hit.
- **Appearance**: a TypeGPU function that turns the hit context into color.

Illustrative only:

```ts
interface RaymarchProgram {
  camera: () => RaymarchCamera
  surface: RaymarchSurface
  appearance: RaymarchAppearance
}

interface RaymarchSurface {
  init?: RaymarchInitializer
  bounds: RaymarchBoundsProvider
  isRayVisible?: RaymarchVisibilityTest
  sd: RaymarchDistanceFunction
}

type RaymarchAppearance = (
  context: RaymarchAppearanceContext,
) => v3f
```

The renderer would know only the common appearance interface. It would not
know which lighting equations, material representation, textures, uniforms, or
other resources an appearance uses.

## Appearance factories

Built-in appearance models could be factories that accept model-specific
configuration and return the common TypeGPU appearance function.

For example, a PBR appearance might be configured with a PBR material sampler,
lights, and an environment function. A Phong-style appearance might instead
accept diffuse, specular, and shininess inputs. A toon appearance might accept
a color sampler and ramp or band configuration.

Conceptually:

```ts
const appearance = createPbrAppearance({
  sampleMaterial,
  lighting,
  environment,
})
```

The callbacks and parameters accepted by each factory do not need to match.
Only the function returned by the factory must satisfy the renderer's common
appearance interface. The selected implementation would be captured when the
render pipeline is built, allowing TypeGPU to compile it into that pipeline
without a per-fragment switch between appearance models.

The exact built-in appearances have not been chosen. PBR, Phong, unlit, toon,
and matcap are useful examples for evaluating the design, not a proposed
support matrix.

## Materials belong to appearances

The shape of a material is inherently connected to the surface-response model
that consumes it:

- A metallic/roughness PBR model has concepts such as base color, metallic,
  roughness, and emission.
- A Phong model might use diffuse color, specular color, and shininess.
- An unlit model may need only a color.
- A procedural or debug appearance may need no material value at all.

Consequently, the current `RaymarchMaterial` is more accurately a PBR material
than a universal ray-marching material. A generic renderer interface should not
require every appearance to produce that structure.

An appearance factory may internally separate material sampling from lighting,
and it may define a material type specific to that implementation. Those
details can remain inside the appearance module. A custom appearance could
skip the material abstraction and calculate color directly from the hit context
and any TypeGPU resources captured by its function.

## Custom appearances

Consumers should be able to supply the same kind of TypeGPU function returned
by a built-in appearance factory. It would receive the same rendering context
available to built-in appearances and return the color for the hit.

Illustrative only:

```ts
const normalVisualization = ({ normal }: RaymarchAppearanceContext) => {
  'use gpu'
  return normal * 0.5 + 0.5
}
```

A `createCustomAppearance` helper may be useful for inference, validation, or
naming, but it should not add ceremony if a compatible TypeGPU function can be
accepted directly.

## Derivative uniformity

There is an important implementation constraint in the current renderer:
material sampling happens in uniform control flow so that a surface sampler may
use screen-space derivatives such as `fwidth`.

Calling an arbitrary appearance only inside a divergent `if (hit)` branch could
make derivative-based sampling invalid. Any design exploration must preserve
this capability.

Possible approaches include:

- Invoke the appearance function in uniform control flow, give it the hit
  state, and use its result only for actual hits. An appearance can perform any
  derivative-dependent sampling before conditionally doing expensive shading.
- Represent an appearance internally as separate sampling and shading
  operations. Sampling remains uniform, while shading runs only for hits. This
  internal seam does not necessarily need to be exposed as the primary
  consumer-facing interface.

The choice should be informed by generated WGSL, performance, TypeGPU's typing
constraints, and how much complexity it places on custom appearance authors.

## Design goals to evaluate

This direction is promising if it can provide the following:

- Ray marching, normal calculation, depth output, and draw submission remain
  centralized in the renderer.
- A program can select an appearance without paying GPU cost for unused
  appearance implementations.
- Built-in appearances hide their substantial math behind small configuration
  interfaces.
- Material structures remain local to the appearance models that understand
  them.
- A custom appearance has enough hit context to implement genuinely different
  rendering styles without forking the renderer.
- The design preserves derivative-safe surface sampling.
- Multiple ray-marching pipelines using different appearances continue to
  compose through shared color and depth attachments.

## Open questions

- What is the smallest useful appearance context?
- Should the context contain camera position, view direction, or the complete
  camera value?
- Do instance index and bounds belong in the common context, or should
  appearance-specific samplers capture everything they need?
- Should normal calculation always belong to the renderer, or may a surface
  override it?
- Should the public appearance interface be one function, or should sampling
  and shading be explicit operations?
- Can appearance-specific sample types be expressed ergonomically through
  TypeScript and TypeGPU without leaking complex generics into program setup?
- Should appearances currently return linear RGB only, or will the renderer
  eventually need other outputs such as opacity or multiple render targets?
- Which minimal set of contrasting appearance adapters would best validate that
  the seam is real?

## Non-decisions

This exploration does not yet decide:

- The final names or TypeScript interfaces.
- Whether `surface` and `appearance` are nested objects or remain flat program
  properties.
- Which built-in lighting or appearance models Luxscura will ship.
- The exact material schema for any built-in model.
- Whether transparency, deferred rendering, or multiple render targets belong
  in the appearance interface.
- How existing programs would migrate.

The immediate value of this idea is the separation itself: a surface describes
where geometry exists, while an appearance describes how a discovered surface
becomes color.
