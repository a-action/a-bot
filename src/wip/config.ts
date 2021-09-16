import yaml from 'js-yaml'
import { Context, Location } from './types'

export interface Config {
  terms: string[]
  locations: Location[]
}

export namespace Config {
  export const defaults: Config = {
    locations: ['title', 'label'],
    terms: [
      'wip',
      'work in progress',
      'work-in-progress',
      'do not merge',
      'do-not-merge',
      'rfc',
      '🚧',
    ],
  }

  const readfile = async (context: Context, path: string) => {
    try {
      const { data } = await context.octokit.repos.getContent(
        context.repo({
          path,
          owner: context.payload.repository.owner.login,
          repo: context.payload.repository.name,
        }),
      )
      const { content } = data as any
      return content ? Buffer.from(content, 'base64').toString() : null
    } catch (err) {
      return null
    }
  }

  export async function get(
    context: Context,
  ): Promise<{ configs: Config[]; manual: boolean }> {
    try {
      const configPath = './.github/apps/wip.yml'
      const content = await readfile(context, configPath)
      if (content) {
        const config = yaml.load(content) as Config | Config[]
        if (config) {
          if (typeof config === 'object') {
            const configs = Array.isArray(config) ? config : [config]
            const keys: (keyof Config)[] = ['terms', 'locations']
            configs.forEach((entry) => {
              keys.forEach((key) => {
                if (!entry[key]) {
                  entry[key] = defaults[key] as any
                } else {
                  if (!Array.isArray(entry[key])) {
                    entry[key] = [entry[key] as any]
                  }

                  entry[key] = (entry[key] as any).map((item: any) => `${item}`)
                }
              })
            })

            context.log(
              `[wip] Use manual configuration: ${JSON.stringify([defaults])}`,
            )

            return {
              configs,
              manual: true,
            }
          }

          context.log(
            `[wip] Invalid configuration: "${config}". Fallback to use default configuration: ${JSON.stringify(
              [defaults],
            )}`,
          )
        }
      }
    } catch (error) {
      // pass
    }

    context.log(
      `[wip] Use default configuration: ${JSON.stringify([defaults])}`,
    )

    return {
      configs: [defaults],
      manual: false,
    }
  }
}
