const _ = require('lodash')
const { BotDriver } = require('botium-core')
const { runInbentaAuth } = require('./helper')
const debug = require('debug')('botium-connector-inbenta-intents')

const getCaps = (caps) => {
  const result = caps || {}
  return result
}

const CONTENT_PAGE_SIZE = 100

const getContent = async ({ container }) => {
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
      }
    }
    debug(`Constructed requestOptions for content page ${page}: ${JSON.stringify(requestOptions, null, 2)}`)

    const response = await fetch(new URL('?' + new URLSearchParams(requestOptions.qs).toString(), requestOptions.uri).toString(), requestOptions)
    if (!response.ok) {
      debug(`got error response: ${response.status}/${response.statusText}`)
      throw new Error(`got error response: ${response.status}/${response.statusText}`)
    }
    const body = await response.json()
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
      'X-Inbenta-Key': container.pluginInstance.caps.INBENTA_EDITOR_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(intent)
  }
  debug(`Constructed requestOptions for intent ${intent.title}-${intent.id || 'NO-ID'}: ${JSON.stringify(requestOptions, null, 2)}`)

  const response = await fetch(requestOptions.uri, requestOptions)
  if (!response.ok) {
    debug(`got error response: ${response.status}/${response.statusText}`)
    throw new Error(`got error response: ${response.status}/${response.statusText}`)
  }

  return inbentaAuth
}

const importInbentaIntents = async ({ caps, versionId, buildconvos }) => {
  const driver = new BotDriver(getCaps(caps))
  const container = await driver.Build()
  const { validContent } = await getContent({ container })

  const convos = []
  const utterances = []

  for (const content of validContent) {
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
    if (!utterances.find(u => u.intentName === content.title)) {
      const utterance = {
        name: buildconvos ? content.title.replace(/ /g, '_') + '_utt' : content.title,
        externalId: `${content.id}`,
        utterances: _.uniq(phrases.filter(p => p))
      }
      utterances.push(utterance)
      const getAttributeEntry = (fieldname) => {
        const struct = content.attributes && content.attributes.find(a => a.name === fieldname)
        if (!struct || !struct.objects || struct.objects.length === 0) {
          return ''
        }
        return struct.objects[0].value
      }
      if (buildconvos) {
        const botMessage = getAttributeEntry('ANSWER_TEXT')
        const sidebubble = getAttributeEntry('SIDEBUBBLE_TEXT')
        const convo = {
          header: {
            name: content.title,
            externalId: `${content.id}`
          },
          conversation: [
            {
              sender: 'me',
              messageText: utterance.name
            },
            {
              sender: 'bot',
              messageText: botMessage + sidebubble,
              asserters: [
                {
                  name: 'INTENT',
                  args: [content.title]
                }
              ]
            }
          ]
        }
        convos.push(convo)
      }
    } else {
      debug(`It looks like intent name ${content.title} is not unique`)
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
    // searching for utterance via name. Maybe it is not created via connector export
    const byExternalId = utterances.find(u => u.externalId && u.externalId === `${content.id}`)
    const botiumUtterancesStruct = byExternalId || utterances.find(u => !u.externalId && u.name === content.title) || {}
    const botiumUtterances = botiumUtterancesStruct.utterances
    let deleted = 0
    let added = 0
    let intentNameChanged = false
    intentNameChanged = botiumUtterancesStruct.name !== content.title
    if (setCheckedUtterances.has(botiumUtterancesStruct.name) || !botiumUtterances) {
      // intent name is not unique in inbenta. For us, it is. We can work just on the first
      // Same for import. So if the order is not constant, it can happen that we overwrite the wrong intent on export.
      continue
    }
    setCheckedUtterances.add(botiumUtterancesStruct.name)

    const inbentaUtterances = [
      content.title
    ]

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
      if (deleteOldUtterances) {
        const newObjects = alternativeTitles.objects.filter(o => botiumUtterances.includes(o.value))
        deleted += alternativeTitles.objects.length - newObjects.length
        alternativeTitles.objects = newObjects
      }
    }
    const moderateExpanded = content.attributes && content.attributes.find(a => a.name === 'MODERATE_EXPANDED')
    if (moderateExpanded && moderateExpanded.objects && moderateExpanded.objects.length > 0) {
      moderateExpanded.objects.forEach(o => inbentaUtterances.push(o.value))
      if (deleteOldUtterances) {
        const newObjects = moderateExpanded.objects.filter(o => !botiumUtterances.includes(o.value))
        deleted += moderateExpanded.objects.length - newObjects.length
        moderateExpanded.objects = newObjects
      }
    }
    if (botiumUtterances) {
      const utterancesToAdd = botiumUtterances.filter(u => !inbentaUtterances.includes(u))
      added += utterancesToAdd.length
      if (utterancesToAdd.length > 0) {
        alternativeTitles.objects = alternativeTitles.objects.concat(utterancesToAdd.map(u => ({ value: u })))
      }
    }
    if (added || deleted || intentNameChanged) {
      const intentToUpdate = {
        id: content.id,
        title: botiumUtterancesStruct.name,
        attributes: content.attributes
      }
      try {
        inbentaAuth = await createUpdateIntent(container, intentToUpdate, inbentaAuth)
        debug(`Updated intent (by ${byExternalId ? 'id: ' + content.id : 'title: ' + content.title}) ${botiumUtterancesStruct.name} added ${added} deleted ${deleted} title changed ${intentNameChanged}`)
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
        name: 'ALTERNATIVE_TITLE',
        objects: utterancesToWrite.map(u => ({
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
      describe: 'Delete samples in Inbenta Knowledge Base not exist in a Botium utterance (If a Botium utterance is missing, then the samples in Inbenta Knowledge Base will be intact)',
      type: 'boolean',
      default: false
    }
  }
}
