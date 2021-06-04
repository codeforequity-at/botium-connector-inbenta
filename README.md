# Botium Connector for Inbenta 

[![NPM](https://nodei.co/npm/botium-connector-inbenta.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/botium-connector-inbenta/)

[![Codeship Status for codeforequity-at/botium-connector-inbenta](https://app.codeship.com/projects/913b9260-f570-0136-2f32-1e71af04627f/status?branch=master)](https://app.codeship.com/projects/320855)
[![npm version](https://badge.fury.io/js/botium-connector-inbenta.svg)](https://badge.fury.io/js/botium-connector-inbenta)
[![license](https://img.shields.io/github/license/mashape/apistatus.svg)]()

This is a [Botium](https://github.com/codeforequity-at/botium-core) connector for testing your Inbenta chatbot.

__Did you read the [Botium in a Nutshell](https://medium.com/@floriantreml/botium-in-a-nutshell-part-1-overview-f8d0ceaf8fb4) articles ? Be warned, without prior knowledge of Botium you won't be able to properly use this library!__

## How it works?
It can be used as any other Botium connector with all Botium Stack components:
* [Botium CLI](https://github.com/codeforequity-at/botium-cli/)
* [Botium Bindings](https://github.com/codeforequity-at/botium-bindings/)
* [Botium Box](https://www.botium.at)

## Requirements

* __Node.js and NPM__
* a __Inbenta chatbot with [Webhook channel](https://developer.kore.ai/docs/bots/bot-builder/adding-channels-to-your-bot/adding-webhook-channel/) enabled__
* a __project directory__ on your workstation to hold test cases and Botium configuration

## Install Botium and Kore.ai Webhook Connector

When using __Botium CLI__:

```
> npm install -g botium-cli
> npm install -g botium-connector-inbenta
> botium-cli init
> botium-cli run
```

When using __Botium Bindings__:

```
> npm install -g botium-bindings
> npm install -g botium-connector-inbenta
> botium-bindings init mocha
> npm install && npm run mocha
```

When using __Botium Box__:

_Already integrated into Botium Box, no setup required_

## Connecting your Inbenta chatbot to Botium

Open the file _botium.json_ in your working directory and add the Webhook settings.

```
{
  "botium": {
    "Capabilities": {
      "PROJECTNAME": "<whatever>",
      "CONTAINERMODE": "inbenta",
      "INBENTA_API_KEY": "...",
      "INBENTA_SECRET": "..."
    }
  }
}
```
Botium setup is ready, you can begin to write your [BotiumScript](https://github.com/codeforequity-at/botium-core/wiki/Botium-Scripting) files.

## Supported Capabilities

Set the capability __CONTAINERMODE__ to __inbenta__ to activate this connector.

### INBENTA_API_KEY
The API KEY from Inbenta App

### INBENTA_SECRET
The SECRET from Inbenta App

### INBENTA_SOURCE
Source identifier (e.g. facebook, mobile, etc.) used to filter the logs in the Dashboards. You can use any value.

### INBENTA_USER_TYPE
Profile identifier from the Inbenta Backstage knowledge base. Minimum:0. Default:0

### INBENTA_ENV
Resource environment from the Inbenta knowledge base to which the request is applied. Each environment logs the data for the reports displayed in Inbenta dashboards separately. Possible values:
 - production (default): This environment retrieves the contents/categories published in live.
 - preproduction: This environment retrieves the contents/categories published in live.
 - development: This environment retrieves the contents/categories published in edit.

### INBENTA_LANG
Language of the bot, represented by its ISO 639-1 code.

### INBENTA_TIMEZONE
User timezone with a valid TZ database name value. If this attribute is set, user's local time will be added in the conversation history.

### INBENTA_SKIP_WELCOME_MESSAGE
Skip welcome message request on conversation start.

Example: "America/New_York"
