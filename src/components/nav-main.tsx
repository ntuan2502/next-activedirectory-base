"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { LucideIcon } from "lucide-react"

export function NavMain({
  groups,
}: {
  groups: {
    title: string
    icon: LucideIcon
    isActive?: boolean
    items: {
      title: string
      url: string
      icon: LucideIcon
    }[]
  }[]
}) {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarMenu>
        {groups.map((group) => {
          // Check if any child item is active to auto-open group
          const isChildActive = group.items.some((item) => pathname === item.url)
          
          return (
            <Collapsible
              key={group.title}
              defaultOpen={group.isActive || isChildActive}
              className="group/collapsible"
              render={<SidebarMenuItem />}
            >
              <CollapsibleTrigger
                render={
                  <SidebarMenuButton tooltip={group.title} className="font-semibold text-sidebar-foreground">
                    <group.icon className="h-4 w-4 shrink-0 text-muted-foreground/80" />
                    <span className="truncate transition-all duration-200 group-data-[state=collapsed]:opacity-0 group-data-[state=collapsed]:w-0">{group.title}</span>
                    <ChevronRight className="ml-auto h-4 w-4 transition-all duration-200 group-data-[open]/collapsible:rotate-90 text-muted-foreground/60 group-data-[state=collapsed]:opacity-0 group-data-[state=collapsed]:w-0 group-data-[state=collapsed]:pointer-events-none" />
                  </SidebarMenuButton>
                }
              />
              <CollapsibleContent>
                <SidebarMenuSub className="ml-4 pl-2 border-l border-sidebar-border/60 space-y-0.5 mt-1">
                  {group.items.map((item) => {
                    const isActive = pathname === item.url
                    return (
                      <SidebarMenuSubItem key={item.url}>
                        <SidebarMenuSubButton
                          isActive={isActive}
                          render={<Link href={item.url} />}
                          className="flex items-center gap-2.5 h-8 px-2 rounded-md transition-colors"
                        >
                          <item.icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="text-xs font-medium">{item.title}</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    )
                  })}
                </SidebarMenuSub>
              </CollapsibleContent>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
