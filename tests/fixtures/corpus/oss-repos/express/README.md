# Express.js

Fast, unopinionated, minimalist web framework for Node.js.

## Installation

```bash
npm install express
```

Requires Node.js 18 or higher.

## Quick Start

```js
const express = require('express')
const app = express()

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(3000, () => {
  console.log('Server running on port 3000')
})
```

## Key Features

- **Robust Routing**: Flexible URL routing with support for parameters, wildcards, and pattern matching
- **High Performance**: Thin layer of fundamental web features without obscuring Node.js features
- **Template Engines**: Support for 14+ template engines via the `view` system
- **Middleware**: Extensive middleware ecosystem for request processing
- **HTTP Helpers**: Utilities for redirects, caching, content negotiation

## Basic Routing

```js
// HTTP methods
app.get('/users', (req, res) => res.json(users))
app.post('/users', (req, res) => res.status(201).json(newUser))
app.put('/users/:id', (req, res) => res.json(updatedUser))
app.delete('/users/:id', (req, res) => res.status(204).end())

// All HTTP methods
app.all('/secret', (req, res, next) => {
  console.log('Accessing secret section...')
  next()
})
```

## Route Parameters

```js
app.get('/users/:userId', (req, res) => {
  res.send(`User ID: ${req.params.userId}`)
})

app.get('/users/:userId/books/:bookId', (req, res) => {
  res.json({
    userId: req.params.userId,
    bookId: req.params.bookId
  })
})
```

## Middleware

```js
// Application-level middleware
app.use((req, res, next) => {
  console.log('Time:', Date.now())
  next()
})

// Route-specific middleware
app.use('/user/:id', (req, res, next) => {
  console.log('Request Type:', req.method)
  next()
})

// Built-in middleware
app.use(express.json()) // Parse JSON bodies
app.use(express.urlencoded({ extended: true })) // Parse URL-encoded bodies
app.use(express.static('public')) // Serve static files
```

## Error Handling

```js
// Error-handling middleware (4 arguments)
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).send('Something broke!')
})
```

## Router

```js
const router = express.Router()

router.get('/', (req, res) => {
  res.send('Birds home page')
})

router.get('/about', (req, res) => {
  res.send('About birds')
})

app.use('/birds', router)
```

## Response Methods

```js
res.send('Hello')           // Send string response
res.json({ user: 'john' })  // Send JSON response
res.status(404).end()       // Send status only
res.sendFile('/path/to/file') // Send file
res.redirect('/login')      // Redirect to URL
res.render('index', { title: 'Home' }) // Render template
```

## License

MIT License
