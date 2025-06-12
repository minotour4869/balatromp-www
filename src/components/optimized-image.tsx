'use client'

import Image from 'next/image'
import type { ComponentPropsWithoutRef } from 'react'

export function OptimizedImage(props: ComponentPropsWithoutRef<typeof Image>) {
  return <Image {...props} />
}
