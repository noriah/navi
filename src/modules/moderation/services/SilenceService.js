'use strict'

const Enum = require('enum')
const moment = require('moment')

const { NaviService } = require.main.require('./lib')

const lockResults = new Enum(['SUCCESS', 'ERROR_ALREADY_LOCKED'])
const unlockResults = new Enum(['SUCCESS', 'ERROR_NOT_LOCKED'])
const silenceResults = new Enum([
  'SUCCESS',
  'ERROR_IS_BOT',
  'ERROR_ALREADY_SILENCED'
])

const unsilenceResults = new Enum([
  'SUCCESS',
  'ERROR_IS_BOT',
  'ERROR_NOT_SILENCED'
])

class SilenceService extends NaviService {
  constructor (...args) {
    super(...args, {
      name: 'Silence'
    })
  }

  get silenceResults () { return silenceResults }

  get unsilenceResults () { return unsilenceResults }

  get lockResults () { return lockResults }

  get unlockResults () { return unlockResults }

  silence (member, time) {
    if (member.bot) {
      return Promise.reject(this.silenceResults.ERROR_IS_BOT)
    }

    let guildId = member.guild.id
    let userId = member.id
    let timeout = time ? moment().add(time, 's').toDate() : 0

    return this.client.db.Gag.findOne({ guildId, userId })
      .then(dbGag => {
        if (dbGag) {
          return Promise.reject(this.silenceResults.ERROR_ALREADY_SILENCED)
        }
        return this.client.db.Gag.create({ userId, guildId, timeout })
      })
      .then(() => this.silenceResults.SUCCESS)
  }

  unsilence (member) {
    if (member.bot) {
      return Promise.reject(this.unsilenceResults.ERROR_IS_BOT)
    }

    let guildId = member.guild.id
    let userId = member.id

    return this.client.cache.mod.del(`silence:${guildId}:member:${userId}`)
      .then(() => this.client.db.Gag.findOne({ guildId, userId }))
      .then(dbGag => {
        if (!dbGag) {
          return Promise.reject(this.unsilenceResults.ERROR_NOT_SILENCED)
        }
        return dbGag.remove()
      })
      .then(() => this.unsilenceResults.SUCCESS)
  }

  _isItemSilenced (cacheKey, search) {
    let modCache = this.client.cache.mod
    let gagDB = this.client.db.Gag

    return modCache.get(cacheKey)
      .then(data => {
        if (!data) {
          return gagDB.findOne(search)
            .then(dbItem => {
              if (!dbItem) {
                return false
              }

              if (!dbItem.timeout) {
                return modCache.set(cacheKey, 1)
                  .return(true)
              }

              let diff = moment().diff(dbItem.timeout, 'seconds')
              if (diff >= 0) {
                return dbItem.remove()
                  .then(() => modCache.del(cacheKey))
                  .return(false)
              }

              diff = Math.abs(diff)
              return modCache.set(cacheKey, 1, 'EX', diff).return(true)
            })
        }
        return data
      })
  }

  lockChannel (channel, time) {
    let guildId = channel.guild.id
    let channelId = channel.id
    let timeout = time ? moment().add(time, 's').toDate() : 0

    return this.client.db.Gag.findOne({ guildId, channelId })
      .then(dbGag => {
        if (dbGag) {
          return Promise.reject(this.lockResults.ERROR_ALREADY_LOCKED)
        }
        return this.client.db.Gag.create({ channelId, guildId, timeout })
      })
      .then(() => this.lockResults.SUCCESS)
  }

  unlockChannel (channel) {
    let guildId = channel.guild.id
    let channelId = channel.id

    return this.client.cache.mod.del(`silence:${guildId}:channel:${channelId}`)
      .then(() => this.client.db.Gag.findOne({ guildId, channelId }))
      .then(dbGag => {
        if (!dbGag) {
          return Promise.reject(this.unlockResults.ERROR_NOT_LOCKED)
        }

        return dbGag.remove()
      })
      .then(() => this.unlockResults.SUCCESS)
  }

  isMemberSilenced (member) {
    let userId = member.id
    let guildId = member.guild.id

    let cacheKey = `silence:${guildId}:member:${userId}`
    let search = { guildId, userId }

    return this._isItemSilenced(cacheKey, search)
  }

  isChannelInLockdown (channel) {
    let channelId = channel.id
    let guildId = channel.guild.id

    let cacheKey = `silence:${guildId}:channel:${channelId}`
    let search = { guildId, channelId }

    return this._isItemSilenced(cacheKey, search)
  }
}

module.exports = SilenceService
