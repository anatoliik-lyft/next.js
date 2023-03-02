/* eslint-env jest */
import {
  fetchViaHTTP,
  File,
  findPort,
  killApp,
  launchApp,
  nextBuild,
  nextStart,
} from 'next-test-utils'
import { join } from 'path'
import fs from 'fs'

const appDir = join(__dirname, '../')
const nextConfig = new File(join(appDir, 'next.config.js'))
let app
const runDev = async (config: any) => {
  await nextConfig.write(`module.exports = ${JSON.stringify(config)}`)
  const port = await findPort()
  const obj = { port, stdout: '', stderr: '' }
  app = await launchApp(appDir, port, {
    stdout: false,
    onStdout(msg: string) {
      obj.stdout += msg || ''
    },
    stderr: false,
    onStderr(msg: string) {
      obj.stderr += msg || ''
    },
  })
  return obj
}

describe('config-output-export', () => {
  afterEach(async () => {
    await killApp(app).catch(() => {})
    await nextConfig.restore()
  })

  it('should error with i18n', async () => {
    const { stderr } = await runDev({
      output: 'export',
      i18n: {
        locales: ['en'],
        defaultLocale: 'en',
      },
    })
    expect(stderr).toContain(
      'Specified "i18n" cannot but used with "output: export".'
    )
  })

  it('should error with rewrites', async () => {
    const { stderr } = await runDev({
      output: 'export',
      rewrites: [{ source: '/from', destination: '/to' }],
    })
    expect(stderr).toContain(
      'Specified "rewrites" cannot but used with "output: export".'
    )
  })

  it('should error with redirects', async () => {
    const { stderr } = await runDev({
      output: 'export',
      redirects: [{ source: '/from', destination: '/to', permanent: true }],
    })
    expect(stderr).toContain(
      'Specified "redirects" cannot but used with "output: export".'
    )
  })

  it('should error with headers', async () => {
    const { stderr } = await runDev({
      output: 'export',
      headers: [
        {
          source: '/foo',
          headers: [{ key: 'x-foo', value: 'val' }],
        },
      ],
    })
    expect(stderr).toContain(
      'Specified "headers" cannot but used with "output: export".'
    )
  })

  it('should error with api routes', async () => {
    const pagesApi = join(appDir, 'pages/api')
    let result
    let response
    try {
      fs.mkdirSync(pagesApi)
      fs.writeFileSync(
        join(pagesApi, 'wow.js'),
        'export default (_, res) => res.end("wow")'
      )
      result = await runDev({
        output: 'export',
      })
      response = await fetchViaHTTP(result.port, '/api/wow')
    } finally {
      await killApp(app).catch(() => {})
      fs.rmSync(pagesApi, { recursive: true, force: true })
    }
    expect(response.status).toBe(404)
    expect(result?.stderr).toContain(
      'API Routes cannot be used with "output: export".'
    )
  })

  it('should error with middleware', async () => {
    const middleware = join(appDir, 'middleware.js')
    let result: { stdout: string; stderr: string; port: number } | undefined
    let response: Response | undefined
    try {
      fs.writeFileSync(
        middleware,
        'export function middleware(req) { console.log("[mw]",request.url) }'
      )
      result = await runDev({
        output: 'export',
      })
      response = await fetchViaHTTP(result.port, '/api/mw')
    } finally {
      await killApp(app).catch(() => {})
      fs.rmSync(middleware)
    }
    expect(response.status).toBe(404)
    expect(result?.stdout + result?.stderr).not.toContain('[mw]')
    expect(result?.stderr).toContain(
      'Middleware cannot be used with "output: export".'
    )
  })
})
