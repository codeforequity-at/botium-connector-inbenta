const util = require('util')
const rp = require('request-promise')
const _ = require('lodash')
const debug = require('debug')('botium-connector-inbenta-webhook')

const Capabilities = {
  INBENTA_API_VERSION: 'INBENTA_API_VERSION',
  INBENTA_API_KEY: 'INBENTA_API_KEY',
  INBENTA_SECRET: 'INBENTA_SECRET',
  INBENTA_SOURCE: 'INBENTA_SOURCE',
  INBENTA_USER_TYPE: 'INBENTA_USER_TYPE',
  INBENTA_ENV: 'INBENTA_ENV',
  INBENTA_LANG: 'INBENTA_LANG',
  INBENTA_TIMEZONE: 'INBENTA_TIMEZONE',
  INBENTA_SKIP_WELCOME_MESSAGE: 'INBENTA_SKIP_WELCOME_MESSAGE'
}

const PATH_AUTH = '/auth'
const PATH_CONVERSATION = '/conversation'
const PATH_CONVERSATION_MESSAGE = '/conversation/message'

// sec. we cant get access token if its already expired. We need a small gap there
const MIN_TOKEN_TTL = 5

const _includeRequest = (body, response) => {
  return { response, body }
}

class BotiumConnectorInbentaWebhook {
  constructor ({ queueBotSays, caps }) {
    this.queueBotSays = queueBotSays
    this.caps = caps
    this.accessToken = null
    this.sessionToken = null
    this.sessionId = null
    this.chatbotAPI = null
    this.apiVersion = this.caps[Capabilities.INBENTA_API_VERSION] || 'v1'
  }

  async Validate () {
    debug('Validate called')

    if (!this.caps[Capabilities.INBENTA_API_KEY]) throw new Error('INBENTA_API_KEY capability required')
    if (!this.caps[Capabilities.INBENTA_SECRET]) throw new Error('INBENTA_SECRET capability required')

    return Promise.resolve()
  }

  async Start () {
    debug('Start called')
    await this._authAndAccessTokenWeak()
    await this._startConversation()
    if (_.isNil(this.caps[Capabilities.INBENTA_SKIP_WELCOME_MESSAGE]) || !this.caps[Capabilities.INBENTA_SKIP_WELCOME_MESSAGE]) {
      await this._sendMessage({ justWelcomeMessage: true })
    }
  }

  async UserSays (msg) {
    debug(`UserSays called ${util.inspect(msg)}`)
    await this._authAndAccessTokenWeak()
    await this._sendMessage({ msg })
  }

  async Stop () {
    debug('Stop called')
    this.accessToken = null
    this.sessionToken = null
    this.sessionId = null
    this.chatbotAPI = null
  }

  async _authAndAccessTokenWeak () {
    if (!this.accessToken) {
      debug('Authentication required, no access token')
    } else {
      const remaining = Math.round(this.expiration - (Date.now() / 1000))
      if (remaining < MIN_TOKEN_TTL) {
        debug(`Authentication required, Access TTL ${remaining}s/${this.expires_in}s (expected min ${MIN_TOKEN_TTL})`)
      } else {
        debug(`Skipping authentication (Access token TTL ${remaining}s/${this.expires_in}s)`)
        return
      }
    }

    const requestOptions = {
      uri: `https://api.inbenta.io/${this.apiVersion}` + PATH_AUTH,
      method: 'POST',
      headers: {
        'X-Inbenta-Key': this.caps[Capabilities.INBENTA_API_KEY]
      },
      body: {
        secret: this.caps[Capabilities.INBENTA_SECRET]
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
      this.accessToken = body.accessToken
      if (!body.apis || !body.apis.chatbot) {
        debug(`Chatbot API not found in auth response ${JSON.stringify(body)}`)
        throw new Error('Chatbot API not found in auth response', body)
      }
      this.chatbotAPI = `${body.apis.chatbot}/${this.apiVersion}`
      this.expiration = body.expiration
      this.expires_in = body.expires_in

      debug(`Authenticated: ${JSON.stringify(body, null, 2)}`)
    })
  }

  async _startConversation () {
    const headers = {
      // eslint-disable-next-line quote-props
      'Authorization': `Bearer ${this.accessToken}`,
      'X-Inbenta-Key': this.caps[Capabilities.INBENTA_API_KEY],
      'X-Inbenta-Source': this.caps[Capabilities.INBENTA_SOURCE] || 'Botium',
      // production is the default by Inbenta, but for testing development looks better default
      'X-Inbenta-Env': this.caps[Capabilities.INBENTA_ENV] || 'development'

    }
    if (!_.isNil(this.caps[Capabilities.INBENTA_USER_TYPE])) {
      headers['X-Inbenta-User-Type'] = this.caps[Capabilities.INBENTA_USER_TYPE]
    }
    const body = {
      lang: this.caps[Capabilities.INBENTA_LANG] || 'en'
    }
    if (!_.isNil(this.caps[Capabilities.INBENTA_TIMEZONE])) {
      headers.timezone = this.caps[Capabilities.INBENTA_TIMEZONE]
    }

    const requestOptions = {
      uri: this.chatbotAPI + PATH_CONVERSATION,
      method: 'POST',
      headers,
      body,
      json: true,
      transform: _includeRequest
    }

    debug(`constructed requestOptions for starting conversations ${JSON.stringify(requestOptions, null, 2)}`)

    return rp(requestOptions).then(({ response, body }) => {
      if (response.statusCode >= 400) {
        debug(`got error response: ${response.statusCode}/${response.statusMessage}`)
        throw new Error(`got error response: ${response.statusCode}/${response.statusMessage}`)
      }

      if (!body.sessionToken) {
        debug(`Session token not found in conversation response ${JSON.stringify(body)}`)
        throw new Error('Session token not found in conversation response', body)
      }
      if (!body.sessionId) {
        debug(`Session id not found in conversation response ${JSON.stringify(body)}`)
        throw new Error('Session id not found in conversation response', body)
      }

      debug(`Conversation initiated: ${JSON.stringify(body, null, 2)}`)
      this.sessionToken = body.sessionToken
      this.sessionId = body.sessionId
    })
  }

  async _sendMessage ({ msg, justWelcomeMessage }) {
    const headers = {
      // eslint-disable-next-line quote-props
      'Authorization': `Bearer ${this.accessToken}`,
      'X-Inbenta-Key': this.caps[Capabilities.INBENTA_API_KEY],
      'X-Inbenta-Session': `Bearer ${this.sessionToken}`
    }
    let body

    if (justWelcomeMessage) {
      body = {
        directCall: 'sys-welcome'
      }
    } else if (msg.buttons && msg.buttons.length > 0 && (msg.buttons[0].payload || msg.buttons[0].text)) {
      body = {
        option: msg.buttons[0].payload || msg.buttons[0].text
      }
    } else {
      body = {
        message: msg.messageText
      }
    }

    // removing html, and new line
    const normalize = (s) => s.replace(/<[^>]*>?/gm, '').replace('\n', ' ')
    const requestOptions = {
      uri: this.chatbotAPI + PATH_CONVERSATION_MESSAGE,
      method: 'POST',
      headers,
      body,
      json: true,
      transform: _includeRequest
    }

    debug(`constructed requestOptions for conversation step ${JSON.stringify(requestOptions, null, 2)}`)

    return rp(requestOptions).then(({ response, body }) => {
      if (response.statusCode >= 400) {
        debug(`got error response: ${response.statusCode}/${response.statusMessage}`)
        throw new Error(`got error response: ${response.statusCode}/${response.statusMessage}`)
      }
      debug(`Conversation response: ${JSON.stringify(body, null, 2)}`)
      const answers = body.answers || []
      for (const a of answers) {
        const botMsg = { sourceData: a, messageText: normalize(a.messageList.join(' ')) }
        let intent
        if (a.parameters && a.parameters.contents && a.parameters.contents.title) {
          intent = { name: a.parameters.contents.title, confidence: a.intent ? a.intent.score : null }
        } else if (a.attributes && a.attributes.title) {
          // teoretically its the same, but who knows?
          intent = { name: a.attributes.title, confidence: a.intent ? a.intent.score : null }
        } else if (a.intent) {
          intent = { name: a.intent.type, confidence: a.intent.score }
        }
        if (intent) {
          if (intent.name === 'No Results') {
            intent.incomprehension = true
          }
          // Inbenta returns confidence score between 0 and 2. Dividing by 2 does not looks as a good idea,
          // because for exact match I got 1.15
          if (intent.confidence && intent.confidence > 1) {
            intent.confidence = 1
          }
          botMsg.nlp = { intent }
        }

        if (a.type === 'answer' && a.messageList && a.messageList.length) {
          setTimeout(() => this.queueBotSays(botMsg), 0)
        } else if (a.type === 'polarQuestion' || a.type === 'multipleChoiceQuestion') {
          botMsg.buttons = a.options.map(b => { return { text: b.label, payload: b.value } })
          setTimeout(() => this.queueBotSays(botMsg), 0)
        }
      }
    }).catch(err => {
      debug(`Failed to send message ${err}`)
      throw new Error(`Failed to send message ${err}`)
    })
  }
}

module.exports = BotiumConnectorInbentaWebhook
