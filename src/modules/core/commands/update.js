'use strict'

const Git = require('nodegit')

const exec = require('child_process').exec

const R = require('ramda')

const { Command, utils } = require.main.require('./sylphy')

class UpdateCommand extends Command {
  constructor (...args) {
    super(...args, {
      name: 'update',
      description: 'Pull updates and update dependencies. Restart bot',
      options: {
        adminOnly: true
      }
    })
  }

  async handle ({ msg, client }, responder) {
    let callbacks = {
      credentials: (url, username) => Git.Cred.sshKeyFromAgent(username),
      certificateCheck: () => 1
    }

    return responder.format('emoji:loading').send('Checking for updates')
      .then(sentMsg => Promise.resolve(Git.Repository.open(process.cwd()))
        .then(repo => repo.getCurrentBranch()
          .then(ref => repo.getRemote('origin')
            .then(remote => remote.connect(0, callbacks)
              .then(() => remote.referenceList())
              .then(list => {
                let refName = ref.name()
                let item = R.find(item => item.name() === refName, list)
                if (item.oid().equal(ref.target())) {
                  let err = {gitUpToDate: true}
                  return Promise.reject(err)
                }
              })
              .then(() => remote.disconnect())
              .then(() => sentMsg.edit(`${utils.emojis['updating']}  |  Pulling Updates...`))
              .then(() => repo.fetch(remote, { callbacks }))
              .then(() => {
                let branchName = R.last(ref.name().split('/'))
                return repo.mergeBranches(branchName, `origin/${branchName}`)
              })
            )
          )
        )
        .then(() => sentMsg.edit(`${utils.emojis['updating']}  |  Updating dependencies...`))
        .then(() => new Promise((resolve, reject) => {
          let npm = exec('npm install', (err, stdout, stderr) => {
            if (stderr !== null) {
              client.logger.error(stderr.toString())
            }

            if (stdout !== null) {
              client.logger.info(stdout.toString())
            }

            if (err !== null) {
              client.logger.error(err.toString())
            }
          })
          npm.on('close', code => {
            if (code !== 0) {
              return reject(new Error(`npm install failed with code '${code}'`))
            }

            return resolve()
          })
        }))
        .then(() => sentMsg.edit(`${utils.emojis['success']}  |  Update complete! Restarting...`))
        .then(() => {
          process.send({op: 'restart'})
        })
        .catch({gitUpToDate: true}, () => {
          return sentMsg.edit(`${utils.emojis['success']}  |  Up to date!`)
        })
        .catch(err => {
          let error = err.Error || err
          return sentMsg.edit(`${utils.emojis['error']}  |  Update failed!\`\`\`${error}\`\`\``)
        })
      )
  }
}

module.exports = UpdateCommand
