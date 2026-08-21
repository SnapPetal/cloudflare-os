import { useCallback, useEffect, useRef, useState } from 'react'
import { Database, Trash } from '@phosphor-icons/react'
import { useKumoToastManager } from '@cloudflare/kumo'

type Vector = { key?: string; data: number[]; metadata: unknown }

const API = '/vector-store/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, options)
  let body: unknown
  try { body = await response.json() } catch { throw new Error(`Vector service returned ${response.status}`) }
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body ? body.error : undefined
    throw new Error(typeof message === 'string' ? message : `Vector service returned ${response.status}`)
  }
  return body as T
}

export default function VectorStoreAdminPanel() {
  const toasts = useKumoToastManager()
  const toastsRef = useRef(toasts)
  const [indexes, setIndexes] = useState<string[]>([])
  const [bucket, setBucket] = useState('')
  const [index, setIndex] = useState('')
  const [vectors, setVectors] = useState<Vector[]>([])
  const [selected, setSelected] = useState<Vector | null>(null)
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const loadVectors = useCallback(async (nextIndex: string, nextBucket = bucket) => {
    if (!nextIndex) { setVectors([]); setSelected(null); return }
    setBusy('load')
    try {
      setVectors(await request<Vector[]>(`/vectors?bucket=${encodeURIComponent(nextBucket)}&index=${encodeURIComponent(nextIndex)}`))
      setSelected(null)
    } catch (error) {
      toastsRef.current.add({ title: error instanceof Error ? error.message : 'Failed to load vectors', variant: 'error' })
    } finally { setBusy(null) }
  }, [bucket])

  const loadIndexes = useCallback(async () => {
    setLoading(true)
    try {
      const buckets = await request<string[]>('/buckets')
      const nextBucket = buckets[0] ?? ''
      if (!nextBucket) throw new Error('The vector Worker has no configured bucket.')
      setBucket(nextBucket)
      const values = await request<string[]>(`/indexes?bucket=${encodeURIComponent(nextBucket)}`)
      setIndexes(values)
      const nextIndex = values.includes(index) ? index : values[0] ?? ''
      setIndex(nextIndex)
      await loadVectors(nextIndex, nextBucket)
    } catch (error) {
      toastsRef.current.add({ title: error instanceof Error ? error.message : 'Failed to load vector indexes', variant: 'error' })
    } finally { setLoading(false) }
  }, [index, loadVectors])

  useEffect(() => { void loadIndexes() }, [loadIndexes])

  const deleteVector = async () => {
    if (!selected || !index || !window.confirm(`Permanently delete vector ${selected.key}?`)) return
    setBusy(`delete-${selected.key}`)
    try {
      await request('/vectors', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bucket, index, key: selected.key }),
      })
      toastsRef.current.add({ title: 'Vector deleted', variant: 'success' })
      await loadVectors(index)
    } catch (error) {
      toastsRef.current.add({ title: error instanceof Error ? error.message : 'Failed to delete vector', variant: 'error' })
    } finally { setBusy(null) }
  }

  const query = filter.toLowerCase()
  const visible = vectors.filter((vector) => `${vector.key ?? ''} ${JSON.stringify(vector.metadata)}`.toLowerCase().includes(query))

  return <div className="space-y-6">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold text-kumo-strong">Skatetricks Knowledge</h2>
        <p className="text-sm text-kumo-subtle mt-1">Read vector metadata and remove individual embeddings from the private S3 Vectors store.</p>
      </div>
      <Database size={22} className="text-kumo-subtle" />
    </div>

    <section className="bg-kumo-elevated border border-kumo-line rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-kumo-default">Index<select value={index} onChange={(event) => { setIndex(event.target.value); void loadVectors(event.target.value) }} disabled={loading || !indexes.length} className="mt-1 block rounded-lg border border-kumo-line bg-kumo-base px-3 py-2 text-sm"><option value="">Choose an index</option>{indexes.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="text-sm text-kumo-default flex-1 min-w-52">Filter<input type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Key or metadata" className="mt-1 block w-full rounded-lg border border-kumo-line bg-kumo-base px-3 py-2 text-sm" /></label>
        <button type="button" onClick={() => void loadIndexes()} disabled={busy !== null} className="rounded-lg border border-kumo-line px-4 py-2 text-sm text-kumo-default disabled:opacity-50">Refresh</button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
        <div className="max-h-96 overflow-y-auto rounded-lg border border-kumo-line">
          {busy === 'load' && <p className="p-4 text-sm text-kumo-subtle">Loading vectors...</p>}
          {!busy && !visible.length && <p className="p-4 text-sm text-kumo-subtle">No vectors found.</p>}
          {visible.map((vector) => <button type="button" key={vector.key} onClick={() => setSelected(vector)} className={`flex w-full items-center justify-between gap-3 border-b border-kumo-line px-4 py-3 text-left last:border-0 ${selected?.key === vector.key ? 'bg-kumo-tint' : 'hover:bg-kumo-tint'}`}><span className="min-w-0 truncate text-sm text-kumo-strong">{vector.key ?? '(unnamed vector)'}</span><span className="shrink-0 text-xs text-kumo-subtle">{vector.data.length}d</span></button>)}
        </div>
        <div className="rounded-lg border border-kumo-line p-4">
          {!selected && <p className="text-sm text-kumo-subtle">Select a vector to inspect its metadata.</p>}
          {selected && <><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-all text-sm font-semibold text-kumo-strong">{selected.key}</h3><p className="mt-1 text-xs text-kumo-subtle">{selected.data.length} dimensions</p></div><button type="button" onClick={() => void deleteVector()} disabled={busy === `delete-${selected.key}`} className="inline-flex shrink-0 items-center gap-1 text-sm text-kumo-danger hover:underline disabled:opacity-50"><Trash size={15} />Delete</button></div><pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-kumo-subtle">{JSON.stringify(selected.metadata, null, 2)}</pre></>}
        </div>
      </div>
    </section>
    <p className="text-xs text-kumo-subtle">Deletion is permanent. Index creation, recreation, and bucket management remain infrastructure operations outside this UI.</p>
  </div>
}
