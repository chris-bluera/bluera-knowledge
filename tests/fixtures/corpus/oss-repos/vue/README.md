# vuejs/core

Vue.js is a progressive JavaScript framework for building user interfaces.

## Getting Started

Please follow the documentation at [vuejs.org](https://vuejs.org/)!

## Key Features

- **Reactive Data Binding**: Automatically updates the DOM when data changes
- **Component-Based**: Build encapsulated components that manage their own state
- **Virtual DOM**: Efficient rendering with minimal DOM operations
- **Single-File Components**: Combine template, script, and styles in one file

## Quick Example

```html
<script setup>
import { ref } from 'vue'
const count = ref(0)
</script>

<template>
  <button @click="count++">Count: {{ count }}</button>
</template>
```

## Composition API

Vue 3 introduces the Composition API for better code organization:

```js
import { ref, computed, onMounted } from 'vue'

export default {
  setup() {
    const count = ref(0)
    const doubled = computed(() => count.value * 2)

    onMounted(() => {
      console.log('Component mounted')
    })

    return { count, doubled }
  }
}
```

## Options API

The traditional Options API is still fully supported:

```js
export default {
  data() {
    return { count: 0 }
  },
  computed: {
    doubled() {
      return this.count * 2
    }
  },
  methods: {
    increment() {
      this.count++
    }
  }
}
```

## License

MIT License - Copyright (c) 2013-present, Yuxi (Evan) You
