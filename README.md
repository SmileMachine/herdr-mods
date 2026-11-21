# Herdr Mods

A collection of mods for [Herdr](https://herdr.dev/).

## Mods

- [Port Manager](port-manager/): discover TCP listeners across spaces and manage SSH port forwards.

Each mod lives in its own directory. Its `mods/` directory mirrors the Herdr configuration directory; see its recipe and README for setup, behavior, and limitations.

## Development

Run `npm test` from the repository root. The current suite contains host-side tests for Port Manager; it does not replace testing in Herdr.

## Sharing

Herdr's gallery guidance calls for a public GitHub repository with the `herdr-mod` topic, plus a `RECIPE.md` and a screenshot named `preview.png` in each mod's directory. Port Manager still needs a real screenshot before it is ready for gallery submission. Publishing the repository and adding its topic are separate steps.
