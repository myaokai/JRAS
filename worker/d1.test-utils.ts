import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

// node:sqlite で D1 の使う範囲（prepare/bind/all/run/batch）を模し、本物のマイグレーションと SQL を流す
export function createD1(): D1Database {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'))
  const statement = (sql: string, params: unknown[] = []) => ({
    bind: (...values: unknown[]) => statement(sql, values),
    all: async () => ({ results: sqlite.prepare(sql).all(...(params as never[])), success: true }),
    run: async () => {
      sqlite.prepare(sql).run(...(params as never[]))
      return { success: true }
    },
  })
  return {
    prepare: (sql: string) => statement(sql),
    batch: async (stmts: { run: () => Promise<unknown> }[]) => {
      sqlite.exec('BEGIN')
      try {
        const out = []
        for (const s of stmts) out.push(await s.run())
        sqlite.exec('COMMIT')
        return out
      } catch (e) {
        sqlite.exec('ROLLBACK')
        throw e
      }
    },
  } as unknown as D1Database
}
