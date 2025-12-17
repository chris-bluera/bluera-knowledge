# Express

Fast, unopinionated, minimalist web framework for [Node.js](http://nodejs.org).

[![NPM Version][npm-version-image]][npm-url]
[![NPM Install Size][npm-install-size-image]][npm-install-size-url]
[![NPM Downloads][npm-downloads-image]][npm-downloads-url]

## Installation

This is a [Node.js](https://nodejs.org/en/) module available through the
[npm registry](https://www.npmjs.com/).

Before installing, [download and install Node.js](https://nodejs.org/en/download/).
Node.js 18 or higher is required.

Installation is done using the
[`npm install` command](https://docs.npmjs.com/getting-started/installing-npm-packages-locally):

```bash
npm install express
```

## Features

  * Robust routing
  * Focus on high performance
  * Super-high test coverage
  * HTTP helpers (redirection, caching, etc)
  * View system supporting 14+ template engines
  * Content negotiation
  * Executable for generating applications quickly

## Quick Start

The quickest way to get started with express is to utilize the executable [`express-generator`](https://github.com/expressjs/generator) to generate an application as shown below:

Install the executable. The executable's major version will match Express's:

```bash
npm install -g express-generator@4
```

Create the app:

```bash
express /tmp/foo && cd /tmp/foo
```

Install dependencies:

```bash
npm install
```

Start the server:

```bash
npm start
```

View the website at: http://localhost:3000

## Quick Example

Here is a basic example of an Express server:

```js
const express = require('express')
const app = express()

app.get('/', function (req, res) {
  res.send('Hello World')
})

app.listen(3000)
```

## Philosophy

The Express philosophy is to provide small, robust tooling for HTTP servers, making
it a great solution for single page applications, web sites, hybrids, or public
HTTP APIs.

Express does not force you to use any specific ORM or template engine. With support for over
14 template engines via [Consolidate.js](https://github.com/tj/consolidate.js),
you can quickly craft your perfect framework.

## Documentation

  * [express.com](https://expressjs.com/)
  * [API Reference](https://expressjs.com/en/4x/api.html)

## Getting Started Guide

  * [Hello World](https://expressjs.com/en/starter/hello-world.html)
  * [Express Generator](https://expressjs.com/en/starter/generator.html)
  * [Basic routing](https://expressjs.com/en/starter/basic-routing.html)
  * [Static files](https://expressjs.com/en/starter/static-files.html)

## Middleware

Express is a routing and middleware web framework that has minimal functionality of its own: An Express application is essentially a series of middleware function calls.

Middleware functions are functions that have access to the request object (req), the response object (res), and the next middleware function in the application's request-response cycle. The next middleware function is commonly denoted by a variable named next.

```js
const express = require('express')
const app = express()

const myLogger = function (req, res, next) {
  console.log('LOGGED')
  next()
}

app.use(myLogger)

app.get('/', function (req, res) {
  res.send('Hello World!')
})

app.listen(3000)
```

## People

The original author of Express is [TJ Holowaychuk](https://github.com/tj)

The current lead maintainer is [Douglas Christopher Wilson](https://github.com/dougwilson)

## License

  [MIT](LICENSE)
