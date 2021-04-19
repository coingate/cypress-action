import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import quote from 'quote'
import path from 'path'
import os from 'os'
import hasha from 'hasha'
import { restoreCache, saveCache } from 'cache/lib'

import { debug, setFailed, execCommandOptions } from './shared'

const homeDirectory = os.homedir()
const lockHash = hasha.fromFileSync('package-lock.json')
const platformAndArch = `${process.platform}-${process.arch}`

/**
 * When running "npm install" or any other Cypress-related commands,
 * use the install directory as current working directory
 */
// enforce the same NPM cache folder across different operating systems
export default async () => {
  const npmCacheHit = await restoreCachedNpm()
  const cypressCacheHit = await restoreCachedCypressBinary()

  core.debug(`npm cache hit ${npmCacheHit}`)
  core.debug(`cypress cache hit ${cypressCacheHit}`)

  // prevent lots of progress messages during install
  core.exportVariable('CI', '1')
  core.exportVariable('CYPRESS_CACHE_FOLDER', CYPRESS_CACHE_FOLDER)

  core.debug('installing NPM dependencies')
  core.exportVariable('npm_config_cache', NPM_CACHE_FOLDER)

  const npmPath = await io.which('npm', true)

  core.debug(`npm at "${npmPath}"`)

  const exitCode = await exec.exec(quote(npmPath), ['ci'], execCommandOptions)
  if (exitCode != 0) {
    setFailed('failed to npm ci')
  }

  if (npmCacheHit && cypressCacheHit) {
    core.debug('no need to verify Cypress binary or save caches')
  } else {
    await verifyCypressBinary()
    await saveCachedNpm()
    await saveCachedCypressBinary()
  }
}

export const restoreCachedNpm = () => {
  debug('trying to restore cached NPM modules')

  return restoreCache(
    NPM_CACHE.inputPath,
    NPM_CACHE.primaryKey,
    NPM_CACHE.restoreKeys
  )
}

export const restoreCachedCypressBinary = () => {
  debug('trying to restore cached Cypress binary')

  return restoreCache(
    CYPRESS_BINARY_CACHE.inputPath,
    CYPRESS_BINARY_CACHE.primaryKey,
    CYPRESS_BINARY_CACHE.restoreKeys
  )
}

export const verifyCypressBinary = async () => {
  debug('Verifying Cypress')
  core.exportVariable('CYPRESS_CACHE_FOLDER', CYPRESS_CACHE_FOLDER)

  const npxPath = await io.which('npx', true)

  const exitCode = await exec.exec(
    quote(npxPath),
    ['cypress', 'verify'],
    execCommandOptions
  )
  if (exitCode != 0) {
    setFailed('failed to verify cypress')
  }
}

export const saveCachedNpm = () => {
  core.debug('saving NPM modules')

  return saveCache(NPM_CACHE.inputPath, NPM_CACHE.primaryKey)
}

export const saveCachedCypressBinary = () => {
  core.debug('saving Cypress binary')

  return saveCache(
    CYPRESS_BINARY_CACHE.inputPath,
    CYPRESS_BINARY_CACHE.primaryKey
  )
}

const NPM_CACHE_FOLDER = path.join(homeDirectory, '.npm')
const NPM_CACHE = (() => {
  const o = <any>{}
  let key = core.getInput('cache-key')

  if (!key) {
    key = `npm-${platformAndArch}-${lockHash}`
  } else {
    console.log('using custom cache key "%s"', key)
  }

  o.inputPath = NPM_CACHE_FOLDER
  o.restoreKeys = o.primaryKey = key

  return o
})()

// custom Cypress binary cache folder
// see https://on.cypress.io/caching
const CYPRESS_CACHE_FOLDER = path.join(homeDirectory, '.cache', 'Cypress')
core.debug(`using custom Cypress cache folder "${CYPRESS_CACHE_FOLDER}"`)

const CYPRESS_BINARY_CACHE = (() => {
  const o = <any>{
    inputPath: CYPRESS_CACHE_FOLDER,
    restoreKeys: `cypress-${platformAndArch}-`,
  }

  o.primaryKey = o.restoreKeys + lockHash

  return o
})()