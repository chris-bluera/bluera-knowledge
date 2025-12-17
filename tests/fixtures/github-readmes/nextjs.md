# Next.js

The React Framework for the Web

Used by some of the world's largest companies, Next.js enables you to create high-quality web applications with the power of React components.

## Getting Started

Visit [nextjs.org/learn](https://nextjs.org/learn) to get started with Next.js.

## Documentation

Visit [nextjs.org/docs](https://nextjs.org/docs) to view the full documentation.

## Features

- **Built-in Optimizations**: Automatic Image, Font, and Script Optimizations for improved UX and Core Web Vitals.
- **Dynamic HTML Streaming**: Instantly stream UI from the server, integrated with the App Router and React Suspense.
- **React Server Components**: Add components without sending additional client-side JavaScript. Built on the latest React features.
- **Data Fetching**: Make your React component async and await your data. Next.js supports both server and client data fetching.
- **CSS Support**: Style your application with your favorite tools, including support for CSS Modules, Tailwind CSS, and popular community libraries.
- **Client and Server Rendering**: Flexible rendering and caching options, including Incremental Static Regeneration (ISR), on a per-page level.
- **Server Actions**: Run server code by calling a function. Skip the API. Then, easily revalidate cached data and update your UI in one network roundtrip.
- **Route Handlers**: Build API endpoints to securely connect with third-party services for handling auth or listening for webhooks.
- **Advanced Routing & Nested Layouts**: Create routes using the file system, including support for more advanced routing patterns and UI layouts.
- **Middleware**: Take control of the incoming request. Use code to define routing and access rules for authentication, experimentation, and internationalization.

## Quick Start

We recommend creating a new Next.js app using `create-next-app`, which sets up everything automatically for you:

```bash
npx create-next-app@latest
```

For more information on what to do next, see the [Getting Started](https://nextjs.org/docs/getting-started) documentation.

## File Structure

Next.js uses file-system based routing, which means you can use folders to define routes:

```
app/
├── layout.tsx       // Root layout (required)
├── page.tsx         // Home page (/)
├── about/
│   └── page.tsx     // About page (/about)
├── blog/
│   ├── page.tsx     // Blog index (/blog)
│   └── [slug]/
│       └── page.tsx // Blog post (/blog/my-post)
└── api/
    └── route.ts     // API route (/api)
```

## Server Components

React Server Components allow you to write UI that can be rendered and optionally cached on the server:

```tsx
// This component runs on the server
async function getData() {
  const res = await fetch('https://api.example.com/...')
  return res.json()
}

export default async function Page() {
  const data = await getData()

  return <main>{data.title}</main>
}
```

## Client Components

Client Components allow you to add client-side interactivity to your application:

```tsx
'use client'

import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)

  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  )
}
```

## Community

The Next.js community can be found on [GitHub Discussions](https://github.com/vercel/next.js/discussions) where you can ask questions, voice ideas, and share your projects with other people.

To chat with other community members you can join the Next.js [Discord](https://discord.com/invite/bUG2bvbtHy) server.

## Contributing

Contributions to Next.js are welcome and encouraged! Please see the [contributing.md](./contributing.md) for more information on how to get started.

## License

Next.js is [MIT licensed](./LICENSE).
