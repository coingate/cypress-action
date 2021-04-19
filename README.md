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
          bucket-name: "tests-data-eoiurg"
          slack-token: ${{ secrets.SLACK_TOKEN }}
          slack-channel: CBH555555
```