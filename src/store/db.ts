import type { Answer, Setting } from './types'

const DB_NAME = 'jras'
const DB_VERSION = 1

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export function openDb(name: string = DB_NAME): Promise<IDBDatabase> {
  const req = indexedDB.open(name, DB_VERSION)
  req.onupgradeneeded = () => {
    const db = req.result
    const answers = db.createObjectStore('answers', { keyPath: 'id' })
    answers.createIndex('answered_at', 'answered_at')
    db.createObjectStore('settings', { keyPath: 'key' })
  }
  return promisify(req)
}

export async function getAllAnswers(db: IDBDatabase): Promise<Answer[]> {
  return promisify(db.transaction('answers').objectStore('answers').getAll())
}

export async function getAllSettings(db: IDBDatabase): Promise<Setting[]> {
  return promisify(db.transaction('settings').objectStore('settings').getAll())
}

export async function putRecords(
  db: IDBDatabase,
  answers: Answer[],
  settings: Setting[] = [],
): Promise<void> {
  const tx = db.transaction(['answers', 'settings'], 'readwrite')
  answers.forEach((a) => tx.objectStore('answers').put(a))
  settings.forEach((s) => tx.objectStore('settings').put(s))
  return done(tx)
}

// 読み込み（上書き）用。消去と書き込みを1つのトランザクションで行う
export async function replaceAll(db: IDBDatabase, answers: Answer[], settings: Setting[]): Promise<void> {
  const tx = db.transaction(['answers', 'settings'], 'readwrite')
  tx.objectStore('answers').clear()
  tx.objectStore('settings').clear()
  answers.forEach((a) => tx.objectStore('answers').put(a))
  settings.forEach((s) => tx.objectStore('settings').put(s))
  return done(tx)
}
