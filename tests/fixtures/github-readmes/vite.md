# Vite ⚡

> Next Generation Frontend Tooling

- 💡 Instant Server Start
- ⚡️ Lightning Fast HMR
- 🛠️ Rich Features
- 📦 Optimized Build
- 🔩 Universal Plugin Interface
- 🔑 Fully Typed APIs

Vite (French word for "quick", pronounced `/vit/`, like "veet") is a new breed of frontend build tool that significantly improves the frontend development experience.

## Overview

Vite consists of two major parts:

- A dev server that provides [rich feature enhancements](https://vite.dev/guide/features.html) over [native ES modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), for example extremely fast [Hot Module Replacement (HMR)](https://vite.dev/guide/features.html#hot-module-replacement).

- A build command that bundles your code with [Rollup](https://rollupjs.org), pre-configured to output highly optimized static assets for production.

Vite is opinionated and comes with sensible defaults out of the box. Read about what's possible in the [Features Guide](https://vite.dev/guide/features.html). Support for frameworks or integration with other tools is possible through [Plugins](https://vite.dev/guide/using-plugins.html). The [Config Section](https://vite.dev/config/) explains how to adapt Vite to your project if needed.

## Getting Started

Try Vite online on [StackBlitz](https://vite.new/). Select a template and start coding in seconds.

Create a new Vite project with one of the supported templates:

```bash
# npm 7+
npm create vite@latest my-app -- --template react

# yarn
yarn create vite my-app --template react

# pnpm
pnpm create vite my-app --template react
```

Supported templates: `vanilla`, `vanilla-ts`, `vue`, `vue-ts`, `react`, `react-ts`, `react-swc`, `react-swc-ts`, `preact`, `preact-ts`, `lit`, `lit-ts`, `svelte`, `svelte-ts`, `solid`, `solid-ts`, `qwik`, `qwik-ts`

## Documentation

- [Guide](https://vite.dev/guide/)
- [Config Reference](https://vite.dev/config/)
- [Plugin API](https://vite.dev/guide/api-plugin.html)

## Browser Support

The default build targets browsers that support [native ESM via script tag](https://caniuse.com/es6-module), [native ESM dynamic import](https://caniuse.com/es6-module-dynamic-import), and [`import.meta`](https://caniuse.com/mdn-javascript_operators_import_meta). Legacy browsers can be supported via the official [@vitejs/plugin-legacy](https://github.com/vitejs/vite/tree/main/packages/plugin-legacy).

## Migrating from Other Tools

### From Webpack

If you're migrating from webpack, check out the [Vite migration guide](https://vite.dev/guide/migration.html) for tips on how to migrate your project.

### From Create React App

Vite can be used as a drop-in replacement for Create React App. Update your `package.json` scripts and install Vite dependencies:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

## Contributing

See [Contributing Guide](https://github.com/vitejs/vite/blob/main/CONTRIBUTING.md).

## License

[MIT](https://github.com/vitejs/vite/blob/main/LICENSE)
