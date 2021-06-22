/**
 * Semantic Versioning (https://semver.org/) related tools
 */


export type SemVerLevel = 'major' | 'minor' | 'patch'


export type SemVerDiff = { diff: 0 }
| { diff: 1, level: SemVerLevel }
| { diff: -1, level: SemVerLevel }


export class SemVer {
  /**
   * 解析 semver 格式的版本号
   * 对于不合法或不支持的格式，返回 null
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
   * 判断两个版本号是否有差别
   *
   * 版本号相同：             { diff: 0 }
   * 当前版本高于 that：      { diff: 1, level }
   * 当前版本低于 that：      { diff: -1, level }
   *
   * 目前没有对 prefix 进行对比（注意：以后如果真的有需要对比，level 的取值要加上 prefix）
   */
  diff(that: SemVer): SemVerDiff {
    for(const level of ['major', 'minor', 'patch'] as SemVerLevel[]) {
      if (this[level] > that[level]) return { diff: 1, level }
      else if (this[level] < that[level]) return { diff: -1, level }
    }
    return { diff: 0 }
  }

  /**
   * 根据规则生成新的版本号（返回一个新的 SemVer 对象）
   */
  update(updates: SemVer | SemVerLevel) {
    if (typeof updates !== 'string') return updates

    const { prefix, major, minor, patch } = this
    if (updates === 'major') return new SemVer({ prefix, major: major + 1, minor: 0, patch: 0 })
    else if (updates === 'minor') return new SemVer({ prefix, major, minor: minor + 1, patch: 0 })
    else return new SemVer({ prefix, major, minor, patch: patch + 1 })
  }

  /**
   * 返回一个带指定 prefix 的新 SemVer 对象
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
