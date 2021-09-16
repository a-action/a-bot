import { Context as CommonContext } from 'probot'

export type Context = CommonContext<'pull_request'>
export type Location = 'title' | 'label' | 'commit'
