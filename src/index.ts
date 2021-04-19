import { context } from '@actions/github'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import quote from 'quote'

import { execCommandOptions } from './shared'
import npmInstall from './packages'
import reportFailed from './report-failed'

const testsPath = core.getInput('tests-path')

const runTests = async (options: any = {}) => {
  const opts = {
    ...execCommandOptions,
  }
  const cmd = ['cypress', 'run']

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

  if (options.testsPath) {
    cmd.push('--spec')
    cmd.push(options.testsPath)
  }

  const npxPath = await io.which('npx', true)

  await exec.exec(quote(npxPath), cmd, opts)
}

const run = async () => {
  core.debug(`action : ${context.action}`);
  core.debug(`ref : ${context.ref}`);
  core.debug(`eventName : ${context.eventName}`);
  core.debug(`actor : ${context.actor}`);
  core.debug(`sha : ${context.sha}`);
  core.debug(`workflow : ${context.workflow}`);

  try {
    await npmInstall()

    core.info(`using ${testsPath} file to test`)

    await runTests({ testsPath })

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