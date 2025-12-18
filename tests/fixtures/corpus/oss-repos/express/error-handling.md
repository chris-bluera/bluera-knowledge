# Express Error Handling

## Catching Errors

### Synchronous Errors

Express catches synchronous errors automatically:

```js
app.get('/', (req, res) => {
  throw new Error('BROKEN') // Express catches this
})
```

### Asynchronous Errors

You must pass async errors to `next()`:

```js
app.get('/', (req, res, next) => {
  fs.readFile('/file-does-not-exist', (err, data) => {
    if (err) {
      next(err) // Pass errors to Express
    } else {
      res.send(data)
    }
  })
})
```

### Promise-Based Errors

```js
app.get('/', (req, res, next) => {
  Promise.resolve()
    .then(() => {
      throw new Error('BROKEN')
    })
    .catch(next) // Pass to error handler
})
```

### Async/Await Errors

```js
// Requires Express 5.x or wrapper in Express 4.x
app.get('/user/:id', async (req, res, next) => {
  try {
    const user = await getUserById(req.params.id)
    res.json(user)
  } catch (err) {
    next(err)
  }
})

// With wrapper function
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

app.get('/user/:id', asyncHandler(async (req, res) => {
  const user = await getUserById(req.params.id)
  res.json(user)
}))
```

## Error-Handling Middleware

Define with FOUR arguments:

```js
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).send('Something broke!')
})
```

### Order Matters

Error handlers must be defined AFTER other middleware and routes:

```js
app.use(express.json())
app.use('/api', apiRouter)

// Error handlers last
app.use(notFoundHandler)
app.use(errorHandler)
```

## The Default Error Handler

Express has a built-in default error handler that:
- Sends error stack trace in development
- Sends just the error message in production
- Sets `res.statusCode` from `err.status` or `err.statusCode`

```js
// Trigger default handler by calling next(err)
// after headers are sent
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err) // Delegate to default handler
  }
  res.status(500).render('error', { error: err })
})
```

## Custom Error Classes

```js
class NotFoundError extends Error {
  constructor(message = 'Not Found') {
    super(message)
    this.name = 'NotFoundError'
    this.status = 404
  }
}

class ValidationError extends Error {
  constructor(message, errors = []) {
    super(message)
    this.name = 'ValidationError'
    this.status = 400
    this.errors = errors
  }
}

// Usage
app.get('/user/:id', async (req, res, next) => {
  const user = await User.findById(req.params.id)
  if (!user) {
    return next(new NotFoundError('User not found'))
  }
  res.json(user)
})
```

## Error Handler Examples

### Development vs Production

```js
app.use((err, req, res, next) => {
  res.status(err.status || 500)

  if (process.env.NODE_ENV === 'development') {
    res.json({
      message: err.message,
      stack: err.stack,
      error: err
    })
  } else {
    res.json({
      message: err.message
    })
  }
})
```

### JSON API Error Handler

```js
app.use((err, req, res, next) => {
  const status = err.status || 500
  const message = err.message || 'Internal Server Error'

  res.status(status).json({
    error: {
      status,
      message,
      ...(err.errors && { details: err.errors })
    }
  })
})
```

### HTML Error Pages

```js
app.use((err, req, res, next) => {
  res.status(err.status || 500)
  res.render('error', {
    message: err.message,
    error: process.env.NODE_ENV === 'development' ? err : {}
  })
})
```

## 404 Handler

Handle unmatched routes before error handlers:

```js
// Routes go here...

// 404 handler
app.use((req, res, next) => {
  res.status(404).send('Page not found')
})

// Error handler
app.use((err, req, res, next) => {
  res.status(500).send('Server error')
})
```

## Logging Errors

```js
app.use((err, req, res, next) => {
  // Log error details
  console.error({
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    error: err.message,
    stack: err.stack
  })

  next(err)
})
```

## Error Handling Best Practices

1. **Always use try-catch with async/await**
2. **Create custom error classes** for different error types
3. **Log errors** for debugging and monitoring
4. **Don't expose stack traces** in production
5. **Use appropriate HTTP status codes**
6. **Have a 404 handler** before error handlers
7. **Have a catch-all error handler** at the end
