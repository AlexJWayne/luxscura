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

## Website deployment

Install the GitHub CLI and sign in with `gh auth login`. Commit and push the
website changes and the deployment workflow to `main`, then run:

```sh
bun run deploy
```

This manually starts the GitHub Pages workflow using the latest `main` commit
on GitHub. The command does not push local commits or publish the npm package.
Deployments only run when requested; pushing changes does not deploy the website.
You can also run the workflow from GitHub's Actions tab. Monitor deployment
progress there or with `gh run list --workflow deploy-pages.yml`.

In GitHub settings, Pages must use GitHub Actions as its source, and the
`github-pages` environment must allow deployments from `main`.
