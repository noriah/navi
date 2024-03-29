const path = require('path')

const { Collection } = require('../util')
const { Responder, Resolver } = require('../managers')
const Base = require('./Base')

const catchMessages = ['INSUFFICIENT_ARGS', 'string.ONE_OF']

/**
 * Built-in command class
 * @extends {Base}
 * @abstract
 * @prop {Resolver} resolver Command resolver
 * @prop {Responder} responder Command responder
 * @prop {Collection} subcommands Collection of subcommands
 * @prop {Map} timers Map of timer cooldowns
 */
class Command extends Base {
  /**
   * Creates a new Command instance
   * @arg {Client} client Client instance
   * @arg {...Object} args Command options
   */
  constructor (client, ...args) {
    super(client)
    if (this.constructor === Command) {
      throw new Error('Must extend abstract Command')
    }

    const resolver = this.resolver = new Resolver(client)
    if (!client.noDefaults) {
      resolver.loadResolvers(path.join(__dirname, '..', 'resolvers'))
    }
    if (client._resolvers) {
      resolver.loadResolvers(client._resolvers)
    }

    this.responder = new Responder(this)
    this.subcommands = new Collection()
    this.timers = new Map()

    this._options = args.reduce((p, c) => Object.assign(c, p), {})
  }

  /**
   * Verifies the options passed to the constructor
   * @arg {Object} args Options passed to the Command constructor
   * @private
   */
  set _options (args = {}) {
    const {
      name,
      description,
      group,
      aliases = [],
      cooldown = 5,
      usage = [],
      options = {},
      subcommands = {},
      subcommand,
      examples = []
    } = args

    this.triggers = typeof name === 'string'
      ? [name].concat(aliases)
      : (Array.isArray(aliases) && aliases.length > 0 ? aliases : [])

    if (!this.triggers.length) {
      throw new Error(`${this.constructor.name} command is not named`)
    }

    this.name = name
    this.description = description
    this.cooldown = cooldown
    this.options = options
    if (this.options.modOnly) {
      this.options.permissions = (options.permissions || []).concat('manageGuild')
    }

    this.group = group
    this.usage = usage
    this.localeKey = options.localeKey
    this.resolver.load(usage)

    for (const command in subcommands) {
      const name = subcommands[command].name || command
      for (const alias of [name].concat(subcommands[command].aliases || [])) {
        this.subcommands.set(alias, {
          name,
          usage: subcommands[command].usage || [],
          options: subcommands[command].options || {},
          examples: subcommands[command].examples || []
        })
      }
    }
    this.subcommand = subcommand
    this.examples = examples
  }

  /**
   * Checks the validaty of a command and executes it
   * @arg {Container} container Container context
   * @returns {Promise}
   */
  execute (container) {
    const responder = this.responder.create(container)

    let prefix = (container.settings || {}).prefix || this._client.prefix
    let usage = this.usage
    let examples = this.examples
    let process = 'handle'

    const subcmd = this.subcommand ? this.subcommand : container.rawArgs[0]
    const cmd = this.subcommands.get(subcmd)
    if (cmd) {
      usage = cmd.usage
      examples = cmd.examples
      process = cmd.name
      container.rawArgs = container.rawArgs.slice(this.subcommand ? 0 : 1)
      container.trigger += ' ' + subcmd
    }

    if (!this.check(container, responder, cmd)) return

    let data = { prefix, command: container.trigger }

    return this.resolver.resolve(container.msg, container.rawArgs, data, usage)
      .then((args = {}) => {
        container.args = args
        return this[process](container, responder)
      }, err => {
        if (catchMessages.indexOf(err.message) !== -1) {
          let correctUsage = this.resolver.getUsage(usage, data)
          let lang = (container.settings || {}).lang || 'en'
          return responder.error(this.generateUsageError(
            prefix, correctUsage, examples, container.trigger, lang))
        }
        return responder.error(`{{%errors.${err.message}}}`, err)
      })
  }

  generateUsageError (prefix, usage, examples, trigger = '', lang = 'en') {
    let example = (examples[~~(Math.random() * examples.length)] || {}).args || ''

    let ret = [
      '{{%errors.usage.LINE_USAGE}}',
      example !== '' ? ':white_small_square:  |  {{%errors.usage.LINE_EXAMPLE}}' : '\n\n',
      ':white_small_square:  |  {{%errors.usage.LINE_HELP}}'
    ].join('\n').replace('\n\n\n', '')

    example = `${prefix}${trigger} ${example}`

    let command = `${prefix}help ${trigger.replace(' ', '.')}`

    ret = this.t(ret, lang, {
      usage,
      example,
      command
    })

    return ret
  }

  /**
   * Checks if a command is valid, run in `execute()`
   * @arg {Container} container Container context
   * @arg {Responder} responder Responder instance
   * @arg {Command} [subcmd] Subcommand
   */
  check ({ msg, isPrivate, admins, client }, responder, subcmd) {
    const isAdmin = admins.includes(msg.author.id)
    const { guildOnly, permissions = [], botPerms = [] } = subcmd ? subcmd.options : this.options
    const adminOnly = (subcmd && subcmd.options.adminOnly) || this.options.adminOnly

    if (adminOnly === true && !isAdmin) {
      return false
    }

    if (guildOnly === true && isPrivate) {
      responder.error('{{%errors.NO_PMS}}')
      return false
    }

    if (permissions.length && !(isAdmin || this.hasPermissions(msg.channel, msg.author, ...permissions))) {
      responder.error('{{%errors.NO_PERMS}}', {
        perms: permissions.map(p => `\`${p}\``).join(', ')
      })
      return false
    }

    if (botPerms.length && !this.hasPermissions(msg.channel, client.user, ...botPerms)) {
      responder.error('{{%errors.NO_PERMS_BOT}}', {
        perms: botPerms.map(p => `\`${p}\``).join(', ')
      })
      return false
    }

    if (isAdmin) return true
    const awaitID = msg.author.id
    if (this.cooldown > 0) {
      const now = Date.now() / 1000 | 0
      if (!this.timers.has(awaitID)) {
        this.timers.set(awaitID, now)
      } else {
        const diff = now - this.timers.get(awaitID)
        if (diff < this.cooldown) {
          responder.format('emoji:hourglass').reply('{{%errors.ON_COOLDOWN}}', {
            delay: 0,
            deleteDelay: 5000,
            time: `**${this.cooldown - diff}**`
          })
          return false
        } else {
          this.timers.delete(awaitID)
          this.timers.set(awaitID, now)
        }
      }
    }
    return true
  }

  /**
   * Command handler
   * @arg {Container} container Container object
   * @arg {Responder} responder Responder instance
   */
  async handle (container, responder) { return true }

  get permissionNode () {
    return `${this.group}.${this.triggers[0]}`
  }
}

module.exports = Command
