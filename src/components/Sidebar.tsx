import { useState } from 'react'
import type { Density, UiSettings } from '../types'
import './Sidebar.css'

type Tab = 'tools' | 'settings' | 'debug'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'tools', label: 'Tools', icon: '⚒' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
  { id: 'debug', label: 'Debug', icon: '◎' },
]

const DENSITIES: Density[] = ['compact', 'comfortable', 'spacious']

interface Props {
  collapsed: boolean
  onToggle: () => void
  settings: UiSettings
  onChange: <K extends keyof UiSettings>(key: K, value: UiSettings[K]) => void
  onReset: () => void
}

export default function Sidebar({ collapsed, onToggle, settings, onChange, onReset }: Props) {
  const [tab, setTab] = useState<Tab>('tools')

  if (collapsed) {
    return (
      <aside className="sidebar sidebar--collapsed">
        <button className="icon-btn" onClick={onToggle} title="Expand panel">
          ‹
        </button>
        {TABS.map((t) => (
          <button
            key={t.id}
            className="icon-btn"
            title={t.label}
            onClick={() => {
              setTab(t.id)
              onToggle()
            }}
          >
            {t.icon}
          </button>
        ))}
      </aside>
    )
  }

  return (
    <aside className="sidebar">
      <header className="sidebar-head">
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={t.id === tab ? 'tab tab--active' : 'tab'}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <button className="icon-btn" onClick={onToggle} title="Collapse panel">
          ›
        </button>
      </header>

      <div className="sidebar-body">
        {tab === 'tools' && (
          <Section title="Canvas">
            <Field label="Grid">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.showGrid}
                  onChange={(e) => onChange('showGrid', e.target.checked)}
                />
                <span>{settings.showGrid ? 'On' : 'Off'}</span>
              </label>
            </Field>

            <Field label="Grid size" value={`${settings.gridSize}px`}>
              <input
                type="range"
                min={8}
                max={96}
                step={4}
                value={settings.gridSize}
                onChange={(e) => onChange('gridSize', Number(e.target.value))}
              />
            </Field>
          </Section>
        )}

        {tab === 'tools' && (
          <Section title="Node">
            <Field label="Node radius" value={`${settings.nodeRadius}px`}>
              <input
                type="range"
                min={40}
                max={180}
                step={2}
                value={settings.nodeRadius}
                onChange={(e) => onChange('nodeRadius', Number(e.target.value))}
              />
            </Field>

            <Field label="Spawn gap" value={`${settings.spawnGap}px`}>
              <input
                type="range"
                min={120}
                max={520}
                step={5}
                value={settings.spawnGap}
                onChange={(e) => onChange('spawnGap', Number(e.target.value))}
              />
            </Field>

            <Field label="Menu radius" value={`${settings.menuRadius}px`}>
              <input
                type="range"
                min={130}
                max={360}
                step={4}
                value={settings.menuRadius}
                onChange={(e) => onChange('menuRadius', Number(e.target.value))}
              />
            </Field>
          </Section>
        )}

        {tab === 'settings' && (
          <>
            <Section title="Appearance">
              <Field label="Accent">
                <input
                  type="color"
                  value={settings.accent}
                  onChange={(e) => onChange('accent', e.target.value)}
                />
              </Field>

              <Field label="Density">
                <div className="segmented">
                  {DENSITIES.map((d) => (
                    <button
                      key={d}
                      className={d === settings.density ? 'seg seg--active' : 'seg'}
                      onClick={() => onChange('density', d)}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </Field>
            </Section>

            <Section title="Reset">
              <button className="btn" onClick={onReset}>
                Restore defaults
              </button>
            </Section>
          </>
        )}

        {tab === 'debug' && (
          <Section title="State">
            <pre className="json">{JSON.stringify(settings, null, 2)}</pre>
          </Section>
        )}
      </div>
    </aside>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="section">
      <h2 className="section-title">{title}</h2>
      {children}
    </section>
  )
}

function Field({
  label,
  value,
  children,
}: {
  label: string
  value?: string
  children: React.ReactNode
}) {
  return (
    <div className="field">
      <div className="field-head">
        <span className="field-label">{label}</span>
        {value && <span className="field-value">{value}</span>}
      </div>
      {children}
    </div>
  )
}
