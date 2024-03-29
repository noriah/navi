'use strict'

const R = require('ramda')
const SteamID = require('steamid')

const { SteamUtils } = require('../../util')

const { Command } = require.main.require('./sylphy')

class SteamLookupCommand extends Command {
  constructor (...args) {
    super(...args, {
      name: 'steam',
      description: 'Lookup a users profile',
      usage: [{
        name: 'member',
        displayName: 'user',
        type: 'member',
        optional: true
      }],
      cooldown: 30,
      options: {
        guildOnly: true,
        hidden: true
      }
    })
  }

  async handle ({ msg, client, args }, responder) {
    let member = msg.member
    let isSelf = true

    if (args.member && args.member[0].id !== member.id) {
      member = args.member[0]
      isSelf = false
    }

    return client.userBot.getUserProfile(member.id)
      .then(profile => {
        let steamConnection = R.find(R.propEq('type', 'steam'), profile.connected_accounts)
        if (!steamConnection) {
          return responder.error(`{{%steam.errors.NOT_LINKED${isSelf ? '_SELF' : ''}}}`, {
            user: member.username
          })
        }

        let steamId = new SteamID(steamConnection.id)
        return client.api.steam.getUserSummary(steamId.getSteamID64())
          // .then(data => {
          //   if (data.visibilityState === 3) {
          //     if (data.gameId) {
          //       return client.api.steam.getGameDetails(data.gameId)
          //         .then(details => {
          //           data.gameDetails = details
          //           console.log(details)
          //           return data
          //         })
          //     }
          //   }

          //   return data
          // })
          .then(data => SteamUtils.createSteamProfileEmbed(member, data, steamId))
          .then(embed => responder
            .embed(embed)
            .reply(`{{%steam.lookup.HEADER${isSelf ? '_SELF' : ''}}}`, {
              user: member.username
            })
          )
      })
      .catch(err => client.raven.captureException(err))
  }
}

module.exports = false
