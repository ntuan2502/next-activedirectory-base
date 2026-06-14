"use client"

import * as React from "react"
import { Server, Users, Shield, ClipboardList, Settings } from "lucide-react"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useAuth } from "@/components/auth-provider"
import { useLanguage } from "@/components/language-provider"
import { PERMISSIONS } from "@/config/permissions"
import packageJson from "../../package.json"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth()
  const { t } = useLanguage()

  const hasPermission = (permission?: string) => {
    if (!permission) return true
    if (user?.permissions?.includes("*")) return true
    return user?.permissions?.includes(permission)
  }

  // Option B: Group structures mapping to NavMain with collapsible support
  const navGroups = [
    {
      title: t("common.navigation"),
      icon: Users,
      isActive: true,
      items: [
        { title: t("common.dashboard"), url: "/", icon: Server },
        { title: t("common.users"), url: "/users", icon: Users, permission: PERMISSIONS.USERS_READ },
        { title: t("common.roles"), url: "/roles", icon: Shield, permission: PERMISSIONS.ROLES_READ },
      ].filter(item => hasPermission(item.permission))
    },
    {
      title: t("common.system"),
      icon: Settings,
      isActive: true,
      items: [
        { title: t("common.auditLogs"), url: "/audit-logs", icon: ClipboardList, permission: PERMISSIONS.AUDIT_LOGS_READ },
        { title: t("common.settings"), url: "/settings", icon: Settings, permission: PERMISSIONS.LDAP_SYNC },
      ].filter(item => hasPermission(item.permission))
    }
  ].filter(group => group.items.length > 0)

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="border-none flex flex-row items-center justify-start overflow-hidden transition-all duration-200 py-3 px-4 group-data-[state=collapsed]:p-1.5">
        {/* Logo Section */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md">
          <Server className="h-5 w-5" />
        </div>

        {/* Text Info */}
        <div className="flex flex-col min-w-0 transition-all duration-200 ml-3 group-data-[state=collapsed]:ml-0 group-data-[state=collapsed]:opacity-0 group-data-[state=collapsed]:w-0 group-data-[state=collapsed]:pointer-events-none">
          <span className="text-sm font-bold text-foreground truncate leading-tight">
            AD Sync
          </span>
          <span className="text-[10px] text-muted-foreground/80 truncate mt-0.5 leading-none">
            v{packageJson.version}
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.length > 0 && <NavMain groups={navGroups} />}
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
