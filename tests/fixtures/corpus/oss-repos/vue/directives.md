# Vue Built-in Directives

## v-bind

Dynamically bind attributes or component props:

```vue
<template>
  <!-- Attribute binding -->
  <img v-bind:src="imageSrc" />
  <img :src="imageSrc" /> <!-- shorthand -->

  <!-- Class binding -->
  <div :class="{ active: isActive, error: hasError }"></div>
  <div :class="[activeClass, errorClass]"></div>

  <!-- Style binding -->
  <div :style="{ color: textColor, fontSize: fontSize + 'px' }"></div>
  <div :style="[baseStyles, overrideStyles]"></div>

  <!-- Bind multiple attributes -->
  <div v-bind="{ id: 'container', class: 'wrapper' }"></div>
</template>
```

## v-on

Listen to DOM events:

```vue
<template>
  <!-- Method handler -->
  <button v-on:click="handleClick">Click</button>
  <button @click="handleClick">Click</button> <!-- shorthand -->

  <!-- Inline handler -->
  <button @click="count++">Add 1</button>
  <button @click="say('hello')">Say hello</button>

  <!-- Event modifiers -->
  <form @submit.prevent="onSubmit"></form>
  <a @click.stop="doThis"></a>
  <input @keyup.enter="submit" />
  <button @click.once="doOnce">Only once</button>

  <!-- Multiple events -->
  <input @focus="onFocus" @blur="onBlur" />
</template>
```

### Event Modifiers

- `.stop` - call `event.stopPropagation()`
- `.prevent` - call `event.preventDefault()`
- `.capture` - use capture mode
- `.self` - only trigger if target is element itself
- `.once` - trigger at most once
- `.passive` - indicates handler won't call `preventDefault()`

### Key Modifiers

```vue
<input @keyup.enter="submit" />
<input @keyup.tab="handleTab" />
<input @keyup.delete="handleDelete" />
<input @keyup.esc="closeModal" />
<input @keyup.space="togglePlay" />
<input @keyup.arrow-up="moveCursor('up')" />
```

## v-model

Two-way binding on form inputs:

```vue
<template>
  <!-- Text input -->
  <input v-model="message" />

  <!-- Textarea -->
  <textarea v-model="message"></textarea>

  <!-- Checkbox (boolean) -->
  <input type="checkbox" v-model="checked" />

  <!-- Checkbox (array) -->
  <input type="checkbox" value="Jack" v-model="checkedNames" />
  <input type="checkbox" value="John" v-model="checkedNames" />

  <!-- Radio -->
  <input type="radio" value="One" v-model="picked" />
  <input type="radio" value="Two" v-model="picked" />

  <!-- Select -->
  <select v-model="selected">
    <option value="A">A</option>
    <option value="B">B</option>
  </select>

  <!-- Modifiers -->
  <input v-model.lazy="msg" /> <!-- sync on change instead of input -->
  <input v-model.number="age" type="number" /> <!-- cast to number -->
  <input v-model.trim="msg" /> <!-- trim whitespace -->
</template>
```

## v-if / v-else-if / v-else

Conditional rendering:

```vue
<template>
  <div v-if="type === 'A'">Type A</div>
  <div v-else-if="type === 'B'">Type B</div>
  <div v-else>Not A or B</div>

  <!-- On template for multiple elements -->
  <template v-if="show">
    <h1>Title</h1>
    <p>Content</p>
  </template>
</template>
```

## v-show

Toggle visibility (CSS display):

```vue
<template>
  <!-- Element stays in DOM, just hidden -->
  <div v-show="isVisible">Content</div>
</template>
```

### v-if vs v-show

- `v-if` - truly conditional, destroys/recreates elements
- `v-show` - always rendered, toggles CSS display
- Use `v-show` for frequent toggles
- Use `v-if` for conditions that rarely change

## v-for

List rendering:

```vue
<template>
  <!-- Array -->
  <li v-for="item in items" :key="item.id">
    {{ item.name }}
  </li>

  <!-- With index -->
  <li v-for="(item, index) in items" :key="item.id">
    {{ index }}: {{ item.name }}
  </li>

  <!-- Object -->
  <li v-for="(value, key) in object" :key="key">
    {{ key }}: {{ value }}
  </li>

  <!-- Range -->
  <span v-for="n in 10" :key="n">{{ n }}</span>

  <!-- On template -->
  <template v-for="item in items" :key="item.id">
    <li>{{ item.name }}</li>
    <li class="divider" role="presentation"></li>
  </template>
</template>
```

## v-slot

Named slots and scoped slots:

```vue
<template>
  <BaseLayout>
    <template v-slot:header>Header content</template>
    <template #footer>Footer content</template> <!-- shorthand -->
  </BaseLayout>

  <!-- Scoped slot -->
  <MyComponent v-slot="{ item, index }">
    {{ index }}: {{ item }}
  </MyComponent>
</template>
```

## v-pre

Skip compilation for this element:

```vue
<template>
  <span v-pre>{{ this will not be compiled }}</span>
</template>
```

## v-once

Render only once, skip future updates:

```vue
<template>
  <span v-once>This will never change: {{ msg }}</span>
</template>
```

## v-memo

Memoize template sub-tree:

```vue
<template>
  <div v-memo="[valueA, valueB]">
    <!-- Only re-render when valueA or valueB changes -->
  </div>
</template>
```

## v-cloak

Hide un-compiled template until ready:

```vue
<style>
[v-cloak] { display: none; }
</style>

<template>
  <div v-cloak>{{ message }}</div>
</template>
```

## Custom Directives

```js
// Global registration
app.directive('focus', {
  mounted(el) {
    el.focus()
  }
})

// Local registration
const vFocus = {
  mounted: (el) => el.focus()
}

// Usage
<input v-focus />
```

### Directive Hooks

```js
const myDirective = {
  created(el, binding, vnode) {},
  beforeMount(el, binding, vnode) {},
  mounted(el, binding, vnode) {},
  beforeUpdate(el, binding, vnode, prevVnode) {},
  updated(el, binding, vnode, prevVnode) {},
  beforeUnmount(el, binding, vnode) {},
  unmounted(el, binding, vnode) {}
}
```
