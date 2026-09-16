import { NavLink, Outlet, useLocation } from "react-router-dom"
import {
  CalendarClock,
  ClipboardList,
  CreditCard,
  FilePlus2,
  Globe,
  Home,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageSquare,
  Settings,
  TrendingUp,
  Wallet,
} from "lucide-react"
import Logo from "../components/Logo"
import NotificationBell from "../components/NotificationBell"
import UnreadBadge from "../components/UnreadBadge"
import { useAuth } from "../context/AuthContext"
import { logout } from "../lib/firebaseAuth"
import { useUnreadMessages } from "../hooks/useUnreadMessages"
import { useTranslation } from "../i18n"

function navItemsFor(t, role, base) {
  const items = [
    { to: "/", end: true, label: t("nav.home"), icon: Home },
    { to: `${base}`, end: true, label: t("nav.dashboard"), icon: LayoutDashboard },
    { to: `${base}/ansattmoter`, label: t("nav.appointments"), icon: CalendarClock },
    { to: `${base}/meldinger`, label: t("nav.messages"), icon: MessageSquare },
  ]
  items.push({ to: `${base}/ordre/ny`, label: t("nav.newOrder"), icon: FilePlus2 })
  items.push({ to: `${base}/ordreoversikt`, label: t("nav.orderOverview"), icon: ClipboardList })
  items.push({ to: `${base}/kundebetalinger`, label: t("nav.customerPayments"), icon: CreditCard })
  items.push({ to: `${base}/utgifter`, label: t("nav.expenses"), icon: Wallet })
  items.push({ to: `${base}/rapporter`, label: t("nav.reports"), icon: TrendingUp })
  items.push({ to: `${base}/lokasjoner`, label: t("nav.locations"), icon: MapPin })
  if (role === "administrator") {
    items.push({ to: `${base}/website-editor`, label: t("nav.websiteEditor"), icon: Globe })
  }
  return items
}

export default function DashboardLayout() {
  const { profile, role } = useAuth()
  const location = useLocation()
  const { t } = useTranslation()
  const ROLE_LABEL = { owner: t("roles.owner"), administrator: t("roles.administrator"), customer: t("roles.customer") }
  const base = role === "owner" ? "/dashboard/owner" : "/dashboard/admin"
  const items = navItemsFor(t, role, base)

  // A dedicated badge on the "Meldinger" icon itself, separate from (and in
  // addition to) the generic notification bell, so a new customer message
  // is visible without opening the bell dropdown. Shared with the public
  // header and dashboard home via the same hook, so all three agree.
  const unreadMessages = useUnreadMessages()

  const initials = (profile?.name || profile?.email || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div className="flex h-screen w-full overflow-hidden bg-black text-white">
      <aside className="hidden h-full w-[260px] shrink-0 flex-col border-r border-white/[0.08] bg-[#0a0a0a] px-[20px] py-[24px] lg:flex">
        <Logo className="shrink-0 px-[8px] text-[22px]" />

        <nav className="mt-[32px] min-h-0 flex-1 space-y-[4px] overflow-y-auto">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-[12px] rounded-[10px] px-[14px] py-[11px] text-[14px] font-[600] transition-colors ${
                  isActive
                    ? "border border-[#ff4b00]/40 bg-[#ff4b00]/10 text-[#ff4b00]"
                    : "text-white/65 hover:bg-white/[0.05] hover:text-white"
                }`
              }
            >
              <item.icon size={17} />
              {item.label}
              {item.to.endsWith("/meldinger") && <UnreadBadge count={unreadMessages} className="ml-auto" />}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex shrink-0 flex-col gap-[4px] border-t border-white/[0.08] pt-[14px]">
          <button className="flex items-center gap-[12px] rounded-[10px] px-[14px] py-[11px] text-[14px] font-[600] text-white/50 transition-colors hover:bg-white/[0.05] hover:text-white">
            <Settings size={17} />
            {t("nav.settings")}
          </button>
          <button
            onClick={() => logout()}
            className="flex items-center gap-[12px] rounded-[10px] px-[14px] py-[11px] text-[14px] font-[600] text-white/50 transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            <LogOut size={17} />
            {t("nav.logout")}
          </button>
        </div>
      </aside>

      <div className="flex h-full min-w-0 flex-1 flex-col">
        <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-white/[0.08] bg-[#0a0a0a] px-[20px] lg:px-[28px]">
          <Logo className="text-[19px] lg:hidden" />
          <span className="hidden text-[15px] font-[600] text-white/80 lg:block">
            {items.find((i) => location.pathname === i.to)?.label || t("nav.dashboard")}
          </span>

          <div className="flex items-center gap-[14px]">
            <NotificationBell />
            <div className="flex items-center gap-[10px]">
              <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#ff4b00]/15 text-[13px] font-[700] text-[#ff4b00]">
                {initials}
              </div>
              <div className="hidden text-right sm:block">
                <p className="text-[13px] font-[700] leading-none text-white">
                  {profile?.name || profile?.email?.split("@")[0] || ""}
                </p>
                <p className="mt-[3px] text-[11px] leading-none text-white/45">{ROLE_LABEL[role] || role}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-[#0d0d0d] p-[20px] lg:p-[32px]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
