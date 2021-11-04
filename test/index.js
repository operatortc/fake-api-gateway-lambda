'use strict'

// const log = require('why-is-node-running')
// setInterval(log, 10000).unref()
const path = require('path')
const { test } = require('./test-harness')

test('calling /hello with ENV vars 1', {
  env: { TEST_GREETER: 'TEST_ENV_1' }
}, async (harness, assert) => {
  const res = await harness.fetch('/hello')
  assert.equal(res.status, 200)

  const b = await res.text()
  assert.equal(b, 'Hello, TEST_ENV_1!')
})

test('calling /hello with requestContext sync', {
  requestContext: () => {
    return {
      greeter: 'Timothy'
    }
  }
}, async (harness, assert) => {
  const res = await harness.fetch('/hello')
  assert.equal(res.status, 200)

  const b = await res.text()
  assert.equal(b, 'Hello, Timothy!')
})

test('calling /hello with requestContext async', {
  requestContext: () => {
    return {
      greeter: 'Timothy'
    }
  }
}, async (harness, assert) => {
  const res = await harness.fetch('/hello')
  assert.equal(res.status, 200)

  const b = await res.text()
  assert.equal(b, 'Hello, Timothy!')
})

test('calling /hello with ENV vars 2', {
  env: { TEST_GREETER: 'TEST_ENV_2' }
}, async (harness, assert) => {
  const res = await harness.fetch('/hello')
  assert.equal(res.status, 200)

  const b = await res.text()
  assert.equal(b, 'Hello, TEST_ENV_2!')
})

test('calling /hello', async (harness, assert) => {
  const res = await harness.fetch('/hello')
  assert.equal(res.status, 200)

  const b = await res.text()
  assert.equal(b, 'Hello, World!')
})

test('calling /hello many times', async (harness, assert) => {
  for (let i = 0; i < 5; i++) {
    const res = await harness.fetch('/hello')
    assert.equal(res.status, 200)

    const b = await res.text()
    assert.equal(b, 'Hello, World!')
  }

//  assert.equal(harness.lambda.workerPool.workers.length, 1)
})

test('calling /hello many times in parallel',
  async (harness, assert) => {
    // @type {Promise<import('node-fetch').Response>[]}
    const tasks = []
    for (let i = 0; i < 5; i++) {
      tasks.push(harness.fetch('/hello'))
    }

    const responses = await Promise.all(tasks)
    for (const res of responses) {
      assert.equal(res.status, 200)

      const b = await res.text()
      assert.equal(b, 'Hello, World!')
    }
  }
)

test('calling /hello with different args', async (harness, assert) => {
  const res1 = await harness.fetch('/hello', {
    method: 'POST',
    body: JSON.stringify({ greeter: 'James' })
  })
  assert.equal(res1.status, 200)

  const b1 = await res1.text()
  assert.equal(b1, 'Hello, James!')

  const res2 = await harness.fetch('/hello?greeter=Bob')
  assert.equal(res2.status, 200)

  const b2 = await res2.text()
  assert.equal(b2, 'Hello, Bob!')

  const res3 = await harness.fetch('/hello', {
    headers: [
      ['greeter', 'Charles'],
      ['greeter', 'Tim']
    ]
  })
  assert.equal(res3.status, 200)

  const b3 = await res3.text()
  assert.equal(b3, 'Hello, Charles and Tim!')

  const res4 = await harness.fetch('/hello', {
    headers: {
      greeter: 'Alice'
    }
  })
  assert.equal(res4.status, 200)

  const b4 = await res4.text()
  assert.equal(b4, 'Hello, Alice!')
})

test('calling not found endpoint', async (harness, assert) => {
  const res = await harness.fetch('/foo')
  assert.equal(res.status, 403)

  const b = await res.text()
  assert.equal(b, '{"message":"Forbidden"}')
})

test('calling not found endpoint', async (harness, assert) => {
  harness.lambda.addWorker({
    path: '/foo',
    entry: path.join(__dirname, 'lambdas', 'hello.js')
  })
  const res = await harness.fetch('/foo')
  assert.equal(res.status, 200)

  const b = await res.text()
//  assert.equal(b, '{"message":"Forbidden"}')
})

