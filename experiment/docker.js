// @ts-check
'use strict'

const _path = require('path')
const events = require('events')
const fs = require('fs')
const cp = require('child_process')
const fetch = require('node-fetch').default
const { promisify } = require('util')

/** @type {(src: string, dest: string, opts: {}) => Promise<void>} */
const ncp = promisify(require('ncp'))

let START_PORT = ~~(9000 + Math.random() * 10000)

async function copy (src, dest) {
  await fs.promises.mkdir(dest, { recursive: true })
  return ncp(src, dest, {})
}

function log (proc) {
  proc.stdout.on('data', d => process.stdout.write(d))
  proc.stderr.on('data', d => process.stderr.write(d))
  return proc
}

function logCmd (cmd, argv, env) {
  // console.log(['>docker', 'build', this.tmp, '-t', this.id].join(' '))
  console.log(['>' + cmd].concat(argv).join(' '))
  return log(cp.spawn(cmd, argv, env))
}

function createDockerfile (runtime, handler) {
  return `
FROM public.ecr.aws/lambda/${runtime}

# Copy function code
COPY * $\{LAMBDA_TASK_ROOT}/

# Set the CMD to your handler (could also be done as a parameter override outside of the Dockerfile)
CMD [ "${handler}" ]
`
}

async function sleep (ts) {
  return new Promise(resolve => { setTimeout(resolve, ts) })
}

async function dockerLambdaReady (port, max = 10000) {
  const start = Date.now()

  while (Date.now() < max + start) {
    try {
      await fetch(`http://localhost:${port}`)
      await sleep(50)
      return
    } catch (err) {
      // loop...
      await sleep(200)
    }
  }
}

class DockerLambda {
  constructor (args) {
    const {
      bin,
      entry,
      env,
      handler,
      id,
      path,
      runtime,
      stderr,
      stdout,
      tmp
    } = args

    this.bin = bin || 'docker'
    this.path = path
    if (!/^nodejs:/.test(runtime)) { throw new Error('only node.js runtime supported currently') }
    // copy input to tmp dir
    // insert Dockerfile
    // run docker build
    // start docker
    // use fetch, but return expected event object.
    this.id = id || 'docker_' + Date.now()
    this.tmp = tmp || '/tmp/' + this.id

    this.port = START_PORT++
    this.entry = entry
    this.env = env
    this.handler = handler || 'handler'
    this.runtime = runtime
    this.stdout = stdout
    this.stderr = stderr
    this.ready = this.bootstrap()
  }

  async bootstrap () {
    const envArray = Object.keys(this.env)
      .map(k => ['--env', k + '=' + this.env[k]])
      .reduce((a, b) => a.concat(b), [])

    // const id = 'operator-docker_' + Date.now()
    // const tmp = '/tmp/' + id
    await copy(_path.dirname(this.entry), this.tmp)
    const basename = _path.basename(this.entry)
    const base = basename.substring(0, basename.indexOf(_path.extname(basename)))
    await fs.promises.writeFile(
      _path.join(this.tmp, 'Dockerfile'),
      createDockerfile('nodejs:12', base + '.' + this.handler)
    )

    this.proc = logCmd(this.bin, ['build', this.tmp, '-t', this.id])
    const [code] = await events.once(this.proc, 'exit')

    if (code) { throw new Error('docker build failed') }

    // XXX: I think this should error but that breaks the tests...
    if (this.closed) return
    // throw new Error('closed during startup')

    // if the id isn't the very last argument you'll get an error
    // "entrypoint requires that handler must be first arg"
    // which won't help you figure it out.
    this.name = 'name_' + Date.now()

    const args = [
      'run',
      '-p',
      `${this.port}:8080`,
      '--name',
      this.name,
      ...envArray,
      this.id
    ]

    const proc = this.proc = logCmd(this.bin, args)

    pipeStdio(proc, { stdout: this.stdout, stderr: this.stderr })

    await dockerLambdaReady(this.port)
  }

  async request (_id, eventObject) {
    await this.ready
    let error
    const url = `http://localhost:${this.port}/2015-03-31/functions/function/invocations`

    for (let i = 0; i < 10; i++) {
      try {
        const options = { method: 'post', body: JSON.stringify(eventObject) }
        const req = (await fetch(url, options)) // .text()
        const body = await req.text()

        if (!body) console.log(req)
        return JSON.parse(body)
      } catch (err) {
        await sleep(100)
        error = err
      } // loop
    }

    throw error
  }

  async close () {
    this.closed = true

    if (this.proc) {
      // docker run -i
      // with kill 9 is necessary combination. i think.
      // const p = events.once(this.proc, 'exit')
      // this.proc.kill(9)
      // await p
      this.proc = logCmd('docker', ['kill', this.name])
      await events.once(this.proc, 'exit')
    }
    // return true
  }
}

module.exports = DockerLambda

function invokeUnref (arg) {
  const obj = /** @type {null | { unref: unknown }} */ (arg)
  if (obj && obj.unref && typeof obj.unref === 'function') {
    obj.unref()
  }
  return arg
}

function maybePipe (source, dest) {
  if (source) {
    invokeUnref(source)
    source.pipe(dest, { end: false })
  }
}

function pipeStdio (proc, stdio) {
  maybePipe(proc.stdout, stdio.stdout || process.stdout)
  maybePipe(proc.stderr, stdio.stderr || process.stderr)
}