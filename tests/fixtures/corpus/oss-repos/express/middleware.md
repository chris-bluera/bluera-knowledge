# Express Middleware Guide

## What is Middleware?

Middleware functions have access to the request object (`req`), response object (`res`), and the `next` function. Middleware can:

- Execute any code
- Make changes to request/response objects
- End the request-response cycle
- Call the next middleware with `next()`

## Application-Level Middleware

Bind to the app instance using `app.use()` or `app.METHOD()`:

```js
const express = require('express')
const app = express()

// Middleware with no mount path - executes for every request
app.use((req, res, next) => {
  console.log('Time:', Date.now())
  next()
})

// Middleware mounted on /user/:id
app.use('/user/:id', (req, res, next) => {
  console.log('Request Type:', req.method)
  next()
})

// Route handler (also middleware)
app.get('/user/:id', (req, res) => {
  res.send('USER')
})
```

## Middleware Stack

```js
// Multiple middleware functions
app.use('/user/:id',
  (req, res, next) => {
    console.log('Request URL:', req.originalUrl)
    next()
  },
  (req, res, next) => {
    console.log('Request Type:', req.method)
    next()
  }
)
```

## Skipping Middleware

Use `next('route')` to skip remaining middleware in current route:

```js
app.get('/user/:id',
  (req, res, next) => {
    if (req.params.id === '0') next('route')
    else next()
  },
  (req, res) => {
    res.send('regular')
  }
)

app.get('/user/:id', (req, res) => {
  res.send('special')
})
```

## Router-Level Middleware

Same as application-level but bound to `express.Router()`:

```js
const router = express.Router()

// Middleware for all routes in this router
router.use((req, res, next) => {
  console.log('Time:', Date.now())
  next()
})

// Middleware for specific path
router.use('/user/:id', (req, res, next) => {
  console.log('Request URL:', req.originalUrl)
  next()
})

router.get('/user/:id', (req, res) => {
  res.send('User info')
})

app.use('/', router)
```

## Error-Handling Middleware

Defined with FOUR arguments - `(err, req, res, next)`:

```js
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).send('Something broke!')
})
```

### Passing Errors

```js
app.get('/user/:id', (req, res, next) => {
  const err = new Error('User not found')
  err.status = 404
  next(err) // Pass to error handler
})

// Catch async errors
app.get('/async', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
    res.json(user)
  } catch (err) {
    next(err)
  }
})
```

### Multiple Error Handlers

```js
// Log errors
app.use((err, req, res, next) => {
  console.error(err.stack)
  next(err)
})

// Client error handler
app.use((err, req, res, next) => {
  if (req.xhr) {
    res.status(500).json({ error: 'Something failed!' })
  } else {
    next(err)
  }
})

// Fallback error handler
app.use((err, req, res, next) => {
  res.status(500).render('error', { error: err })
})
```

## Built-in Middleware

```js
// Parse JSON bodies
app.use(express.json())

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }))

// Serve static files
app.use(express.static('public'))
app.use('/static', express.static('public'))

// Multiple static directories
app.use(express.static('public'))
app.use(express.static('files'))
```

## Third-Party Middleware

```js
const cookieParser = require('cookie-parser')
const helmet = require('helmet')
const morgan = require('morgan')
const cors = require('cors')

app.use(cookieParser())           // Parse cookies
app.use(helmet())                 // Security headers
app.use(morgan('combined'))       // HTTP logging
app.use(cors())                   // Enable CORS
```

## Configurable Middleware

```js
// Create configurable middleware
function logger(options) {
  return function(req, res, next) {
    if (options.log) {
      console.log(`${req.method} ${req.url}`)
    }
    next()
  }
}

app.use(logger({ log: true }))
```

## Async Middleware Pattern

```js
// Wrapper for async middleware
const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

app.get('/users', asyncHandler(async (req, res) => {
  const users = await User.find()
  res.json(users)
}))
```

## Middleware Execution Order

Middleware executes in the order it's defined:

```js
app.use(middleware1)  // Runs first
app.use(middleware2)  // Runs second
app.use(middleware3)  // Runs third

// Error handlers should be last
app.use(errorHandler)
```
