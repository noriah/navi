'use strict'

const { Command } = require('sylphy')

class EnableAuditChannelCommand extends Command {
  constructor (...args) {
    super(...args, {
      name: 'auditchannel',
      group: 'audit',
      description: 'Set an audit channel for the bot to report to',
      usage: [{
        name: 'channel',
        displayName: 'auditChannel',
        type: 'channel'
      }],
      options: {
        guildOnly: true,
        requirements: {
          permissions: {
            administrator: true
          }
        },
        hidden: false
      }
    })
  }

  async handle ({ msg, client, args }, responder) {
    let guildId = msg.channel.guild.id

    return client.guildManager.get(guildId)
      .then(naviGuild => {
        naviGuild.db.channels.audit = args.channel[0].id
        naviGuild.db.markModified('channels')
        return naviGuild.db.save()
      })
      .then(() => responder.success('the audit log channel has been set!'))
      .catch(err => client.raven.captureException(err))
  }
}

module.exports = EnableAuditChannelCommand