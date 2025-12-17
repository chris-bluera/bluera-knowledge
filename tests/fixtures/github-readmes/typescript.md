# TypeScript

[![CI](https://github.com/microsoft/TypeScript/actions/workflows/ci.yml/badge.svg)](https://github.com/microsoft/TypeScript/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/typescript.svg)](https://www.npmjs.com/package/typescript)
[![Downloads](https://img.shields.io/npm/dm/typescript.svg)](https://www.npmjs.com/package/typescript)

[TypeScript](https://www.typescriptlang.org/) is a language for application-scale JavaScript. TypeScript adds optional types to JavaScript that support tools for large-scale JavaScript applications for any browser, for any host, on any OS. TypeScript compiles to readable, standards-based JavaScript.

## Installing

For the latest stable version:

```bash
npm install -D typescript
```

For nightly builds:

```bash
npm install -D typescript@next
```

## Contribute

There are many ways to [contribute](https://github.com/microsoft/TypeScript/blob/main/CONTRIBUTING.md) to TypeScript.

* [Submit bugs](https://github.com/microsoft/TypeScript/issues) and help us verify fixes as they are checked in.
* Review the [source code changes](https://github.com/microsoft/TypeScript/pulls).
* Engage with other TypeScript users and developers on [StackOverflow](https://stackoverflow.com/questions/tagged/typescript).
* Help each other in the [TypeScript Community Discord](https://discord.gg/typescript).
* Join the [#typescript](https://twitter.com/search?q=%23TypeScript) discussion on Twitter.
* [Contribute bug fixes](https://github.com/microsoft/TypeScript/blob/main/CONTRIBUTING.md).

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).

## Documentation

* [Quick Start](https://www.typescriptlang.org/docs/handbook/typescript-from-scratch.html)
* [Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
* [TypeScript Website](https://www.typescriptlang.org/)

## Building

To build the TypeScript compiler, clone a copy of the repo:

```bash
git clone https://github.com/microsoft/TypeScript.git
```

Change to the TypeScript directory:

```bash
cd TypeScript
```

Install Jake tools and dev dependencies:

```bash
npm install -g jake
npm ci
```

Use one of the following to build and test:

```bash
jake local            # Build the compiler into built/local.
jake clean            # Delete the built compiler.
jake LKG              # Replace the last known good with the built one.
jake tests            # Build the test infrastructure using the built compiler.
jake runtests         # Run tests using the built compiler and test infrastructure.
jake baseline-accept  # This replaces the baseline test results with the results obtained from jake runtests.
jake lint             # Runs tslint on the TypeScript source.
jake help             # List the above commands.
```

## TypeScript Compiler Options

The TypeScript compiler accepts a number of command-line options. Common options include:

| Option | Description |
|--------|-------------|
| `--target` | Specify ECMAScript target version |
| `--module` | Specify module code generation |
| `--strict` | Enable all strict type-checking options |
| `--outDir` | Redirect output structure to the directory |
| `--declaration` | Generate corresponding `.d.ts` file |
| `--sourceMap` | Generate corresponding `.map` file |

For a full list, see the [compiler options documentation](https://www.typescriptlang.org/docs/handbook/compiler-options.html).

## Roadmap

For details on our planned features and future direction please refer to our [roadmap](https://github.com/microsoft/TypeScript/wiki/Roadmap).
