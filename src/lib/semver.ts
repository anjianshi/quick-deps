/**
 * Semantic Versioning (https://semver.org/) related tools
 */


export type SemVerLevel = 'major' | 'minor' | 'patch'


export type SemVerDiff = { diff: 0 }
| { diff: 1, level: SemVerLevel }
| { diff: -1, level: SemVerLevel }


export class SemVer {
  /**
   * Parse semver version number.
   * Return `null` if it is invalid, or it's format is not supported yet.
   */
  static parse(version: string) {
    const pattern = /^(>=|>|<=|<|~|\^)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
    const match = version.match(pattern)
    if (match) {
      const [prefix = '', rawMajor, rawMinor, rawPatch] = match.slice(1)
      const [major, minor, patch] = [rawMajor, rawMinor, rawPatch].map(v => parseInt(v, 10))
      return new SemVer({ prefix, major, minor, patch })
    }
    return null
  }

  public prefix: string
  public major: number
  public minor: number
  public patch: number

  constructor(data: {
    prefix?: string,
    major: number,
    minor: number,
    patch: number
  }) {
    this.prefix = data.prefix ?? ''
    this.major = data.major
    this.minor = data.minor
    this.patch = data.patch
  }

  /**
   * Compare to another version number, return the difference.
   *
   * same：                         { diff: 0 }
   * current higher than another：  { diff: 1, level }
   * current lower than another：   { diff: -1, level }
   *
   * Currently compare with `prefix` was not supported.
   * (Remember represent `prefix difference` info `level` field, when implements `prefix compare`)
   */
  diff(that: SemVer): SemVerDiff {
    for(const level of ['major', 'minor', 'patch'] as SemVerLevel[]) {
      if (this[level] > that[level]) return { diff: 1, level }
      else if (this[level] < that[level]) return { diff: -1, level }
    }
    return { diff: 0 }
  }

  /**
   * Generate new version number by request. (Returns new SemVer object)
   */
  update(updates: SemVer | SemVerLevel) {
    if (typeof updates !== 'string') return updates

    const { prefix, major, minor, patch } = this
    if (updates === 'major') return new SemVer({ prefix, major: major + 1, minor: 0, patch: 0 })
    else if (updates === 'minor') return new SemVer({ prefix, major, minor: minor + 1, patch: 0 })
    else return new SemVer({ prefix, major, minor, patch: patch + 1 })
  }

  /**
   * Returns a SemVer object with specified `prefix`
   */
  withPrefix(prefix: string) {
    return new SemVer({ ...this, prefix })
  }

  toString() {
    return `${this.prefix}${this.major}.${this.minor}.${this.patch}`
  }
}


export function isSemVerLevel(keyword: string): keyword is SemVerLevel {
  return keyword === 'major' || keyword === 'minor' || keyword === 'patch'
}
