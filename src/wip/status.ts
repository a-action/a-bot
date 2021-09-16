import { Context, Location } from './types'
import { Config } from './config'
import { Matcher } from './matcher'
import { Output } from './output'

export namespace Status {
  export interface State {
    wip: boolean
    override?: boolean
    configs?: Config[]
    manual?: boolean
    location?: Location
    text?: string
    match?: string
  }

  const getCommitSubjects = async (context: Context) => {
    const { data: commits } = await context.octokit.pulls.listCommits(
      context.repo({
        pull_number: context.payload.pull_request.number,
      }),
    )

    return commits.map((e) => e.commit.message.split('\n')[0])
  }

  export async function get(context: Context): Promise<State> {
    const { pull_request: pr } = context.payload
    const labels: string[] = pr.labels.map((label: any) => label.name)
    const title = pr.title || ''
    const body = pr.body || ''

    if (/@wip ready for review/i.test(body)) {
      return {
        wip: false,
        override: true,
      }
    }

    const { configs, manual } = await Config.get(context)
    const checkCommit = configs.some((entry) =>
      entry.locations.some((loc) => loc === 'commit'),
    )
    const subjects = checkCommit ? await getCommitSubjects(context) : null

    for (let i = 0; i < configs.length; i += 1) {
      const { locations, terms } = configs[i]
      const match = Matcher.generate(locations, terms)

      const result =
        match('title', title) ||
        match('label', labels) ||
        match('commit', subjects)

      if (result) {
        return {
          configs,
          manual,
          wip: true,
          ...result,
        }
      }
    }

    return {
      configs,
      manual,
      wip: false,
    }
  }

  const checkName = 'WIP'

  export async function hasChange(context: Context, nextState: State) {
    const {
      data: { check_runs: checkRuns },
    } = await context.octokit.checks.listForRef(
      context.repo({
        ref: context.payload.pull_request.head.sha,
        check_name: checkName,
      }),
    )

    context.log(
      `[wip] Found ${checkRuns.length} checkrun${
        checkRuns.length > 1 ? 's' : ''
      }`,
    )

    if (checkRuns.length === 0) {
      return true
    }

    const [{ conclusion, output }] = checkRuns
    const isWip = conclusion !== 'success'
    const override = output && output.title && /override/.test(output.title)

    context.log(
      `[wip] Found check run: ${JSON.stringify({ conclusion, output })}`,
    )

    return isWip !== nextState.wip || override !== nextState.override
  }

  export async function update(
    context: Context,
    nextState: State,
  ): Promise<any> {
    const options: {
      name: string
      status?: 'in_progress' | 'completed' | 'queued'
      conclusion?:
        | 'success'
        | 'failure'
        | 'neutral'
        | 'cancelled'
        | 'skipped'
        | 'timed_out'
        | 'action_required'
      started_at?: string // eslint-disable-line camelcase
      completed_at?: string // eslint-disable-line camelcase
    } = {
      name: checkName,
    }

    if (nextState.wip) {
      options.status = 'in_progress'
      options.started_at = new Date().toISOString()
    } else {
      options.status = 'completed'
      options.conclusion = 'success'
      options.completed_at = new Date().toISOString()
    }

    const output = Output.get(context, nextState)

    context.log(`[wip] Create check run.`)
    context.log(`  metadata: ${JSON.stringify(options)}`)
    context.log(`  output: ${JSON.stringify(output)}`)

    const metadata = {
      ...options,
      output,
      head_sha: context.payload.pull_request!.head.sha,

      // workaround for https://github.com/octokit/rest.js/issues/874
      head_branch: '',

      // workaround random "Bad Credentials" errors
      // https://github.community/t5/GitHub-API-Development-and/Random-401-errors-after-using-freshly-generated-installation/m-p/22905/highlight/true#M1596
      request: {
        retries: 3,
        retryAfter: 3,
      },
    }

    return context.octokit.checks.create(context.repo(metadata))
  }
}
