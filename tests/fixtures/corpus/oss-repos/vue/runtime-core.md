# Vue Runtime Core

## Overview

`@vue/runtime-core` is the platform-agnostic runtime core of Vue. It includes:
- Virtual DOM renderer
- Component implementation
- JavaScript APIs

This package is used for building custom renderers targeting different platforms.

## Building a Custom Renderer

```ts
import { createRenderer } from '@vue/runtime-core'

const { render, createApp } = createRenderer({
  patchProp,
  insert,
  remove,
  createElement,
  createText,
  setText,
  setElementText,
  parentNode,
  nextSibling,
})

// `render` is the low-level API
// `createApp` returns an app instance with configurable context

export { render, createApp }
export * from '@vue/runtime-core'
```

## Renderer Options

When creating a custom renderer, implement these node operations:

```ts
interface RendererOptions<Node, Element> {
  // Prop patching
  patchProp(el: Element, key: string, prevValue: any, nextValue: any): void

  // Node operations
  insert(el: Node, parent: Element, anchor?: Node | null): void
  remove(el: Node): void
  createElement(type: string): Element
  createText(text: string): Node
  createComment(text: string): Node
  setText(node: Node, text: string): void
  setElementText(node: Element, text: string): void

  // Tree traversal
  parentNode(node: Node): Element | null
  nextSibling(node: Node): Node | null
  querySelector?(selector: string): Element | null
}
```

## Component Lifecycle

Vue components go through these lifecycle phases:

1. **Setup**: Composition API setup runs
2. **beforeMount**: Before DOM insertion
3. **mounted**: After DOM insertion
4. **beforeUpdate**: Before reactive update
5. **updated**: After reactive update
6. **beforeUnmount**: Before removal
7. **unmounted**: After removal

```js
import { onMounted, onUpdated, onUnmounted } from 'vue'

export default {
  setup() {
    onMounted(() => console.log('mounted'))
    onUpdated(() => console.log('updated'))
    onUnmounted(() => console.log('unmounted'))
  }
}
```

## Virtual DOM

Vue uses a virtual DOM for efficient updates:

```js
import { h } from 'vue'

// Create virtual nodes
const vnode = h('div', { class: 'container' }, [
  h('h1', 'Title'),
  h('p', 'Content')
])
```

### VNode Types

- **Element**: Regular DOM elements (`h('div')`)
- **Component**: Vue components (`h(MyComponent)`)
- **Text**: Text nodes (`h(Text, 'hello')`)
- **Fragment**: Multiple root nodes (`h(Fragment, [child1, child2])`)
- **Teleport**: Portal content (`h(Teleport, { to: 'body' }, content)`)
- **Suspense**: Async dependencies (`h(Suspense, slots)`)

## Provide/Inject

For dependency injection across components:

```js
// Parent component
import { provide } from 'vue'

export default {
  setup() {
    provide('theme', 'dark')
  }
}

// Child component (any depth)
import { inject } from 'vue'

export default {
  setup() {
    const theme = inject('theme', 'light') // default: 'light'
    return { theme }
  }
}
```

## Slots

Handle component slots programmatically:

```js
import { h, useSlots } from 'vue'

export default {
  setup() {
    const slots = useSlots()

    return () => h('div', [
      slots.header?.(),
      slots.default?.(),
      slots.footer?.()
    ])
  }
}
```

## Note

This package is published only for typing and building custom renderers. It is NOT meant to be used directly in applications. Use `vue` or `@vue/runtime-dom` instead.
