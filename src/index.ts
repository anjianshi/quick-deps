#!/usr/bin/env node
import qargs from 'quick-args'
import cmdVersion from './commands/version'
import cmdPublish from './commands/publish'


qargs
  .program('deps')
  .describe('Simple dependencies manage.')
  .command(cmdVersion)
  .command(cmdPublish)
  .parse()
