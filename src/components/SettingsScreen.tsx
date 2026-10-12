import { useRef, useState } from 'react'
import type { Navigate } from '../route'
import { BackupError, backupFileName, type BackupV2 } from '../backup'
import { dateStrOf, todayStr } from '../date'
import { AppShell } from './layout/AppShell'
import { relogin, type SessionState } from '../session'
import type { SyncStatus } from '../hooks/useStudyLog'
import { Card, SectionTitle } from './ui'

interface Props {
  navigate: Navigate
  session: SessionState
  onRefreshSession: () => void
  syncStatus: SyncStatus
  lastSyncedAt: number | null
  pendingCount: number
  onSyncNow: () => void
  lastBackupAt: number | null
  examDate: string | null
  dailyGoal: number
  onExamDateChange: (date: string) => void
  onDailyGoalChange: (goal: number) => void
  onExport: () => Promise<BackupV2>
  onImport: (text: string) => Promise<number>
}

const BACKUP_WARN_DAYS = 30
const GOAL_MIN = 1
const GOAL_MAX = 200

function syncFailed(s: SyncStatus): boolean {
  return s.state === 'offline' || s.state === 'expired' || s.state === 'error'
}

function syncStatusText(s: SyncStatus): string {
  switch (s.state) {
    case 'idle':
      return 'まだ同期していません'
    case 'syncing':
      return '同期中…'
    case 'ok':
      return '同期しました'
    case 'offline':
      return 'オフラインのため同期できません。接続が戻ると自動で送ります'
    case 'expired':
      return 'ログインが切れているため同期できません'
    case 'error':
      return `同期できません：${s.message}`
  }
}

function formatDateTime(ms: number): string {
  const d = new Date(ms)
  return `${dateStrOf(ms)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function daysSince(ms: number): number {
  const [a, b] = [dateStrOf(ms), todayStr()].map((s) => new Date(s).getTime())
  return Math.round((b - a) / 86400000)
}

export function SettingsScreen({ navigate, session, onRefreshSession, syncStatus, lastSyncedAt, pendingCount, onSyncNow, lastBackupAt, examDate, dailyGoal, onExamDateChange, onDailyGoalChange, onExport, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)

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

  const backupAge = lastBackupAt === null ? null : daysSince(lastBackupAt)
  const backupStale = backupAge === null || backupAge >= BACKUP_WARN_DAYS

  return (
    <AppShell title="設定" tab="settings" navigate={navigate} screenId="settingsScreen">
      <SectionTitle>試験と目標</SectionTitle>
      <Card className="list-card">
        <label className="row">
          <div className="row-main">
            <div className="row-title">試験日</div>
            <div className="row-sub">ホームに残り日数を表示します</div>
          </div>
          <input
            className="input"
            id="examDateInput"
            type="date"
            value={examDate ?? ''}
            onChange={(e) => onExamDateChange(e.target.value)}
          />
        </label>
        <label className="row">
          <div className="row-main">
            <div className="row-title">1日の目標</div>
            <div className="row-sub">ホームと結果画面の進捗に使います</div>
          </div>
          <input
            className="input input-number"
            id="dailyGoalInput"
            type="number"
            inputMode="numeric"
            min={GOAL_MIN}
            max={GOAL_MAX}
            defaultValue={dailyGoal}
            onBlur={(e) => {
              const n = Math.round(Number(e.target.value))
              if (Number.isFinite(n) && n >= GOAL_MIN && n <= GOAL_MAX) onDailyGoalChange(n)
              else e.target.value = String(dailyGoal)
            }}
          />
          <span className="muted">問</span>
        </label>
      </Card>

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

      <SectionTitle>同期</SectionTitle>
      <Card className="list-card">
        <div className="row">
          <div className="row-main">
            <div className="row-title">他の端末と学習記録を同期</div>
            <div className={`row-sub${syncFailed(syncStatus) ? ' text-ng' : ''}`} id="syncStatus">
              {syncStatusText(syncStatus)}
            </div>
          </div>
          <button
            className="btn-small"
            id="syncNowBtn"
            onClick={onSyncNow}
            disabled={syncStatus.state === 'syncing'}
            type="button"
          >
            今すぐ同期
          </button>
        </div>
        <div className="row">
          <div className="row-main">
            <div className="row-title">最終同期</div>
          </div>
          <span className="muted" id="lastSynced">
            {lastSyncedAt === null ? '未実施' : formatDateTime(lastSyncedAt)}
          </span>
        </div>
        <div className="row">
          <div className="row-main">
            <div className="row-title">未送信の解答</div>
          </div>
          <span className={pendingCount > 0 ? 'text-ng' : 'muted'} id="pendingCount">
            {pendingCount}件
          </span>
        </div>
        {syncStatus.state === 'expired' && (
          <button className="row row-button" id="syncReloginBtn" onClick={relogin} type="button">
            <div className="row-main">
              <div className="row-title">ログインし直して同期を再開する</div>
            </div>
            <span aria-hidden="true">›</span>
          </button>
        )}
      </Card>

      <SectionTitle>ログイン</SectionTitle>
      <Card className="list-card">
        <div className="row">
          <div className="row-main">
            <div className="row-title">Cloudflare アカウント</div>
            <div className="row-sub" id="serverStatus">
              {session.status === 'checking' && '確認中…'}
              {session.status === 'ok' && `ログイン中：${session.user}`}
              {session.status === 'expired' && 'ログインが切れています（更新と同期が止まります）'}
              {session.status === 'offline' && 'オフラインのため確認できません'}
              {session.status === 'error' && `確認できません：${session.message}`}
            </div>
          </div>
          <button className="btn-small" id="checkServerBtn" onClick={onRefreshSession} type="button">
            確認
          </button>
        </div>
        <button className="row row-button" id="reloginBtn" onClick={relogin} type="button">
          <div className="row-main">
            <div className="row-title">ログインし直す</div>
            <div className="row-sub">Cloudflare のログイン画面を開き、終わるとアプリに戻ります</div>
          </div>
          <span aria-hidden="true">›</span>
        </button>
      </Card>
    </AppShell>
  )
}
