import type { Navigate, Route, Tab } from '../../route'

const TABS: { tab: Tab; label: string; icon: string; route: Route }[] = [
  { tab: 'home', label: 'ホーム', icon: '⌂', route: { name: 'home' } },
  { tab: 'study', label: '学習', icon: '✎', route: { name: 'study' } },
  { tab: 'textbook', label: '教科書', icon: '❏', route: { name: 'textbook' } },
  { tab: 'records', label: '記録', icon: '▤', route: { name: 'records' } },
  { tab: 'settings', label: '設定', icon: '⚙', route: { name: 'settings' } },
]

export function TabBar({ active, navigate }: { active: Tab; navigate: Navigate }) {
  return (
    <nav className="tab-bar" aria-label="メインメニュー">
      {TABS.map((t) => (
        <button
          key={t.tab}
          className={`tab-item${active === t.tab ? ' active' : ''}`}
          data-tab={t.tab}
          onClick={() => navigate(t.route)}
          aria-current={active === t.tab ? 'page' : undefined}
          type="button"
        >
          <span className="tab-icon" aria-hidden="true">
            {t.icon}
          </span>
          <span className="tab-label">{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
