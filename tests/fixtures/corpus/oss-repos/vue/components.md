# Vue Components Guide

## Single-File Components (SFC)

Vue's recommended way to write components:

```vue
<script setup>
import { ref } from 'vue'

const props = defineProps({
  title: String,
  count: { type: Number, default: 0 }
})

const emit = defineEmits(['update', 'delete'])

const localCount = ref(props.count)

function increment() {
  localCount.value++
  emit('update', localCount.value)
}
</script>

<template>
  <div class="card">
    <h2>{{ title }}</h2>
    <p>Count: {{ localCount }}</p>
    <button @click="increment">+</button>
    <button @click="$emit('delete')">Delete</button>
  </div>
</template>

<style scoped>
.card {
  border: 1px solid #ccc;
  padding: 1rem;
}
</style>
```

## Props

### Declaring Props

```js
// Simple array syntax
defineProps(['title', 'likes'])

// Object syntax with validation
defineProps({
  title: String,
  likes: Number,
  isPublished: Boolean,
  author: Object,
  tags: Array,
  callback: Function,
  contactsPromise: Promise
})

// Full validation
defineProps({
  propA: {
    type: String,
    required: true
  },
  propB: {
    type: Number,
    default: 100
  },
  propC: {
    type: Object,
    default: () => ({ message: 'hello' })
  },
  propD: {
    validator: (value) => ['success', 'warning', 'error'].includes(value)
  }
})
```

### Prop Casing

Use camelCase in JavaScript, kebab-case in templates:

```vue
<script setup>
defineProps({ greetingMessage: String })
</script>

<template>
  <!-- Both work, kebab-case is conventional -->
  <MyComponent greeting-message="hello" />
  <MyComponent greetingMessage="hello" />
</template>
```

## Events

### Emitting Events

```vue
<script setup>
const emit = defineEmits(['submit', 'cancel'])

// With validation
const emit = defineEmits({
  submit: (payload) => {
    return payload.email && payload.password
  },
  cancel: null // no validation
})

function handleSubmit() {
  emit('submit', { email: 'test@example.com', password: '123' })
}
</script>
```

### Listening to Events

```vue
<template>
  <ChildComponent
    @submit="handleSubmit"
    @cancel="visible = false"
  />
</template>
```

## Slots

### Default Slot

```vue
<!-- Parent -->
<FancyButton>
  Click me!
</FancyButton>

<!-- FancyButton.vue -->
<template>
  <button class="fancy-btn">
    <slot></slot>
  </button>
</template>
```

### Named Slots

```vue
<!-- Parent -->
<BaseLayout>
  <template #header>
    <h1>Page Title</h1>
  </template>

  <template #default>
    <p>Main content here</p>
  </template>

  <template #footer>
    <p>Contact info</p>
  </template>
</BaseLayout>

<!-- BaseLayout.vue -->
<template>
  <div class="container">
    <header><slot name="header"></slot></header>
    <main><slot></slot></main>
    <footer><slot name="footer"></slot></footer>
  </div>
</template>
```

### Scoped Slots

```vue
<!-- FancyList.vue -->
<template>
  <ul>
    <li v-for="item in items" :key="item.id">
      <slot name="item" :item="item" :index="index"></slot>
    </li>
  </ul>
</template>

<!-- Parent -->
<FancyList :items="items">
  <template #item="{ item, index }">
    <span>{{ index }}: {{ item.name }}</span>
  </template>
</FancyList>
```

## v-model on Components

### Basic Usage

```vue
<!-- Parent -->
<CustomInput v-model="searchText" />

<!-- CustomInput.vue -->
<script setup>
const model = defineModel()
</script>

<template>
  <input v-model="model" />
</template>
```

### Multiple v-model Bindings

```vue
<UserForm
  v-model:first-name="firstName"
  v-model:last-name="lastName"
/>

<!-- UserForm.vue -->
<script setup>
const firstName = defineModel('firstName')
const lastName = defineModel('lastName')
</script>
```

## Component Registration

### Global Registration

```js
import { createApp } from 'vue'
import MyComponent from './MyComponent.vue'

const app = createApp({})
app.component('MyComponent', MyComponent)
```

### Local Registration

```vue
<script setup>
import ComponentA from './ComponentA.vue'
import ComponentB from './ComponentB.vue'
</script>

<template>
  <ComponentA />
  <ComponentB />
</template>
```

## Async Components

```js
import { defineAsyncComponent } from 'vue'

const AsyncComponent = defineAsyncComponent(() =>
  import('./components/HeavyComponent.vue')
)

// With options
const AsyncComponentWithOptions = defineAsyncComponent({
  loader: () => import('./HeavyComponent.vue'),
  loadingComponent: LoadingSpinner,
  errorComponent: ErrorDisplay,
  delay: 200,
  timeout: 3000
})
```
