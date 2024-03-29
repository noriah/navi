'use strict'

module.exports = {
  name: 'silencedUsers',
  priority: 6,
  process: container => {
    const { msg, client, isPrivate } = container

    if (isPrivate) {
      return Promise.resolve(container)
    }

    let member = msg.member

    return client.services.Silence.isMemberSilenced(member)
      .then(result => {
        if (!result) {
          return container
        }

        return msg.delete('User silenced').return(null)
      })
  }
}
