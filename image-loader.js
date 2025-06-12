const cdnUrl = 'https://balatromp.b-cdn.net'

export default function bunnyLoader({ src, width, quality }) {
  if (!cdnUrl) {
    throw new Error('missing NEXT_PUBLIC_CDN_URL env variable.')
  }
  const params = new URLSearchParams()
  params.set('width', width.toString())
  params.set('quality', (quality || 100).toString())
  return `${cdnUrl}${src}?${params.toString()}`
}
