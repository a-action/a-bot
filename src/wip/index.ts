import { Probot } from 'probot'
import { Status } from './status'

export namespace WIP {
  export function start(app: Probot) {
    app.on(
      [
        'pull_request.opened',
        'pull_request.edited',
        'pull_request.labeled',
        'pull_request.unlabeled',
        'pull_request.synchronize',
      ],
      async (context) => {
        try {
          const nextState = await Status.get(context)
          context.log(`[wip] Next status: ${JSON.stringify(nextState)}`)
          await Status.update(context, nextState)

          // const hasChange = await Status.hasChange(context, nextState)
          // const status = nextState.wip ? 'work in progress' : 'ready for review'
          // if (hasChange) {
          //   context.log(`[wip] Status changed: ${status}`)
          // } else {
          //   context.log(`[wip] Status not changed: ${status}`)
          // }
        } catch (err) {
          context.log(`[wip] Exceptions: ${err.message}`)
        }
      },
    )
  }
}
