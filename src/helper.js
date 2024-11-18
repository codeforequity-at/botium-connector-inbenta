const debug = require('debug')('botium-connector-inbenta-helper')

// sec. we cant get access token if its already expired. We need a small gap there
const MIN_TOKEN_TTL = 5
const PATH_AUTH = '/auth'

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
    method: 'POST',
    headers: {
      'X-Inbenta-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ...(secret ? { secret: secret } : {}),
      ...(personalSecret ? { user_personal_secret: personalSecret } : {})
    })
  }

  debug(`constructed requestOptions for authenticating ${JSON.stringify(requestOptions, null, 2)}`)

  const response = await fetch(`https://api.inbenta.io/${apiVersion}` + PATH_AUTH, requestOptions)
  if (!response.ok) {
    debug(`got error response: ${response.status}/${response.statusText}`)
    throw new Error(`got error response: ${response.status}/${response.statusText}`)
  }
  const body = await response.json()
  if (!body.accessToken) {
    debug(`Access token not found in auth response ${JSON.stringify(body)}`)
    throw new Error('Access token not found in auth response', body)
  }
  debug(`Authenticated: ${JSON.stringify(body, null, 2)}`)
  return body
}

module.exports = {
  runInbentaAuth
}
