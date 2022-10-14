# Cypress Action

### Example

```YAML
name: Run End2End Tests
on:
  push:
    branches: [master]

jobs:
  cypress-run:
    runs-on: ubuntu-16.04
    steps:
      - name: Checkout
        uses: actions/checkout@v1
      - name: 'Run Action'
        uses: coingate/cypress-action@master
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          gcloud-auth: ${{ secrets.GCLOUD_AUTH }}
          bucket-name: 'cg-live-tests'
          slack-token: ${{ secrets.SLACK_TOKEN }}
          slack-channel: CBH5UR16Y
          slack-mention: '@qa'
          env: CG_AUTH_TOKEN=${{ secrets.CYPRESS_CG_AUTH_TOKEN }}
          config: baseUrl=https://coingate.com
          spec: ${{ steps.next-test.outputs.path }}
          browser: chrome
          sorry-cypress: true
        env: 
          CYPRESS_API_URL: "http://cg-cypress-sandbox-200193365.eu-central-1.elb.amazonaws.com:8080"
```