
exports.handler = function (event, context, callback) {
  // console.log('Received event:', JSON.stringify(event, null, 2));
  const res = {
    statusCode: 200,
    headers: {
      'Content-Type': '*/*'
    }
  }
  let greeter = 'World'
  console.log('js hello')
  console.log(JSON.stringify(event))
  if (event.greeter && event.greeter !== '') {
    greeter = event.greeter
  } else if (event.body && event.body !== '') {
    const body = JSON.parse(event.body)
    if (body.greeter && body.greeter !== '') {
      greeter = body.greeter
    }
  } else if (event.queryStringParameters && event.queryStringParameters.greeter && event.queryStringParameters.greeter !== '') {
    greeter = event.queryStringParameters.greeter
  } else if (event.multiValueHeaders && event.multiValueHeaders.greeter && event.multiValueHeaders.greeter !== '') {
    greeter = event.multiValueHeaders.greeter.join(' and ')
  } else if (event.headers && event.headers.greeter && event.headers.greeter !== '') {
    greeter = event.headers.greeter
  } else if (process.env.TEST_GREETER) {
    greeter = process.env.TEST_GREETER
  } else if (event.requestContext.greeter) {
    greeter = event.requestContext.greeter
  }

  res.body = 'Hello, ' + greeter + '!'
  callback(null, res)
}
