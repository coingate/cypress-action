import path from 'path'
import { context } from '@actions/github'
import * as core from '@actions/core'
import { Storage } from '@google-cloud/storage'
import nanoid from 'nanoid'
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

    const jobName = slugify(context.action)
    const isoDate = new Date().toISOString().split('T')[0]
    const randomID = nanoid(10)

    const dirName = `${jobName}/${isoDate}/${randomID}`

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

const slugify = (text: string) => {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}