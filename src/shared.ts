import * as core from '@actions/core'

export const workDir = process.env.GITHUB_WORKSPACE

export const setFailed = (error: string | Error) => {
  core.setFailed(error)

  process.exit(1)
}

export const debug = (message: string) => {
  core.debug(message)
}

export const execCommandOptions = {
  cwd: workDir,
  windowsVerbatimArguments: false,
}