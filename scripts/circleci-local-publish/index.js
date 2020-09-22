const http = require(`http`)
const { parse: parseUrl } = require(`url`)
const { spawn, spawnSync } = require(`child_process`)

const [, , preid] = process.argv

function waitFor(url, interval = 1000) {
  function exec(url, onDone) {
    const { hostname, port } = parseUrl(url)
    http
      .get(
        {
          hostname,
          port,
          path: `/`,
          agent: false, // Create a new agent just for this one request
        },
        ({ statusCode }) => {
          if (statusCode !== 200) {
            setTimeout(() => exec(url, onDone), interval)
            return
          }

          onDone()
        }
      )
      .on(`error`, () => {
        setTimeout(() => exec(`http://127.0.0.1:4873`, onDone), interval)
      })
  }

  return new Promise((resolve, reject) => {
    exec(url, resolve)
  })
}

const proc = spawn(`verdaccio`, [`--config`, `config.yml`], {
  shell: true,
  cwd: __dirname,
})

waitFor(`http://127.0.0.1:4873`, 5000)
  .then(
    () =>
      new Promise(resolve => {
        const lerna = spawn(
          `yarn`,
          [
            `lerna`,
            `publish`,
            `--registry`,
            `http://127.0.0.1:4873`,
            `--canary`,
            `--preid`,
            preid,
            `--dist-tag`,
            preid,
            `--force-publish`,
            `--ignore-scripts`,
            `--yes`,
          ],
          {
            shell: true,
          }
        )

        lerna.stdout.on(`data`, msg => {
          console.log(msg.toString())
        })

        lerna.stderr.on(`data`, msg => {
          console.log(msg.toString())
        })

        lerna.on(`exit`, exitCode => {
          resolve(exitCode)
        })
      })
  )
  .then(exitCode => {
    proc.kill(`SIGINT`)

    if (exitCode === 0) {
      process.exit(0)
      return
    }

    spawnSync(`git`, [`checkout`, `../..`])

    process.exit(0)
  })
