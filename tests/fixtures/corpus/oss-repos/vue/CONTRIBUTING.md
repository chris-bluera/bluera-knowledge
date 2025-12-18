# Vue.js Contributing Guide

## Issue Reporting Guidelines

Always use https://new-issue.vuejs.org/ to create new issues.

## Pull Request Guidelines

### What kinds of Pull Requests are accepted?

- **Bug fix** that addresses a clearly identified bug with proper reproduction
- **New feature** that addresses a widely applicable use case
- **Chore**: typos, comment improvements, build config, CI config

### Important Notes

- We discourage contributors from submitting code refactors that are largely stylistic
- Code readability is subjective - respect established conventions when contributing

### Pull Request Checklist

- Vue core has two primary work branches: `main` and `minor`
- Feature PRs with new API surface should target `minor` branch
- Bug fixes should target `main` branch
- Make sure to tick "Allow edits from maintainers"
- Add accompanying test cases for new features
- Provide detailed bug descriptions with live demos when possible

### Advanced Tips

- PRs should fix only the intended bug without unrelated changes
- Consider performance and bundle size impact
- Put dev-only code in `__DEV__` branches for tree-shaking
- Runtime code is more sensitive to size than compiler code

## Development Setup

Requirements:
- Node.js (version specified in `.node-version`)
- PNPM (version specified in `package.json`)

```bash
$ pnpm i # install dependencies
```

### Tools Used

- TypeScript for development
- Vite and ESBuild for development bundling
- Rollup for production bundling
- Vitest for unit testing
- Prettier for code formatting
- ESLint for static error prevention

## Project Structure

The monorepo contains these packages under `packages/`:

- **reactivity**: Standalone reactivity system
- **runtime-core**: Platform-agnostic runtime core with virtual DOM renderer
- **runtime-dom**: Browser-targeting runtime with native DOM handling
- **runtime-test**: Lightweight runtime for testing
- **server-renderer**: Server-side rendering package
- **compiler-core**: Platform-agnostic compiler core
- **compiler-dom**: Browser-targeting compiler plugins
- **compiler-sfc**: Single File Component compilation utilities
- **compiler-ssr**: SSR-optimized render function compiler
- **shared**: Internal utilities shared across packages
- **vue**: The public "full build" with runtime AND compiler

### Package Dependencies

```
Runtime: runtime-dom -> runtime-core -> reactivity
Compiler: compiler-sfc -> compiler-dom -> compiler-core
Vue: vue -> compiler-dom + runtime-dom
```

## Scripts

- `nr build` - Build all public packages
- `nr dev` - Watch mode development build
- `nr test` - Run unit tests with Vitest
- `nr check` - Type check the entire codebase
- `nr build-dts` - Build type declarations

## Contributing Tests

- Unit tests are in `__tests__` directories
- Use minimal API needed for test cases
- Use `@vue/runtime-test` for platform-agnostic tests
- Test coverage deployed at https://coverage.vuejs.org
