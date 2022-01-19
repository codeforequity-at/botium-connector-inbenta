const rp = require('request-promise-native')
const debug = require('debug')('botium-connector-inbenta-helper')

// sec. we cant get access token if its already expired. We need a small gap there
const MIN_TOKEN_TTL = 5
const PATH_AUTH = '/auth'

const _includeRequest = (body, response) => {
  return { response, body }
}

const runInbentaAuth = async ({ apiVersion, apiKey, secret, personalSecret }, prevAuth = {}) => {
  if (!prevAuth || !prevAuth.accessToken) {
    debug('Authentication required, no access token')
  } else {
    const remaining = Math.round(prevAuth.expiration - (Date.now() / 1000))
    if (remaining < MIN_TOKEN_TTL) {
      debug(`Authentication required, Access TTL ${remaining}s/${prevAuth.expires_in}s (expected min ${MIN_TOKEN_TTL})`)
    } else {
      debug(`Skipping authentication (Access token TTL ${remaining}s/${prevAuth.expires_in}s)`)
      return prevAuth
    }
  }

  const requestOptions = {
    uri: `https://api.inbenta.io/${apiVersion}` + PATH_AUTH,
    method: 'POST',
    headers: {
      'X-Inbenta-Key': apiKey
    },
    body: {
      ...(secret ? { secret: secret } : {}),
      ...(personalSecret ? { user_personal_secret: personalSecret } : {})
    },
    json: true,
    transform: _includeRequest
  }

  debug(`constructed requestOptions for authenticating ${JSON.stringify(requestOptions, null, 2)}`)

  return rp(requestOptions).then(({ response, body }) => {
    if (response.statusCode >= 400) {
      debug(`got error response: ${response.statusCode}/${response.statusMessage}`)
      throw new Error(`got error response: ${response.statusCode}/${response.statusMessage}`)
    }
    if (!body.accessToken) {
      debug(`Access token not found in auth response ${JSON.stringify(body)}`)
      throw new Error('Access token not found in auth response', body)
    }
    debug(`Authenticated: ${JSON.stringify(body, null, 2)}`)
    return body
  })
}

module.exports = {
  runInbentaAuth
}
