'use strict'

const { NaviModule } = require.main.require('./lib')

class CoreModule extends NaviModule {
  constructor (...args) {
    super(...args, {
      name: 'core',
      description: 'Core commands and components',
      services: true,
      commands: true,
      middleware: true,
      tasks: true
    })
  }

  getModulePath () { return __dirname }
}

module.exports = CoreModule
