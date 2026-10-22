'use client'

import * as React from 'react'
import { Tabs as TabsPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

// Abas do admin (tablist/tab/tabpanel do Radix): setas, Home/End e foco no painel saem prontos
// (WAI-ARIA Authoring Practices), sem reimplementar o teclado em cada tela.

const Tabs = TabsPrimitive.Root

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('flex overflow-x-auto border-b border-border', className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        '-mb-px inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring data-[state=active]:border-primary data-[state=active]:text-foreground',
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('mt-6 space-y-4 outline-offset-4', className)} {...props} />
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
