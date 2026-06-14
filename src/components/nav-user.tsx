"use client"

import * as React from "react"
import Link from "next/link"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { ChevronsUpDown, User, LogOut } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { useLanguage } from "@/components/language-provider"

export function NavUser() {
  const { user, logout } = useAuth()
  const { t } = useLanguage()
  const { isMobile } = useSidebar()
  const [avatarError, setAvatarError] = React.useState(false)
  const [prevAvatarUrl, setPrevAvatarUrl] = React.useState(user?.avatarUrl)

  if (user?.avatarUrl !== prevAvatarUrl) {
    setPrevAvatarUrl(user?.avatarUrl)
    setAvatarError(false)
  }

  if (!user) return null

  const name = user.displayName || user.username
  const email = user.email || `${user.username}@amata.com`
  const initials = user.displayName
    ? user.displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : user.username.slice(0, 2).toUpperCase()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <Avatar className="h-8 w-8 rounded-lg">
              {!avatarError && user.avatarUrl && (
                <AvatarImage 
                  src={user.avatarUrl} 
                  alt={name} 
                  onError={() => setAvatarError(true)}
                />
              )}
              <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold text-foreground">
                {name}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {email}
              </span>
            </div>
            <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[220px]"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={8}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    {!avatarError && user.avatarUrl && (
                      <AvatarImage 
                        src={user.avatarUrl} 
                        alt={name} 
                        onError={() => setAvatarError(true)}
                      />
                    )}
                    <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold text-foreground">{name}</span>
                    <span className="truncate text-xs text-muted-foreground">{email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              render={<Link href="/account" />} 
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors cursor-pointer"
            >
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{t("common.account")}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 text-sm text-destructive focus:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20 rounded-md transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>{t("common.logout")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
