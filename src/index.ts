import { context } from '@actions/github'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import quote from 'quote'

import { execCommandOptions, workDir } from './shared'
import npmInstall from './packages'
import reportFailed from './report-failed'

const spec = core.getInput('spec')

const runTests = async (options: any = {}) => {
  const opts = {
    ...execCommandOptions,
  }

  const cmd = []

  const envInput = core.getInput('env')
  if (envInput) {
    // TODO should env be quoted?
    // If it is a JSON, it might have spaces
    cmd.push('--env')
    cmd.push(envInput)
  }

  const configInput = core.getInput('config')
  if (configInput) {
    cmd.push('--config')
    cmd.push(configInput)
  }

  const browserInput = core.getInput('browser')
  if (browserInput) {
    cmd.push('--browser')
    cmd.push(browserInput)
  }

  const cypressApiUrl = core.getInput('cypress_api_url')
  if (cypressApiUrl) {
    cmd.push(`CYPRESS_API_URL="${cypressApiUrl}"`)
  }

  if (options.spec) {
    cmd.push('--spec')
    cmd.push(options.spec)
  }

  let date = new Date();

  await exec.exec(`npx cy2 run --parallel --record --key merged --ci-build-id "${date.toString()} | ${browserInput} | ${options.spec}"`, cmd, opts)
}

const run = async () => {
  core.debug(`action : ${context.action}`);
  core.debug(`ref : ${context.ref}`);
  core.debug(`eventName : ${context.eventName}`);
  core.debug(`actor : ${context.actor}`);
  core.debug(`sha : ${context.sha}`);
  core.debug(`workflow : ${context.workflow}`);
  core.debug(`workingDirectory : ${workDir}`);

  try {
    await npmInstall()

    core.info(`using ${spec} file to test`)

    await runTests({ spec })

    core.debug('all done, exiting')

    // force exit to avoid waiting for child processes,
    // see https://github.com/actions/toolkit/issues/216
    process.exit(0)
  } catch (err) {
    await reportFailed()

    console.log('error received while executing tests', err)

    core.setFailed(err.message)
  }
}

run()
