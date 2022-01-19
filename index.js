const fs = require('fs')
const path = require('path')
const PluginClass = require('./src/connector')
const { importHandler, importArgs } = require('./src/intents')

const logo = fs.readFileSync(path.join(__dirname, 'logo.png')).toString('base64')

module.exports = {
  PluginVersion: 1,
  PluginClass: PluginClass,
  Import: {
    Handler: importHandler,
    Args: importArgs
  },
  PluginDesc: {
    name: 'Inbenta',
    provider: 'Inbenta',
    avatar: logo,
    features: {
      intentResolution: true,
      intentConfidenceScore: true,
      testCaseGeneration: true,
      testCaseExport: false
    },
    capabilities: [
      {
        name: 'INBENTA_API_KEY',
        label: 'API key',
        type: 'string',
        required: true,
        advanced: false
      },
      {
        name: 'INBENTA_SECRET',
        label: 'API secret',
        type: 'secret',
        required: true,
        advanced: false
      },
      {
        name: 'INBENTA_ENV',
        label: 'Environment',
        type: 'choice',
        required: false,
        advanced: true,
        choices: [
          { key: 'development', name: 'Development' },
          { key: 'preproduction', name: 'Preproduction' },
          { key: 'production', name: 'Production' }
        ]
      },
      {
        name: 'INBENTA_API_VERSION',
        label: 'API version',
        type: 'string',
        required: false,
        advanced: true
      },
      {
        name: 'INBENTA_SOURCE',
        label: 'Source',
        type: 'string',
        required: false,
        advanced: true
      },
      {
        name: 'INBENTA_USER_TYPE',
        label: 'User type',
        type: 'int',
        required: false,
        advanced: true
      },
      {
        name: 'INBENTA_SKIP_WELCOME_MESSAGE',
        label: 'Skip welcome message request on conversation start',
        type: 'boolean',
        required: false,
        advanced: true
      },
      {
        name: 'INBENTA_EDITOR_API_KEY',
        label: 'Chatbot Editor API key',
        description: 'Used for downloading NLU model only. You can find this in Administration / Chatbot Editor API',
        type: 'string',
        required: false,
        advanced: false
      },
      {
        name: 'INBENTA_EDITOR_SECRET',
        label: 'Chatbot Editor API secret',
        description: 'Used for downloading NLU model only. You can find this in Administration / Chatbot Editor API',
        type: 'secret',
        required: false,
        advanced: false
      },
      {
        name: 'INBENTA_EDITOR_PERSONAL_SECRET',
        label: 'Personal secret token',
        description: 'Used for downloading NLU model only. You can find this in My Account / Personal Secret Tokens',
        type: 'secret',
        required: false,
        advanced: false
      }
    ]
  }
}
