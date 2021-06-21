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
      const [major, minor, patch] = [rawMajor, rawMinor, rawPatch].map(toNumber)
      return new SemVer(prefix, major, minor, patch)
    }
    return null
  }

  constructor(
    public prefix: string,
    public major: number,
    public minor: number,
    public patch: number
  ) {}

  /**
   * 判断两个版本号是否有差别
   *
   * 版本号相同：             { diff: 0 }
   * 当前版本高于 other：     { diff: 1, level }
   * 当前版本低于 other：     { diff: -1, level }
   *
   * 目前没有对 prefix 进行对比（注意：以后如果真的有需要对比，level 的取值要加上 prefix）
   */
  diff(other: SemVer): SemVerDiff {
    for(const level of ['major', 'minor', 'patch'] as SemVerLevel[]) {
      if (this[level] > other[level]) return { diff: 1, level }
      else if (this[level] < other[level]) return { diff: -1, level }
    }
    return { diff: 0 }
  }

  /**
   * 根据规则生成新的版本号（返回一个新的 SemVer 对象）
   */
  update(updates: SemVer | SemVerLevel) {
    if (typeof updates !== 'string') return updates

    let { prefix, major, minor, patch } = this
    if (updates === 'major') return new SemVer(prefix, major + 1, 0, 0)
    else if (updates === 'minor') return new SemVer(prefix, major, minor + 1, 0)
    else return new SemVer(prefix, major, minor, patch + 1)
  }

  toString() {
    return `${this.prefix}${this.major}.${this.minor}.${this.patch}`
  }
}


function toNumber(str: string) {
  const parsed = parseInt(str, 10)
  return isFinite(parsed) ? parsed : 0
}


export function isSemVerLevel(keyword: string): keyword is SemVerLevel {
  return keyword === 'major' || keyword === 'minor' || keyword === 'patch'
}
