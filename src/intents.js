const _ = require('lodash')
const rp = require('request-promise-native')
const { BotDriver } = require('botium-core')
const { runInbentaAuth } = require('./helper')
const debug = require('debug')('botium-connector-inbenta-intents')

const getCaps = (caps) => {
  const result = caps || {}
  return result
}

const CONTENT_PAGE_SIZE = 100

const importInbentaIntents = async ({ caps, versionId, buildconvos }) => {
  const driver = new BotDriver(getCaps(caps))
  const container = await driver.Build()

  if (!container.pluginInstance.caps.INBENTA_EDITOR_API_KEY) throw new Error('INBENTA_EDITOR_API_KEY capability required')
  if (!container.pluginInstance.caps.INBENTA_EDITOR_SECRET) throw new Error('INBENTA_EDITOR_SECRET capability required')
  if (!container.pluginInstance.caps.INBENTA_EDITOR_PERSONAL_SECRET) throw new Error('INBENTA_EDITOR_PERSONAL_SECRET capability required')

  const allContent = []

  let inbentaAuth = null
  for (let page = 0; ; page++) {
    inbentaAuth = await runInbentaAuth({
      apiVersion: container.pluginInstance.caps.INBENTA_API_VERSION || 'v1',
      apiKey: container.pluginInstance.caps.INBENTA_EDITOR_API_KEY,
      secret: container.pluginInstance.caps.INBENTA_EDITOR_SECRET,
      personalSecret: container.pluginInstance.caps.INBENTA_EDITOR_PERSONAL_SECRET
    }, inbentaAuth)
    if (!inbentaAuth.apis['chatbot-editor']) throw new Error('No Chatbot Editor API endpoint available for these credentials')

    const requestOptions = {
      uri: `${inbentaAuth.apis['chatbot-editor']}/${container.pluginInstance.caps.INBENTA_API_VERSION || 'v1'}/contents`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${inbentaAuth.accessToken}`,
        'X-Inbenta-Key': container.pluginInstance.caps.INBENTA_EDITOR_API_KEY
      },
      qs: {
        length: CONTENT_PAGE_SIZE,
        offset: page * CONTENT_PAGE_SIZE
      },
      json: true,
      transform: (body, response) => ({ response, body })
    }
    debug(`Constructed requestOptions for content page ${page}: ${JSON.stringify(requestOptions, null, 2)}`)

    const { body, response } = await rp(requestOptions)
    if (response.statusCode >= 400) {
      debug(`got error response: ${response.statusCode}/${response.statusMessage}`)
      throw new Error(`got error response: ${response.statusCode}/${response.statusMessage}`)
    }
    if (body && body.data && body.data.items && body.data.items.length > 0) {
      debug(`Got ${body.data.items.length} content items for content page ${page}`)
      body.data.items.forEach(i => allContent.push(i))
      if (body.data.items.length < CONTENT_PAGE_SIZE) {
        break
      }
    } else {
      break
    }
  }

  const convos = []
  const utterances = []

  const validContent = allContent.filter(c => c.directCall)

  debug(`Got ${validContent.length} valid NLU content items, ignoring ${allContent.length - validContent.length} content items because no directCall`)
  for (const content of validContent) {
    const intentName = content.directCall

    const phrases = [
      content.directCall,
      content.title
    ]
    if (content.naturalLanguageTitleMatching) {
      const alternativeTitles = content.attributes && content.attributes.find(a => a.name === 'ALTERNATIVE_TITLE')
      if (alternativeTitles && alternativeTitles.objects && alternativeTitles.objects.length > 0) {
        alternativeTitles.objects.forEach(o => phrases.push(o.value))
      }
    }
    const moderateExpanded = content.attributes && content.attributes.find(a => a.name === 'MODERATE_EXPANDED')
    if (moderateExpanded && moderateExpanded.objects && moderateExpanded.objects.length > 0) {
      moderateExpanded.objects.forEach(o => phrases.push(o.value))
    }
    utterances.push({ name: intentName, utterances: _.uniq(phrases.filter(p => p)) })
  }

  if (buildconvos) {
    for (const utterance of utterances) {
      const convo = {
        header: {
          name: utterance.name
        },
        conversation: [
          {
            sender: 'me',
            messageText: utterance.name
          },
          {
            sender: 'bot',
            asserters: [
              {
                name: 'INTENT',
                args: [utterance.name]
              }
            ]
          }
        ]
      }
      convos.push(convo)
    }
  }
  return { convos, utterances }
}

module.exports = {
  importHandler: ({ caps, buildconvos, ...rest } = {}) => importInbentaIntents({ caps, buildconvos, ...rest }),
  importArgs: {
    caps: {
      describe: 'Capabilities',
      type: 'json',
      skipCli: true
    },
    buildconvos: {
      describe: 'Build convo files for intent assertions (otherwise, just write utterances files)',
      type: 'boolean',
      default: false
    }
  }
}
