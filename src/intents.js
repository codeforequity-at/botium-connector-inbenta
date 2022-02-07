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

const getContent = async ({ caps }) => {
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
      transform: (body, response) => ({
        response,
        body
      })
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


  const validContent = allContent.filter(c => c.title && c.status === 'active')
  debug(`Got ${validContent.length} valid NLU content items, ignoring ${allContent.length - validContent.length} content items because no title, or not active`)

  return {
    validContent: allContent.filter(c => c.title && c.status === 'active'),
    inbentaAuth
  }
}

/*
It is update if intent has id
 */
const createUpdateIntent = async (container, intent, inbentaAuth) => {
  if (!container.pluginInstance.caps.INBENTA_EDITOR_API_KEY) throw new Error('INBENTA_EDITOR_API_KEY capability required')
  if (!container.pluginInstance.caps.INBENTA_EDITOR_SECRET) throw new Error('INBENTA_EDITOR_SECRET capability required')
  if (!container.pluginInstance.caps.INBENTA_EDITOR_PERSONAL_SECRET) throw new Error('INBENTA_EDITOR_PERSONAL_SECRET capability required')

  if (!intent.id) {
    // create new intents in default folder
    intent.categories = [1]
    intent.status = 'active'
    intent.attributes.push({
      'name': 'ANSWER_TEXT',
      'objects': [
        {
          'value': 'To find your past orders, click here to go to your Order History page.'
        }
      ]
    })

    intent =
      {
          "title": "How to find your past orders",
          "categories": [
              1,
              2,
              3
          ],
          "status": "active",
          "useForPopular": true,
          "attributes": [
              {
                  "name": "ANSWER_TEXT",
                  "objects": [
                      {
                          "value": "To find your past orders, click here to go to your Order History page."
                      }
                  ]
              }
          ]
      }
  }
  inbentaAuth = await runInbentaAuth({
    apiVersion: container.pluginInstance.caps.INBENTA_API_VERSION || 'v1',
    apiKey: container.pluginInstance.caps.INBENTA_EDITOR_API_KEY,
    secret: container.pluginInstance.caps.INBENTA_EDITOR_SECRET,
    personalSecret: container.pluginInstance.caps.INBENTA_EDITOR_PERSONAL_SECRET
  }, inbentaAuth)
  if (!inbentaAuth.apis['chatbot-editor']) throw new Error('No Chatbot Editor API endpoint available for these credentials')

  const requestOptions = {
    uri: `${inbentaAuth.apis['chatbot-editor']}/${container.pluginInstance.caps.INBENTA_API_VERSION || 'v1'}/contents${intent.id ? '/' + intent.id : ''}`,
    method: intent.id ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${inbentaAuth.accessToken}`,
      'X-Inbenta-Key': container.pluginInstance.caps.INBENTA_EDITOR_API_KEY
    },
    body: {
      "title": "How to find your past orders",
      "categories": [
        1,
        2,
        3
      ],
      "status": "active",
      "useForPopular": true,
      "attributes": [
        {
          "name": "ANSWER_TEXT",
          "objects": [
            {
              "value": "To find your past orders, click here to go to your Order History page."
            }
          ]
        }
      ]
    },
    json: true,
    transform: (body, response) => ({
      response,
      body
    })
  }
  debug(`Constructed requestOptions for intent ${intent.id}: ${JSON.stringify(requestOptions, null, 2)}`)

  const { body, response } = await rp(requestOptions)
  if (response.statusCode >= 400) {
    debug(`got error response: ${response.statusCode}/${response.statusMessage}`)
    throw new Error(`got error response: ${response.statusCode}/${response.statusMessage}`)
  }

  return inbentaAuth
}

const importInbentaIntents = async ({ caps, versionId, buildconvos }) => {

  const driver = new BotDriver(getCaps(caps))
  const container = await driver.Build()
  const { validContent } = await getContent({ container })

  const convos = []
  const utterances = []

  debug(`Got ${validContent.length} valid NLU content items, ignoring ${allContent.length - validContent.length} content items because no title`)
  for (const content of validContent) {
    const intentName = content.title

    const phrases = [
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
    // intent name is not unique in inbenta. For us, it is. We can work just on the first
    // Same for export. So if the order is not constant, it can happen that we overwrite the wrong intent on export.
    if (!utterances.find(u => u.intentName === intentName)) {
      utterances.push({
        name: intentName,
        utterances: _.uniq(phrases.filter(p => p))
      })
    } else {
      debug(`It looks like intent name ${intentName} is not unique`)
    }
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
  return {
    convos,
    utterances
  }
}

const exportInbentaIntents = async ({ caps, deleteOldUtterances }, { utterances, convos }) => {
  const driver = new BotDriver(getCaps(caps))
  const container = await driver.Build()
  let { validContent, inbentaAuth } = await getContent({ container })

  const setCheckedUtterances = new Set()
  for (const content of validContent) {
    const intentName = content.title
    let botiumUtterances = (utterances.find(u => u.name === intentName) || {}).utterances
    if (setCheckedUtterances.has(intentName) || !botiumUtterances) {
      //  setCheckedUtterances.has(intentName):
      // intent name is not unique in inbenta. For us, it is. We can work just on the first
      // Same for import. So if the order is not constant, it can happen that we overwrite the wrong intent on export.
      continue
    }
    setCheckedUtterances.push(intentName)

    const inbentaUtterances = [
      content.title
    ]
    let deleted = 0
    let inserted = 0

    content.attributes = content.attributes || []
    let alternativeTitles = content.attributes.find(a => a.name === 'ALTERNATIVE_TITLE')
    if (!alternativeTitles) {
      alternativeTitles = {
        name: 'ALTERNATIVE_TITLE',
        objects: []
      }
      content.attributes.push(alternativeTitles)
    }

    if (alternativeTitles.objects.length > 0) {
      alternativeTitles.objects.forEach(o => inbentaUtterances.push(o.value))
      if (deleteOldUtterances && botiumUtterances) {
        const newObjects = alternativeTitles.objects.filter(o => !botiumUtterances.includes(o.value))
        deleted += alternativeTitles.objects.length - newObjects.length
        alternativeTitles.objects = newObjects
      }
    }
    const moderateExpanded = content.attributes && content.attributes.find(a => a.name === 'MODERATE_EXPANDED')
    if (moderateExpanded && moderateExpanded.objects && moderateExpanded.objects.length > 0) {
      moderateExpanded.objects.forEach(o => inbentaUtterances.push(o.value))
      if (deleteOldUtterances && botiumUtterances) {
        const newObjects = moderateExpanded.objects.filter(o => !botiumUtterances.includes(o.value))
        deleted += moderateExpanded.objects.length - newObjects.length
        moderateExpanded.objects = newObjects
      }
    }
    if (botiumUtterances) {
      const utterancesToAdd = botiumUtterances.utterances.filter(u => !inbentaUtterances.includes(u))
      added += utterancesToAdd.length
      if (utterancesToAdd.length > 0) {
        alternativeTitles.objects = alternativeTitles.objects.concat(utterancesToAdd)
      }
    }
    if (added || deleted) {
      const intentToUpdate = {
        id: content.id,
        attributes: content.attributes
      }
      try {
        inbentaAuth = await createUpdateIntent(container, intentToUpdate, inbentaAuth)
        debug(`Updated intent ${intentName} added ${added} deleted ${deleted}`)
      } catch (err) {
        throw new Error(`Failed to update intent. ${err.message || err}:  ${JSON.stringify(intentToUpdate)}`)
      }

    }
  }

  for (const utteranceStruct of utterances) {
    if (setCheckedUtterances.has(utteranceStruct.name)) {
      continue
    }

    let utterancesToWrite
    if (!utteranceStruct.utterances || utteranceStruct.utterances.length === 0 || utteranceStruct.name !== utteranceStruct.utterances[0]) {
      debug(`Utterance "${utteranceStruct.name}" is not inbenta compatible`)
      utterancesToWrite = [...(utteranceStruct.utterances || [])]
    } else {
      utterancesToWrite = utteranceStruct.utterances.slice(1)
    }

    const intentToWrite = {
      title: utteranceStruct.name,
      attributes: [{
        'name': 'ALTERNATIVE_TITLE',
        'objects': utterancesToWrite.map(u => ({
          value: u
        }))
      }]
    }
    try {
      inbentaAuth = await createUpdateIntent(container, intentToWrite, inbentaAuth)
      debug(`Intent "${utteranceStruct.name}" is created with ${utterancesToWrite.length} alternatives`)
    } catch (err) {
      throw new Error(`Failed to create intent. ${err.message || err}:  ${JSON.stringify(intentToWrite)}`)
    }
  }
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
  },
  exportHandler: ({ caps, deleteOldUtterances, ...rest } = {}, { convos, utterances } = {}, { statusCallback } = {}) => exportInbentaIntents({
    caps,
    deleteOldUtterances,
    ...rest
  }, {
    convos,
    utterances
  }, { statusCallback }),
  exportArgs: {
    caps: {
      describe: 'Capabilities',
      type: 'json',
      skipCli: true
    },
    deleteOldUtterances: {
      describe: 'Delete old utterances',
      type: 'boolean',
      default: true
    }
  }

}
