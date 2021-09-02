// setInterval(require('why-is-node-running'), 1000).unref()
const DockerLambda = require('../docker')
const path = require('path')
const d = new DockerLambda('/hello', path.join(__dirname, 'hello.js'), {}, 'handler', 'nodejs:12')
d.ready.then(() => {
  console.log('done******************')
  d.request('1', {}).then(v => console.log(v))
}).catch(e => console.log(e))

// setTimeout(function () {
//   console.log("CLOSE")
//   d.close()

// }, 10000)
