'use strict'

const R = require('ramda')

const { Command } = require.main.require('./sylphy')

const { MissingTokenError } = require.main.require('./lib')

class CalendarCommand extends Command {
  constructor (...args) {
    super(...args, {
      name: 'calendar',
      description: 'Calendar Management Commands',
      usage: [
        {
          name: 'subcmd',
          choices: [ 'authorize', 'select', 'notify' ],
          type: 'string'
        }
      ],
      options: {
        guildOnly: true,
        permissions: [
          'administrator'
        ],
        hidden: false
      },
      examples: [
        {
          args: 'authorize',
          description: 'Authorize Navi to use your google calendar'
        },
        {
          args: 'select',
          description: 'Select a google calendar to use for notifications'
        },
        {
          args: 'notify',
          description: 'Enable or disable calendar notifications'
        }
      ],
      subcommands: {
        authorize: {
          name: 'authorize',
          aliases: ['auth', 'authenticate'],
          options: {
            guildOnly: true,
            permissions: ['administrator']
          }
        },
        select: {
          name: 'select',
          aliases: ['pick', 'choose'],
          options: {
            guildOnly: true,
            permissions: ['administrator']
          }
        },
        notify: {
          name: 'notify',
          aliases: ['enable', 'toggle'],
          options: {
            guildOnly: true,
            permissions: ['administrator']
          }
        }
      }
    })
  }

  async handle ({ msg, client }, responder) {

  }

  async authorize ({ msg, client }, responder) {
    await responder.typing()

    let guildId = msg.channel.guild.id

    let google = client.api.google

    return client.db.Guild.findOneOrCreate({ guildId }, { guildId })
      .then(dbGuild => {
        let authClient = google.getAuthClient()
        let authUrl = google.getAuthUrl(authClient)

        return responder.dialog([{
          prompt: `Authorize the bot by visiting this url: \n\n ${authUrl} \n\n Respond with the code from that page`,
          input: { name: 'response', type: 'string' }
        }])
          .then(response => google.getToken(authClient, response.response))
          .then(token => {
            dbGuild.tokens.google = token
            dbGuild.markModified('tokens')
            return dbGuild.save()
          })
      })
      .then(() => responder.send('Now call `n!calendar select` to select a calendar'))
  }

  async select ({ msg, client }, responder) {
    await responder.typing()

    let google = client.api.google

    let guildId = msg.channel.guild.id
    return client.db.Guild.findOne({ guildId })
      .populate('connections')
      .then(dbGuild => {
        if (!dbGuild) {
          return Promise.reject(new MissingTokenError())
        }
        let authClient = google.getAuthClient(dbGuild.tokens.google)
        google.ensureAuthCredentials(authClient)
        return google.getCalendarList(authClient)
          .then(calendars => {
            let options = R.map(R.prop('summary'), calendars.items)
            return responder.selection(options, {
              title: 'Select Calendar'
            }).then(selection => {
              return responder.typing().then(() => {
                let item = calendars.items[selection[1]]

                let connection = R.find(R.propEq('type', 'google#calendarId'), dbGuild.connections)
                if (!connection) {
                  return client.db.Connection.create({
                    guildId,
                    type: 'google#calendarId',
                    value: item.id
                  })
                }
                connection.value = item.id
                return connection.save()
              })
                .then(() => responder.success('Calendar Selected!'))
            })
          })
      })
      .catch(MissingTokenError, () => {
        return responder.error('Missing authentication token for guild!\n\t\t\tPlease call `n!calednar auth` first!')
      })
  }

  async notify ({ msg, client }, responder) {
    await responder.typing()

    let guildId = msg.channel.guild.id

    let options = ['enable', 'disable']

    return client.db.Guild.findOne({ guildId })
      .then(dbGuild => {
        return responder.selection(options, {
          title: 'Enable or Disable notifications'
        })
          .then(response => {
            dbGuild.settings.enableNotifications = (response[0] === 'enable')
            dbGuild.markModified('settings')
            return dbGuild.save()
              .then(responder.success(`Calendar notifications have been ${response[0]}d`))
          })
      })
  }
}

module.exports = CalendarCommand
