// Ambient declaration for better-sqlite3 — the package ships no types.
// Mirrors src/types/better-sqlite3.d.ts (root) with the surface the Nitro
// session module + tests use.
declare module 'better-sqlite3' {
  interface DatabaseOptions {
    fileMustExist?: boolean
    timeout?: number
    readonly?: boolean
  }

  interface Statement {
    run(...params: unknown[]): { changes: number; lastInsertRowid: number }
    get(...params: unknown[]): unknown
    all(...params: unknown[]): unknown[]
  }

  class Database {
    constructor(filename: string, options?: DatabaseOptions)
    pragma(source: string, simplify?: boolean | unknown): unknown
    exec(source: string): this
    prepare(source: string): Statement
    close(): void
  }

  export default Database
}
