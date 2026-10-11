import type { ReactNode } from 'react'
import type { Navigate, Tab } from '../../route'
import { TabBar } from './TabBar'

interface Props {
  title: string
  // 指定すると左上に戻るボタンを出す
  onBack?: () => void
  backLabel?: string
  headerRight?: ReactNode
  // 指定すると下部タブの代わりに下部固定のボタン領域を出す（出題中など）
  footer?: ReactNode
  tab?: Tab
  navigate: Navigate
  screenId?: string
  children: ReactNode
}

export function AppShell({ title, onBack, backLabel = '戻る', headerRight, footer, tab, navigate, screenId, children }: Props) {
  return (
    <div className={`app-shell${footer ? ' has-footer' : ' has-tabs'}`}>
      <header className="app-header">
        {onBack && (
          <button className="header-back" onClick={onBack} type="button" aria-label={backLabel}>
            ‹
          </button>
        )}
        <h1>{title}</h1>
        {headerRight && <div className="header-right">{headerRight}</div>}
      </header>
      <main className="app-main screen" id={screenId}>
        {children}
      </main>
      {footer ? (
        <div className="bottom-bar">{footer}</div>
      ) : (
        tab && <TabBar active={tab} navigate={navigate} />
      )}
    </div>
  )
}
