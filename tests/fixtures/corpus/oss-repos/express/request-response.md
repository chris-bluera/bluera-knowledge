# Express Request & Response

## Request Object (req)

### Request Properties

```js
app.get('/example', (req, res) => {
  req.app          // Express application instance
  req.baseUrl      // Mounted router path
  req.body         // Parsed request body (requires body-parser)
  req.cookies      // Parsed cookies (requires cookie-parser)
  req.fresh        // Cache freshness check
  req.hostname     // Hostname from Host header
  req.ip           // Client IP address
  req.ips          // Array of IPs (when trust proxy enabled)
  req.method       // HTTP method (GET, POST, etc.)
  req.originalUrl  // Original request URL
  req.params       // Route parameters
  req.path         // Request path
  req.protocol     // http or https
  req.query        // Query string parameters
  req.route        // Current route
  req.secure       // true if HTTPS
  req.signedCookies // Signed cookies
  req.stale        // Opposite of fresh
  req.subdomains   // Array of subdomains
  req.xhr          // true if X-Requested-With is XMLHttpRequest
})
```

### Request Methods

```js
// Check accepted content types
req.accepts('html')             // 'html' or false
req.accepts(['html', 'json'])   // 'json' if preferred

// Check accepted character sets
req.acceptsCharsets('utf-8')

// Check accepted encodings
req.acceptsEncodings('gzip')

// Check accepted languages
req.acceptsLanguages('en')

// Get header value
req.get('Content-Type')
req.header('Content-Type')  // alias

// Check content type
req.is('html')              // false
req.is('text/html')         // 'text/html'
req.is('application/*')     // 'application/json'

// Range header parsing
req.range(1000)  // [{ start: 0, end: 999 }]
```

## Response Object (res)

### Response Properties

```js
res.app           // Express application instance
res.headersSent   // true if headers already sent
res.locals        // Local variables scoped to request
```

### Setting Headers

```js
// Set single header
res.set('Content-Type', 'text/html')
res.header('Content-Type', 'text/html')  // alias

// Set multiple headers
res.set({
  'Content-Type': 'text/plain',
  'Content-Length': '123',
  'ETag': '12345'
})

// Append to header
res.append('Set-Cookie', 'foo=bar')
res.append('Warning', '199 Miscellaneous warning')

// Get header value
res.get('Content-Type')
```

### Response Methods

```js
// Send response
res.send('Hello World')           // String
res.send({ user: 'john' })        // JSON (auto-converted)
res.send(Buffer.from('whoop'))    // Buffer

// Send JSON
res.json({ user: 'john' })
res.json(null)
res.json([1, 2, 3])

// Send JSONP
res.jsonp({ user: 'john' })

// Send status
res.sendStatus(200)  // Sends 'OK'
res.sendStatus(404)  // Sends 'Not Found'
res.sendStatus(500)  // Sends 'Internal Server Error'

// Send file
res.sendFile('/path/to/file.pdf')
res.sendFile('file.pdf', { root: './public' })

// Download file
res.download('/path/to/file.pdf')
res.download('/path/to/file.pdf', 'custom-name.pdf')

// Redirect
res.redirect('/login')
res.redirect(301, 'http://example.com')
res.redirect('back')  // Back to Referer

// Render template
res.render('index')
res.render('user', { name: 'John' })

// End response
res.end()
res.status(404).end()
```

### Status and Type

```js
// Set status code
res.status(404)
res.status(500)

// Chainable
res.status(404).send('Not Found')
res.status(500).json({ error: 'Server Error' })

// Set content type
res.type('html')               // 'text/html'
res.type('json')               // 'application/json'
res.type('application/json')
res.type('png')                // 'image/png'
```

### Cookies

```js
// Set cookie
res.cookie('name', 'value')

// Cookie options
res.cookie('rememberme', '1', {
  expires: new Date(Date.now() + 900000),
  httpOnly: true,
  secure: true,
  sameSite: 'strict'
})

// Clear cookie
res.clearCookie('name')
```

### Links and Location

```js
// Set Link header
res.links({
  next: 'http://api.example.com/users?page=2',
  last: 'http://api.example.com/users?page=5'
})

// Set Location header
res.location('/login')
res.location('http://example.com')
```

### Vary Header

```js
// Add field to Vary header
res.vary('User-Agent')
res.vary('Accept-Encoding')
```

### Format Response

```js
res.format({
  'text/plain': () => {
    res.send('hey')
  },
  'text/html': () => {
    res.send('<p>hey</p>')
  },
  'application/json': () => {
    res.json({ message: 'hey' })
  },
  default: () => {
    res.status(406).send('Not Acceptable')
  }
})
```

## res.locals

Pass data to templates:

```js
// In middleware
app.use((req, res, next) => {
  res.locals.user = req.user
  res.locals.isAuthenticated = true
  next()
})

// In route handler
app.get('/', (req, res) => {
  res.locals.title = 'Home Page'
  res.render('index')  // Can access user, isAuthenticated, title
})
```
