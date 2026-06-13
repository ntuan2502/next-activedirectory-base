"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Server, Users, Shield, LogOut, ClipboardList, User, Settings } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/auth-provider";
import { PERMISSIONS } from "@/config/permissions";
import { useLanguage } from "@/components/language-provider";
import packageJson from "../../package.json";

const NAV_ITEMS = [
  { titleKey: "common.dashboard", href: "/", icon: Server },
  { titleKey: "common.users", href: "/users", icon: Users, permission: PERMISSIONS.USERS_READ },
  { titleKey: "common.roles", href: "/roles", icon: Shield, permission: PERMISSIONS.ROLES_READ },
  { titleKey: "common.auditLogs", href: "/audit-logs", icon: ClipboardList, permission: PERMISSIONS.AUDIT_LOGS_READ },
  { titleKey: "common.settings", href: "/settings", icon: Settings, permission: PERMISSIONS.LDAP_SYNC },
];

interface UserAvatarProps {
  avatarUrl?: string;
  displayName?: string;
  username: string;
}

function UserAvatar({ avatarUrl, displayName, username }: UserAvatarProps) {
  const [avatarError, setAvatarError] = useState(false);
  const [prevUrl, setPrevUrl] = useState<string | undefined>(undefined);

  if (avatarUrl !== prevUrl) {
    setPrevUrl(avatarUrl);
    setAvatarError(false);
  }

  const initials = displayName
    ? displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : username.slice(0, 2).toUpperCase();

  if (!avatarError && avatarUrl) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={avatarUrl}
        alt={displayName || username}
        onError={() => setAvatarError(true)}
        className="h-10 w-10 rounded-lg object-cover"
      />
    );
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-semibold border border-primary/20">
      {initials}
    </div>
  );
}

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

      <SidebarFooter className="border-t p-3 space-y-3">
        <DropdownMenu>
          <DropdownMenuTrigger render={
            <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/80 text-left transition-colors cursor-pointer select-none outline-hidden group border border-transparent hover:border-border">
              {/* Avatar Section */}
              <div className="relative shrink-0">
                <UserAvatar
                  avatarUrl={user?.avatarUrl}
                  displayName={user?.displayName}
                  username={user?.username || ""}
                />
              </div>

              {/* Text Info */}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <span className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors leading-tight">
                  {user?.displayName || user?.username}
                </span>
                <span className="text-xs text-muted-foreground truncate leading-normal mt-0.5">
                  {user?.email || `${user?.username}@amata.com`}
                </span>
              </div>
            </button>
          } />
          
          <DropdownMenuContent align="end" className="w-[240px] p-1.5" side="top" sideOffset={8}>
            <DropdownMenuItem render={<Link href="/account" />} className="flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors cursor-pointer">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{t("common.account")}</span>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator className="my-1.5" />
            
            <DropdownMenuItem 
              onClick={logout} 
              className="flex items-center gap-2 px-3 py-2 text-sm text-destructive focus:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20 rounded-md transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>{t("common.logout")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Version label */}
        <div className="text-[10px] text-muted-foreground/60 text-center font-medium select-none">
          v{packageJson.version}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
