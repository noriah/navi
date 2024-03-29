'use strict'

module.exports = {
  createUrbanDictEmbed: function (term, list, offset = 1) {
    offset = offset <= 0 ? 1 : offset
    offset--
    let items = list.slice(0 + offset, 3 + offset)

    let defs = []

    items.forEach(item => {
      offset++
      let insert = `**#${offset}** - ${item.definition}`
      if (insert.length > 512) {
        insert = insert.slice(0, 512) + '...'
      }
      defs.push(insert)
    })

    return {
      title: term,
      author: {
        name: 'Urban Dictionary',
        url: 'https://urbandictionary.com'
      },
      url: `https://www.urbandictionary.com/define.php?term=${term}`,
      description: defs.join('\n\n'),
      footer: {
        text: 'Urban Dictionary Lookup'
      },
      timestamp: new Date(),
      color: 0x1D2439
    }
  }
}
