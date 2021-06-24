import * as path from 'path'
import * as fs from 'fs'
import { Command } from 'quick-args'


export default new Command<object>({
  name: 'version',
  describe: "Show this tool's version",
  handler() {
    const packageJSON = path.resolve(__dirname, '../../package.json')
    const raw = fs.readFileSync(packageJSON).toString()
    const data = JSON.parse(raw)
    console.log(data.version)
  }
})
