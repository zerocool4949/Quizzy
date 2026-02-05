import { useState, useEffect, useCallback } from 'react'

const API_URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001')

function getAdminKey() {
  return new URLSearchParams(window.location.search).get('key') || ''
}

function adminFetch(url, options = {}) {
  const key = getAdminKey()
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': key,
      ...options.headers
    }
  })
}

// Parse a track entry (string or object) into a consistent shape
function parseTrack(track) {
  if (typeof track === 'string') return { name: track, search: '' }
  if (track && typeof track === 'object') return { name: track.name || '', search: track.search || '' }
  return { name: '', search: '' }
}

// Convert back to JSON format (plain string or object with search)
function serializeTrack(name, search) {
  if (search.trim()) return { name, search }
  return name
}

const emptyForm = { key: '', name: '', trackName: '', trackSearch: '', composer: '', year: '' }

export default function Admin() {
  const [tab, setTab] = useState('movies')
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [editForm, setEditForm] = useState(null) // null = closed, object = open
  const [isNew, setIsNew] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch(`${API_URL}/api/admin/${tab}`)
      if (!res.ok) {
        if (res.status === 401) {
          setError('Unauthorized - check your admin key')
        } else {
          setError('Failed to load data')
        }
        setData({})
        return
      }
      setData(await res.json())
      setHasChanges(false)
    } catch {
      setError('Connection error')
      setData({})
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const save = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      const res = await adminFetch(`${API_URL}/api/admin/${tab}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
      const result = await res.json()
      if (!res.ok) {
        setSaveMsg(result.error || 'Save failed')
      } else {
        setSaveMsg(`Saved (${result.count} entries)`)
        setHasChanges(false)
        setTimeout(() => setSaveMsg(''), 3000)
      }
    } catch {
      setSaveMsg('Connection error')
    } finally {
      setSaving(false)
    }
  }

  const openAdd = () => {
    setEditForm({ ...emptyForm })
    setIsNew(true)
  }

  const openEdit = (entryKey) => {
    const entry = data[entryKey]
    if (!entry) return
    const track = parseTrack(entry.tracks?.[0])
    setEditForm({
      key: entryKey,
      name: entryKey,
      trackName: track.name,
      trackSearch: track.search,
      composer: entry.composer || '',
      year: entry.year ? String(entry.year) : ''
    })
    setIsNew(false)
  }

  const saveForm = () => {
    if (!editForm?.name.trim()) return
    const newData = { ...data }
    // If editing and name changed, remove old key
    if (!isNew && editForm.key && editForm.key !== editForm.name.trim()) {
      delete newData[editForm.key]
    }
    const track = serializeTrack(editForm.trackName.trim(), editForm.trackSearch.trim())
    newData[editForm.name.trim()] = {
      tracks: [track],
      composer: editForm.composer.trim(),
      year: editForm.year ? parseInt(editForm.year, 10) : null
    }
    setData(newData)
    setEditForm(null)
    setHasChanges(true)
  }

  const deleteEntry = (entryKey) => {
    if (!confirm(`Delete "${entryKey}"?`)) return
    const newData = { ...data }
    delete newData[entryKey]
    setData(newData)
    setHasChanges(true)
  }

  const entries = Object.entries(data)
  const label = tab === 'movies' ? 'Movie' : 'Video Game'

  if (!getAdminKey()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center">
          <h1 className="text-2xl font-bold mb-4">Admin</h1>
          <p className="text-slate-400">Missing admin key. Use <code className="text-teal-300">?key=yourSecret</code> in the URL.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-4">
      <div className="w-full max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Admin</h1>
          <a href="/" className="text-sm text-slate-400 hover:text-slate-200">Back to Quizzy</a>
        </div>

        {/* Tab toggle */}
        <div className="flex bg-slate-900 rounded-lg p-0.5 mb-6">
          <button
            onClick={() => setTab('movies')}
            className={`flex-1 px-4 py-2 rounded-md text-sm transition-colors ${
              tab === 'movies' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Movies ({tab === 'movies' ? entries.length : '...'})
          </button>
          <button
            onClick={() => setTab('videogames')}
            className={`flex-1 px-4 py-2 rounded-md text-sm transition-colors ${
              tab === 'videogames' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Video Games ({tab === 'videogames' ? entries.length : '...'})
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-600/20 border border-rose-600/30 text-rose-200 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-slate-400 py-12">Loading...</div>
        ) : (
          <>
            {/* Action bar */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={openAdd}
                className="px-4 py-2 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
              >
                + Add {label}
              </button>
              <div className="flex items-center gap-3">
                {saveMsg && (
                  <span className={`text-sm ${saveMsg.includes('Saved') ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {saveMsg}
                  </span>
                )}
                <button
                  onClick={save}
                  disabled={saving || !hasChanges}
                  className="px-4 py-2 rounded-lg text-sm bg-teal-600 text-white hover:bg-teal-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'Saved'}
                </button>
              </div>
            </div>

            {/* Edit form modal */}
            {editForm && (
              <div className="mb-4 p-4 bg-slate-800/80 rounded-xl border border-slate-600 space-y-3">
                <h3 className="font-semibold text-sm text-slate-300">
                  {isNew ? `Add ${label}` : `Edit "${editForm.key}"`}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">{label} Name *</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                      placeholder="e.g. Jurassic Park"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Composer</label>
                    <input
                      type="text"
                      value={editForm.composer}
                      onChange={(e) => setEditForm({ ...editForm, composer: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                      placeholder="e.g. John Williams"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Track Name *</label>
                    <input
                      type="text"
                      value={editForm.trackName}
                      onChange={(e) => setEditForm({ ...editForm, trackName: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                      placeholder="e.g. Main Theme"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Year</label>
                    <input
                      type="number"
                      value={editForm.year}
                      onChange={(e) => setEditForm({ ...editForm, year: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                      placeholder="e.g. 1993"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-slate-400 mb-1">YouTube Search Override <span className="text-slate-500">(optional - leave empty for auto)</span></label>
                    <input
                      type="text"
                      value={editForm.trackSearch}
                      onChange={(e) => setEditForm({ ...editForm, trackSearch: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                      placeholder="e.g. John Williams Jurassic Park Theme"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setEditForm(null)}
                    className="px-4 py-2 rounded-lg text-sm bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveForm}
                    disabled={!editForm.name.trim() || !editForm.trackName.trim()}
                    className="px-4 py-2 rounded-lg text-sm bg-teal-600 text-white hover:bg-teal-500 transition-colors disabled:opacity-50"
                  >
                    {isNew ? 'Add' : 'Update'}
                  </button>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="bg-slate-900/60 rounded-xl border border-slate-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
                    <th className="text-left px-4 py-3">Name</th>
                    <th className="text-left px-4 py-3">Track</th>
                    <th className="text-left px-4 py-3">Composer</th>
                    <th className="text-left px-4 py-3 w-16">Year</th>
                    <th className="text-right px-4 py-3 w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(([key, entry]) => {
                    const track = parseTrack(entry.tracks?.[0])
                    return (
                      <tr key={key} className="border-b border-slate-800 hover:bg-slate-800/40">
                        <td className="px-4 py-2.5 font-medium">{key}</td>
                        <td className="px-4 py-2.5 text-slate-300">
                          {track.name}
                          {track.search && <span className="text-slate-500 text-xs ml-1" title={track.search}>*</span>}
                        </td>
                        <td className="px-4 py-2.5 text-slate-400">{entry.composer}</td>
                        <td className="px-4 py-2.5 text-slate-500">{entry.year}</td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => openEdit(key)}
                            className="text-teal-400 hover:text-teal-300 text-xs mr-3"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteEntry(key)}
                            className="text-rose-400 hover:text-rose-300 text-xs"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {entries.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        No entries yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-slate-500 mt-4 text-center">
              {entries.length} {tab === 'movies' ? 'movies' : 'video games'} total
            </p>
          </>
        )}
      </div>
    </div>
  )
}
