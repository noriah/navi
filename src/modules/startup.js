'use strict'

const chalk = require('chalk')

const { Module } = require('sylphy')

class StartupModule extends Module {
  constructor (...args) {
    super(...args, {
      name: 'navi:startup',
      events: {
        ready: 'onReady',
        error: 'onError',
        warn: 'onWarn'
        // debug: 'onDebug'
      }
    })
  }

  onReady () {
    const guilds = this._client.guilds.size
    const users = this._client.users.size
    const channels = Object.keys(this._client.channelGuildMap).length

    this.logger.info(
      `G: ${chalk.green.bold(guilds)} | ` +
      `C: ${chalk.green.bold(channels)} | ` +
      `U: ${chalk.green.bold(users)}`
    )
    this.logger.info(`Prefix: ${chalk.cyan.bold(this._client.prefix)}`)
  }

  onError (err, id = -1) {
    this.logger.error(`Shard ${id} - `, err)
    this._client.raven.captureException(err)
  }

  onWarn (msg, id = -1) {
    this.logger.warn(`Shard ${id} - ${msg}`)
    // this._client.raven.captureMessage(msg, {
    //   level: 'warning',
    //   extra: { shardId: id }
    // })
  }

  onDebug (msg, id = -1) {
    this.logger.debug(`Shard ${id} - ${msg}`)
  }
}

module.exports = StartupModule
