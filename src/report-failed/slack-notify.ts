import * as github from '@actions/github'
import * as core from '@actions/core'
import util from 'util'
import glob from 'glob'
import { WebClient } from '@slack/web-api'

import { setFailed, debug } from '../shared'

const promiseGlob = util.promisify(glob)
const { context } = github

const githubToken = core.getInput('github-token');
// An access token (from your Slack app or custom integration - xoxp, xoxb)
const token = core.getInput('slack-token')
// This argument can be a channel ID, a DM ID, a MPDM ID, or a group ID
const conversationId = core.getInput('slack-channel')
const config = core.getInput('config')
const bucketName = core.getInput('bucket-name')
const slackMention = core.getInput('slack-mention')

const octokit = github.getOctokit(githubToken);

const web = new WebClient(token)

if (!token) {
  setFailed('SLACK_TOKEN missing')
}

if (!conversationId) {
  setFailed('SLACK_CHANNEL missing')
}

export default async (report, dirName) => {
  debug('sending Slack notification')

  const baseURL = `https://storage.googleapis.com/${bucketName}/${dirName}`
  const mediaFiles = await promiseGlob('cypress/**/*.+(png|mp4)')
  const mediaURLs = []

  const makeFileURL = filePath => {
    return `${baseURL}/${filePath
      .replace('cypress/', '')
      .replace('cypress/', '')}`
  }

  mediaFiles.forEach(filePath => {
    // mediaURLs.push(file.split('/').slice(-1)[0])
    mediaURLs.push(makeFileURL(filePath))
  })

  debug(`generated media urls : ${mediaURLs.join(', ')}`)

  const slackBlocks: any = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Whopz! Looks like test has fallen! Here is the report:',
      },
    },
  ]

  const findTestsInSuites = parentSuite => {
    if (parentSuite.tests && parentSuite.tests.length) {
      parentSuite.tests.forEach(test => {
        if (test.state != 'failed') {
          return
        }

        const slackBlock: any = {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${test.fullTitle}*\n\n>${test.err.message.replace(
              /(\r\n|\n|\r)/gm,
              ''
            )}`,
          },
        }

        const imageURL = encodeFileURL(
          mediaURLs.find(fileURL =>
            fileURL.match(new RegExp(`.*${test.title}.*`, 'g'))
          )
        )

        if (imageURL) {
          slackBlock.accessory = {
            type: 'image',
            image_url: imageURL,
            alt_text: test.fullTitle,
          }
        }

        slackBlocks.push(slackBlock)
      })
    }

    if (parentSuite.suites && parentSuite.suites.length) {
      parentSuite.suites.forEach(suite => {
        findTestsInSuites(suite)
      })
    }
  }

  report.results.forEach(result => {
    findTestsInSuites(result)
  })

  const screenshots = []
  const videos = []

  mediaURLs.forEach(url => {
    const filename = url.split('/').slice(-1)[0]
    const encodedURL = encodeFileURL(url)

    if (url.match(/.*\.png/)) {
      screenshots.push(`<${encodedURL}|${filename}>`)
    } else if (url.match(/.*\.mp4/)) {
      videos.push(`<${encodedURL}|${filename}>`)
    }
  })

  if (screenshots.length || videos.length) {
    const fields: any = {
      type: 'section',
      fields: [],
    }

    if (screenshots.length) {
      fields.fields.push({
        type: 'mrkdwn',
        text: `*Screenshots:*\n${screenshots.join('\n')}`,
      })
    }

    if (videos.length) {
      fields.fields.push({
        type: 'mrkdwn',
        text: `*Videos:*\n${videos.join('\n')}`,
      })
    }

    slackBlocks.push(fields)
  }

  const checkRunID = await getLastCheckSuiteRunID();
  slackBlocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Hey, ${slackMention ? slackMention + ', ' : ''}check it out! <${baseURL}/mochawesome.html|Full Report>. Run can be found <https://github.com/${context.repo.owner}/${context.repo.repo}/runs/${checkRunID}?check_suite_focus=true|here>`,
      },
    ],
  })

  debug(`generated slack blocks : ${JSON.stringify(slackBlocks)}`)

  try {
    // See: https://api.slack.com/methods/chat.postMessage
    await web.chat.postMessage({
      channel: conversationId,
      blocks: slackBlocks,
      text: '',
    })
  } catch (err) {
    setFailed(`Failed to send slack report: ${JSON.stringify(err.data)}`)
  }
}

const encodeFileURL = fileURL => {
  // const fileURLParts = fileURL.split('/')

  // fileURLParts[fileURLParts.length - 1] = encodeURIComponent(
  //   fileURLParts[fileURLParts.length - 1]
  // )

  // return fileURLParts.join('/')
  return encodeURI(fileURL)
}

const getCheckSuiteID = async (): Promise<number> => {
  const runID = github.context.runId;

  core.info(`Getting workflow with ID: ${runID}.`);

  const { data: workflowRun } = await octokit.actions.getWorkflowRun({
    owner: context.repo.owner,
    repo: context.repo.repo,
    run_id: runID,
  });

  core.debug(`found check suite url ${workflowRun.check_suite_url}`)

  const url = workflowRun.check_suite_url.split('/')

  return parseInt(url[url.length-1])
}

const getLastCheckSuiteRunID = async () => {
  const checkSuiteID = await getCheckSuiteID()
  core.info(
    `Getting check suite runs with ID: ${checkSuiteID} and check_name: "${github.context.job}".`
  );

  const {
    data: { check_runs: checkRuns },
  } = await octokit.checks.listForSuite({
    owner: context.repo.owner,
    repo: context.repo.repo,
    check_suite_id: checkSuiteID,
    check_name: github.context.job,
  });

  return checkRuns[checkRuns.length - 1].id;
}