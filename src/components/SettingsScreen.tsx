import { useRef, useState } from 'react'
import type { Navigate } from '../route'
import { BackupError, backupFileName, type BackupV2 } from '../backup'
import { dateStrOf, todayStr } from '../date'
import { AppShell } from './layout/AppShell'
import { Card, SectionTitle } from './ui'

interface Props {
  navigate: Navigate
  lastBackupAt: number | null
  onExport: () => Promise<BackupV2>
  onImport: (text: string) => Promise<number>
}

const BACKUP_WARN_DAYS = 30

type ServerState = { status: 'idle' | 'checking' } | { status: 'ok'; user: string } | { status: 'error'; message: string }

function daysSince(ms: number): number {
  const [a, b] = [dateStrOf(ms), todayStr()].map((s) => new Date(s).getTime())
  return Math.round((b - a) / 86400000)
}

export function SettingsScreen({ navigate, lastBackupAt, onExport, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [server, setServer] = useState<ServerState>({ status: 'idle' })

  const handleExport = async () => {
    const backup = await onExport()
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = backupFileName(backup.exportedAt)
    a.click()
    URL.revokeObjectURL(url)
    setMessage(`解答ログ ${backup.answers.length}件を書き出しました`)
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const text = await file.text()
      if (!window.confirm('今の学習記録を、読み込むファイルの内容で上書きします。よろしいですか？')) return
      const count = await onImport(text)
      setMessage(`解答ログ ${count}件を読み込みました`)
    } catch (e) {
      setMessage(e instanceof BackupError ? `読み込めませんでした：${e.message}` : '読み込みに失敗しました')
      if (!(e instanceof BackupError)) console.error(e)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const checkServer = async () => {
    setServer({ status: 'checking' })
    try {
      const res = await fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' })
      if (res.ok) {
        const body = (await res.json()) as { user: string }
        setServer({ status: 'ok', user: body.user })
      } else {
        setServer({ status: 'error', message: res.status === 401 ? 'ログインしていません' : `エラー（${res.status}）` })
      }
    } catch {
      setServer({ status: 'error', message: '接続できません（オフライン？）' })
    }
  }

  const backupAge = lastBackupAt === null ? null : daysSince(lastBackupAt)
  const backupStale = backupAge === null || backupAge >= BACKUP_WARN_DAYS

  return (
    <AppShell title="設定" tab="settings" navigate={navigate} screenId="settingsScreen">
      <SectionTitle>学習データ</SectionTitle>
      <Card className="list-card">
        <button className="row row-button" id="exportBtn" onClick={() => void handleExport()} type="button">
          <div className="row-main">
            <div className="row-title">データを書き出す</div>
            <div className="row-sub">学習記録を JSON ファイルに保存</div>
          </div>
          <span aria-hidden="true">⬆</span>
        </button>
        <button className="row row-button" id="importBtn" onClick={() => fileRef.current?.click()} type="button">
          <div className="row-main">
            <div className="row-title">データを読み込む</div>
            <div className="row-sub">機種変更時などに復元（上書きの確認あり）</div>
          </div>
          <span aria-hidden="true">⬇</span>
        </button>
        <div className="row">
          <div className="row-main">
            <div className="row-title">最終バックアップ</div>
          </div>
          <span className={backupStale ? 'text-ng' : 'muted'} id="lastBackup">
            {lastBackupAt === null ? '未実施' : `${dateStrOf(lastBackupAt)}（${backupAge}日前）`}
          </span>
        </div>
      </Card>
      <input
        ref={fileRef}
        id="importFile"
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      {message && (
        <p className="note" id="settingsMessage" role="status">
          {message}
        </p>
      )}

      <SectionTitle>同期（準備中）</SectionTitle>
      <Card className="list-card">
        <div className="row">
          <div className="row-main">
            <div className="row-title">サーバーとの接続</div>
            <div className="row-sub" id="serverStatus">
              {server.status === 'idle' && '未確認'}
              {server.status === 'checking' && '確認中…'}
              {server.status === 'ok' && `ログイン中：${server.user}`}
              {server.status === 'error' && server.message}
            </div>
          </div>
          <button className="btn-small" id="checkServerBtn" onClick={() => void checkServer()} type="button">
            確認
          </button>
        </div>
      </Card>
    </AppShell>
  )
}
