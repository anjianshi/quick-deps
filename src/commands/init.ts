import { Command } from 'quick-args'
import { markRoot } from '../lib/packages'


export default new Command({
  name: 'init',
  describe: "Mark current directory as packages root.",
  handler: initHandler
})


async function initHandler() {
  try {
    const dirpath = process.cwd()
    markRoot(dirpath)
    console.log('Marked!')
  } catch(e) {
    console.error(e)
  }
}
