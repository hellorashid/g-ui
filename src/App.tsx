import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Stage from './components/Stage'
import type { UiSettings } from './types'
import './App.css'

const defaultSettings: UiSettings = {
  showGrid: true,
  gridSize: 32,
  density: 'comfortable',
  accent: '#6e8bff',
  nodeRadius: 100,
  menuRadius: 180,
  spawnGap: 320,
}

export default function App() {
  const [collapsed, setCollapsed] = useState(true)
  const [settings, setSettings] = useState<UiSettings>(defaultSettings)

  const update = <K extends keyof UiSettings>(key: K, value: UiSettings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }))

  return (
    <div className="app" style={{ ['--accent' as string]: settings.accent }}>
      <Stage settings={settings} />
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        settings={settings}
        onChange={update}
        onReset={() => setSettings(defaultSettings)}
      />
    </div>
  )
}
