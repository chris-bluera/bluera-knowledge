# Vue Reactivity System

## Overview

The `@vue/reactivity` package is Vue's standalone reactivity system. It can be used independently of Vue as a framework-agnostic reactive programming library.

## Core APIs

### ref()

Creates a reactive reference to a value:

```js
import { ref } from 'vue'

const count = ref(0)
console.log(count.value) // 0

count.value++
console.log(count.value) // 1
```

### reactive()

Creates a reactive proxy of an object:

```js
import { reactive } from 'vue'

const state = reactive({
  count: 0,
  message: 'Hello'
})

state.count++ // reactive
state.message = 'World' // also reactive
```

### computed()

Creates a computed reactive value:

```js
import { ref, computed } from 'vue'

const count = ref(0)
const doubled = computed(() => count.value * 2)

console.log(doubled.value) // 0
count.value = 5
console.log(doubled.value) // 10
```

### watch()

Watches reactive sources and runs callback on changes:

```js
import { ref, watch } from 'vue'

const count = ref(0)

watch(count, (newValue, oldValue) => {
  console.log(`Count changed from ${oldValue} to ${newValue}`)
})

count.value++ // logs: "Count changed from 0 to 1"
```

### watchEffect()

Runs a function immediately and re-runs when dependencies change:

```js
import { ref, watchEffect } from 'vue'

const count = ref(0)

watchEffect(() => {
  console.log(`Count is: ${count.value}`)
})
// logs: "Count is: 0"

count.value++ // logs: "Count is: 1"
```

## Advanced APIs

### shallowRef()

Creates a ref that only tracks its `.value` assignment:

```js
const shallow = shallowRef({ count: 0 })
shallow.value.count++ // NOT reactive
shallow.value = { count: 1 } // IS reactive
```

### shallowReactive()

Creates a reactive object where only root-level properties are reactive:

```js
const state = shallowReactive({
  nested: { count: 0 }
})
state.nested = { count: 1 } // reactive
state.nested.count++ // NOT reactive
```

### readonly()

Creates a readonly proxy of an object:

```js
const original = reactive({ count: 0 })
const copy = readonly(original)

copy.count++ // warning in dev, fails silently in prod
```

### toRef() and toRefs()

Create refs from reactive object properties:

```js
const state = reactive({ foo: 1, bar: 2 })

// Single property
const fooRef = toRef(state, 'foo')

// All properties
const { foo, bar } = toRefs(state)
```

## Caveats

- Built-in objects are not observed except for `Array`, `Map`, `WeakMap`, `Set`, and `WeakSet`
- Reactivity is based on JavaScript Proxies (ES6+)
- Direct property assignment on reactive objects triggers updates
- Spreading reactive objects loses reactivity (use `toRefs`)

## Credits

The implementation is inspired by:
- Meteor Tracker
- nx-js/observer-util
- salesforce/observable-membrane
