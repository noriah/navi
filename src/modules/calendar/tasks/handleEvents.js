'use strict'

const R = require('ramda')
const moment = require('moment')

const { calendarUtil } = require('../util')

function handleEvents () {
  let self = this

  let guildIds = R.keys(self.guildShardMap)

  let google = this.api.google

  return Promise.map(guildIds, guildId => {
    return self.db.Guild.findOne({ guildId }).then(dbGuild => {
      if (!dbGuild || !dbGuild.calendarId || !dbGuild.tokens.google) {
        return false
      }
      if (dbGuild.settings.enableNotifications === false) {
        return false
      }

      let timeAdd = dbGuild.settings.timeBefore || 30

      let authClient = google.getAuthClient(dbGuild.tokens.google)

      return google.getCalendarUpcomingEvents(authClient, dbGuild.calendarId, {
        maxResults: 10,
        timeMax: moment().add(timeAdd, 'minutes').toISOString()
      }).then(events => {
        let eventIds = R.map(R.prop('id'), events)

        Promise.each(self.db.Event.find({
          guildId: guildId,
          eventId: {
            $in: eventIds
          }
        }).then(foundEvents => {
          return R.differenceWith((x, y) => {
            return x.id === y.eventId
          }, events, foundEvents)
        }), event => {
          let params = calendarUtil.getParameters(event)

          if (!params) {
            return false
          }

          let erisGuild = self.guilds.get(guildId)

          let foundChannel = R.find(channel => {
            return (!!channel.name) &&
            channel.name.toLowerCase() === params.channel &&
            channel.type === 0
          }, erisGuild.channels)

          if (!foundChannel) {
            return false
          }

          let message = '**Hey, Listen!**'

          if (params.role) {
            let foundRole = R.find(role => {
              return role.name.toLowerCase() === params.role &&
              role.mentionable === true
            }, erisGuild.roles)

            if (foundRole) {
              message = message + ' ' + foundRole.mention
            }
          }

          let dbEvent = new self.db.Event({
            guildId: guildId,
            eventId: params.eventId,
            channelId: foundChannel.id,
            sentAt: new Date(),
            endsAt: params.endDateTime
          })

          let embed = calendarUtil.createEmbed(params)

          self.createMessage(foundChannel.id, {
            content: message,
            embed
          }).then(() => dbEvent.save())
        })
      })
    })
  })
}

module.exports = handleEvents