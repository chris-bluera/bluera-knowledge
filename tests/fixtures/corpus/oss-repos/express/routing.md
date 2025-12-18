# Express Routing Guide

## Route Methods

Express supports all HTTP methods:

```js
app.get('/path', handler)     // GET requests
app.post('/path', handler)    // POST requests
app.put('/path', handler)     // PUT requests
app.delete('/path', handler)  // DELETE requests
app.patch('/path', handler)   // PATCH requests
app.options('/path', handler) // OPTIONS requests
app.head('/path', handler)    // HEAD requests

// Match all HTTP methods
app.all('/path', handler)
```

## Route Paths

### String Paths

```js
// Exact match
app.get('/about', handler)

// Pattern with optional character
app.get('/ab?cd', handler) // matches 'acd' and 'abcd'

// Pattern with one or more
app.get('/ab+cd', handler) // matches 'abcd', 'abbcd', 'abbbcd', etc

// Pattern with zero or more
app.get('/ab*cd', handler) // matches 'abcd', 'abxcd', 'abRANDOMcd', etc

// Grouping
app.get('/ab(cd)?e', handler) // matches 'abe' and 'abcde'
```

### Regular Expression Paths

```js
// Match anything with 'a' in it
app.get(/a/, handler)

// Match butterfly, dragonfly (ends with 'fly')
app.get(/.*fly$/, handler)
```

## Route Parameters

```js
// Single parameter
app.get('/users/:userId', (req, res) => {
  res.send(`User: ${req.params.userId}`)
})

// Multiple parameters
app.get('/users/:userId/books/:bookId', (req, res) => {
  console.log(req.params) // { userId: '123', bookId: '456' }
})

// Parameter with regex constraint
app.get('/user/:userId(\\d+)', (req, res) => {
  // userId must be numeric
})

// Hyphenated parameters
app.get('/flights/:from-:to', (req, res) => {
  console.log(req.params) // { from: 'NYC', to: 'LAX' }
})

// Dotted parameters
app.get('/plantae/:genus.:species', (req, res) => {
  console.log(req.params) // { genus: 'Prunus', species: 'persica' }
})
```

## Route Handlers

### Single Handler

```js
app.get('/example', (req, res) => {
  res.send('Hello')
})
```

### Multiple Handlers (Middleware Chain)

```js
const cb0 = (req, res, next) => {
  console.log('CB0')
  next()
}

const cb1 = (req, res, next) => {
  console.log('CB1')
  next()
}

const cb2 = (req, res) => {
  res.send('Hello from C!')
}

app.get('/example', [cb0, cb1, cb2])

// Or mixed
app.get('/example', cb0, [cb1, cb2])
```

## Response Methods

```js
res.download()    // Prompt file download
res.end()         // End response process
res.json()        // Send JSON response
res.jsonp()       // Send JSONP response
res.redirect()    // Redirect request
res.render()      // Render view template
res.send()        // Send various response types
res.sendFile()    // Send file as octet stream
res.sendStatus()  // Set status and send as body
```

## app.route() - Chainable Routes

```js
app.route('/book')
  .get((req, res) => {
    res.send('Get a random book')
  })
  .post((req, res) => {
    res.send('Add a book')
  })
  .put((req, res) => {
    res.send('Update the book')
  })
```

## express.Router

Create modular, mountable route handlers:

```js
// birds.js
const express = require('express')
const router = express.Router()

// Middleware specific to this router
router.use((req, res, next) => {
  console.log('Time:', Date.now())
  next()
})

router.get('/', (req, res) => {
  res.send('Birds home page')
})

router.get('/about', (req, res) => {
  res.send('About birds')
})

module.exports = router

// app.js
const birds = require('./birds')
app.use('/birds', birds)
// Now handles: GET /birds, GET /birds/about
```

## Route Path Matching Order

Routes are matched in the order they are defined:

```js
// This catches everything if placed first!
app.get('*', (req, res) => {
  res.send('Catch all')
})

// Place specific routes BEFORE catch-all routes
app.get('/users', handler)     // More specific
app.get('/users/:id', handler) // Still specific
app.get('*', handler)          // Catch-all (last)
```

## Query Strings

```js
// URL: /search?q=express&limit=10
app.get('/search', (req, res) => {
  console.log(req.query.q)     // 'express'
  console.log(req.query.limit) // '10'
})
```
