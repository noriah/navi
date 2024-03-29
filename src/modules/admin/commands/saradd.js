'use strict'

const { Command } = require.main.require('./sylphy')

class IAmAddCommand extends Command {
  constructor (...args) {
    super(...args, {
      name: 'saradd',
      aliases: ['addsar'],
      description: 'Add a Self-Assignable role',
      usage: [
        { name: 'role', displayName: 'role', type: 'role' },
        { name: 'group', displayName: 'group#', type: 'int', min: 0, optional: true }
      ],
      examples: [
        {
          args: 'Radioactive',
          description: 'add the Radioactive role to the list of self-assignable roles'
        }
      ],
      options: {
        guildOnly: true,
        permissions: ['manageRoles']
      }
    })
  }

  async handle ({ msg, client, args }, responder) {
    let role = args.role[0]
    let group = args.group || 0

    let SARService = client.services.SelfAssignedRoles

    return SARService.add(role, group)
      .then(() => {
        return responder.success('{{iamadd.SUCCESS}}', {
          role: role.name
        })
      })
      .catch(SARService.addResults.ERROR_ALREADY_EXIST, () => {
        return responder.error('{{iamadd.ERROR}}', {
          role: role.name
        })
      })
  }
}

module.exports = IAmAddCommand
