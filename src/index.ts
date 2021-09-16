import { Probot } from 'probot'
import { WIP } from './wip'

export = (app: Probot) => {
  app.onAny(async (context) => {
    app.log.info(`event: ${context.name}`)
  })

  WIP.start(app)
}
