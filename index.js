const PluginClass = require('./src/connector')

module.exports = {
  PluginVersion: 1,
  PluginClass: PluginClass,
  PluginDesc: {
    name: 'Inbenta',
    provider: 'Inbenta',
    features: {
      intentResolution: true,
      intentConfidenceScore: true
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
      }
    ]
  }
}
