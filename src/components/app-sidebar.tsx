"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Server, Users, Shield, LogOut, ClipboardList } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/components/auth-provider";
import { PERMISSIONS } from "@/config/permissions";
import { useLanguage } from "@/components/language-provider";
import { LanguageToggle } from "@/components/language-toggle";

const NAV_ITEMS = [
  { titleKey: "common.dashboard", href: "/", icon: Server },
  { titleKey: "common.users", href: "/users", icon: Users, permission: PERMISSIONS.USERS_READ },
  { titleKey: "common.roles", href: "/roles", icon: Shield, permission: PERMISSIONS.ROLES_READ },
  { titleKey: "common.auditLogs", href: "/audit-logs", icon: ClipboardList, permission: PERMISSIONS.AUDIT_LOGS_READ },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { t } = useLanguage();

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Server className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">AD Sync</span>
            <span className="text-xs text-muted-foreground truncate max-w-[140px]">
              {user?.username}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("common.navigation")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.filter((item) => {
                if (!item.permission) return true;
                if (user?.permissions?.includes("*")) return true;
                return user?.permissions?.includes(item.permission);
              }).map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    render={<Link href={item.href} />}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{t(item.titleKey)}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-3 space-y-2">
        <LanguageToggle />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={logout}>
              <LogOut className="h-4 w-4" />
              <span>{t("common.logout")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
