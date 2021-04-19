import * as core from '@actions/core'
import { Storage } from '@google-cloud/storage'
import nanoid from 'nanoid'
import path from 'path'
import fs from 'fs'

import { workDir, debug, setFailed } from '../shared'
import generateMochawesome from './generate-mochawesome'
import slackNotify from './slack-notify'

const bucketName = core.getInput('bucket-name')
const gcloudAuth = core.getInput('gcloud-auth')

export default async () => {
  debug('starting failure report')

  try {
    const [htmlReportFilePath, jsonReport] = await generateMochawesome()

    if (jsonReport == null) {
      return
    }

    const date = new Date()

    const dirName = `${date.getUTCFullYear()}${date.getUTCMonth() +
      1}${date.getUTCDay() +
      1}${date.getUTCHours()}${date.getUTCMinutes()}${date.getUTCSeconds()}UTC-${nanoid(
      10
    )}`

    await uploadToGCloud(dirName)

    await slackNotify(jsonReport, dirName)
  } catch (err) {
    setFailed(err)
  }
}

const deriveKeyfile = async () => {
  const keyFilepath = `${workDir}/google-auth.json`

  await fs.promises.writeFile(keyFilepath, gcloudAuth, { encoding: 'base64' })

  return keyFilepath
}

const uploadToGCloud = async dirName => {
  debug(`uploading to gcloud dir : ${dirName}`)

  const keyFilename = await deriveKeyfile()

  const storage = new Storage({ keyFilename })

  debug(`creating Storage with bucket : ${bucketName}`)

  await storage
    .bucket(bucketName)
    .upload(`${workDir}/cypress/reports/mochawesome.html`, {
      destination: `${dirName}/mochawesome.html`,
    })

  await uploadDirectory(`${workDir}/cypress/screenshots`, storage, dirName)
  await uploadDirectory(`${workDir}/cypress/videos`, storage, dirName)
}

const uploadDirectory = async (directoryPath, storage, dirName) => {
  debug(`starting upload directoryPath : ${directoryPath} ; dirName : ${dirName}`)

  const pathDirName = path.dirname(directoryPath)
  const fileList = []

  const getFiles = async directory => {
    const items = await fs.promises.readdir(directory)

    await Promise.all(
      items.map(async item => {
        const fullPath = path.join(directory, item)

        const stat = await fs.promises.stat(fullPath)

        if (stat.isFile()) {
          fileList.push(fullPath)
        } else if (stat.isDirectory()) {
          await getFiles(fullPath)
        }
      })
    )
  }

  await getFiles(directoryPath)

  await uploadFiles(storage, fileList, pathDirName, dirName)
}

const uploadFiles = async (storage, fileList, pathDirName, dirName) => {
  debug(`uploading files : ${fileList.join(', ')} ; pathDirName : ${pathDirName} ; dirName : ${dirName}`)

  const resp = await Promise.all(
    fileList.map(async filePath => {
      let destination = `${dirName}/${path.relative(pathDirName, filePath)}`

      try {
        const uploadResp = await storage
          .bucket(bucketName)
          .upload(filePath, { destination })

        return { fileName: destination, status: uploadResp[0] }
      } catch (err) {
        return { fileName: destination, response: err }
      }
    })
  )

  const successfulUploads =
    fileList.length - resp.filter((r: any) => r.status instanceof Error).length

  debug(`${successfulUploads} files uploaded to ${bucketName} successfully.`)
}