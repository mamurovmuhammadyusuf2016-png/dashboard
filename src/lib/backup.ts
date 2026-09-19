import { db, tableNames, type TableName } from '../db'

const BLOB_FIELDS: Record<string, string[]> = { photos: ['blob', 'thumb'] }

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = reject
    r.readAsDataURL(b)
  })
}

export async function exportBackup(withPhotos: boolean): Promise<Blob> {
  const out: Record<string, unknown[]> = {}
  for (const t of tableNames) {
    if (t === 'photos' && !withPhotos) continue
    const rows = (await db.table(t).toArray()) as Record<string, unknown>[]
    const blobFields = BLOB_FIELDS[t] ?? []
    if (blobFields.length) {
      for (const row of rows) {
        for (const f of blobFields) {
          const v = row[f]
          if (v instanceof Blob) row[f] = await blobToDataUrl(v)
        }
      }
    }
    out[t] = rows
  }
  const payload = { app: 'mydash', version: 1, exportedAt: new Date().toISOString(), tables: out }
  return new Blob([JSON.stringify(payload)], { type: 'application/json' })
}

export async function importBackup(file: File, mode: 'merge' | 'replace'): Promise<Record<string, number>> {
  const text = await file.text()
  const payload = JSON.parse(text) as { app?: string; tables?: Record<string, Record<string, unknown>[]> }
  if (payload.app !== 'mydash' || !payload.tables) throw new Error('Это не файл резервной копии дашборда')
  const counts: Record<string, number> = {}
  const tables = Object.keys(payload.tables).filter((t): t is TableName => (tableNames as readonly string[]).includes(t))
  // convert data URLs back to blobs outside the transaction (fetch is async & non-IDB)
  for (const t of tables) {
    const blobFields = BLOB_FIELDS[t] ?? []
    if (!blobFields.length) continue
    for (const row of payload.tables[t]) {
      for (const f of blobFields) {
        const v = row[f]
        if (typeof v === 'string' && v.startsWith('data:')) row[f] = await (await fetch(v)).blob()
      }
    }
  }
  await db.transaction('rw', tables.map((t) => db.table(t)), async () => {
    for (const t of tables) {
      const rows = payload.tables![t]
      if (mode === 'replace') await db.table(t).clear()
      await db.table(t).bulkPut(rows)
      counts[t] = rows.length
    }
  })
  return counts
}

export async function clearAll() {
  await db.transaction('rw', tableNames.map((t) => db.table(t)), async () => {
    for (const t of tableNames) await db.table(t).clear()
  })
}

export async function storageInfo() {
  try {
    const est = await navigator.storage?.estimate?.()
    const persisted = (await navigator.storage?.persisted?.()) ?? false
    return { usage: est?.usage ?? 0, quota: est?.quota ?? 0, persisted }
  } catch {
    return { usage: 0, quota: 0, persisted: false }
  }
}

export async function requestPersist() {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
