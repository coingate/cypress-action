import { merge } from 'mochawesome-merge'
import mareport from 'mochawesome-report-generator'
import util from 'util'
import glob from 'glob'

import { workDir, debug, setFailed } from '../shared'

const promiseGlob = util.promisify(glob)

export default async () => {
  try {
    // Check if reports exists
    const jsonFiles = await promiseGlob(`${workDir}/cypress/reports/mochawesome/*.json`)

    debug(`founded mochawsome files: ${jsonFiles.join(', ')}`)

    if (jsonFiles.length < 1) {
      return [null, null]
    }

    debug('merging mochawesome reports')

    const report = await merge({
      rootDir: workDir,
      reportDir: 'cypress/reports/mochawesome',
    })

    if (!report) {
      throw new Error('failed to generate report json')
    }

    debug('generating mochawesome HTML')

    const htmlReport = await mareport.create(report, {
      reportDir: `${workDir}/cypress/reports/`,
      cdn: true,
      charts: true,
    })

    return [htmlReport[0], report]
  } catch (err) {
    setFailed(err)
  }
}