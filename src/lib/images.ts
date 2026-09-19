import { useEffect, useState } from 'react'

async function loadBitmap(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' })
  } catch {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve(img)
      }
      img.onerror = (e) => {
        URL.revokeObjectURL(url)
        reject(e)
      }
      img.src = url
    })
  }
}

function draw(src: ImageBitmap | HTMLImageElement, max: number, quality: number): Promise<{ blob: Blob; w: number; h: number }> {
  const sw = src.width
  const sh = src.height
  const scale = Math.min(1, max / Math.max(sw, sh))
  const w = Math.max(1, Math.round(sw * scale))
  const h = Math.max(1, Math.round(sh * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(src, 0, 0, w, h)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve({ blob: b, w, h }) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      quality,
    )
  })
}

/** Prepare a photo for storage: a thumbnail plus a size-capped original. */
export async function preparePhoto(file: File) {
  const bmp = await loadBitmap(file)
  const thumb = await draw(bmp, 512, 0.8)
  const big = Math.max(bmp.width, bmp.height)
  let full: { blob: Blob; w: number; h: number }
  if (big > 2400 || file.size > 4 * 1024 * 1024) {
    full = await draw(bmp, 2400, 0.9)
  } else {
    full = { blob: file, w: bmp.width, h: bmp.height }
  }
  if ('close' in bmp) bmp.close()
  return { thumb: thumb.blob, blob: full.blob, w: full.w, h: full.h }
}

/** Read EXIF DateTimeOriginal from a JPEG. Returns YYYY-MM-DD or null. */
export async function exifDate(file: Blob): Promise<string | null> {
  try {
    const buf = await file.slice(0, 128 * 1024).arrayBuffer()
    const v = new DataView(buf)
    if (v.getUint16(0) !== 0xffd8) return null
    let off = 2
    while (off + 4 < v.byteLength) {
      const marker = v.getUint16(off)
      const len = v.getUint16(off + 2)
      if (marker === 0xffe1) {
        const start = off + 4
        if (v.getUint32(start) !== 0x45786966) return null // "Exif"
        const tiff = start + 6
        const little = v.getUint16(tiff) === 0x4949
        const u16 = (p: number) => v.getUint16(p, little)
        const u32 = (p: number) => v.getUint32(p, little)
        const ifd0 = tiff + u32(tiff + 4)
        const readIfd = (p: number, tag: number): number | null => {
          const n = u16(p)
          for (let i = 0; i < n; i++) {
            const e = p + 2 + i * 12
            if (u16(e) === tag) return e
          }
          return null
        }
        const exifPtr = readIfd(ifd0, 0x8769)
        if (!exifPtr) return null
        const exifIfd = tiff + u32(exifPtr + 8)
        const dt = readIfd(exifIfd, 0x9003) ?? readIfd(exifIfd, 0x9004)
        if (!dt) return null
        const count = u32(dt + 4)
        const ptr = tiff + u32(dt + 8)
        let s = ''
        for (let i = 0; i < Math.min(count, 19); i++) s += String.fromCharCode(v.getUint8(ptr + i))
        const m = /^(\d{4}):(\d{2}):(\d{2})/.exec(s)
        if (!m) return null
        return `${m[1]}-${m[2]}-${m[3]}`
      }
      if ((marker & 0xff00) !== 0xff00) return null
      off += 2 + len
    }
  } catch {
    /* ignore */
  }
  return null
}

export function useObjectUrl(blob?: Blob | null) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    URL.revokeObjectURL(a.href)
    a.remove()
  }, 1000)
}
