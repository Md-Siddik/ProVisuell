import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { ChevronDown, LayoutDashboard, LogOut, Plus, ShoppingBag, User } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { logout } from "../lib/firebaseAuth"
import { getDisplayName } from "../lib/displayName"
import { OPEN_ORDER_EVENT } from "./StartOrderModal"
import NotificationBell from "./NotificationBell"
import { useTranslation, LANGUAGES } from "../i18n"
import EditableText from "../dashboard/editor/EditableText"
import { useEditorMode } from "../dashboard/editor/EditorModeContext"
import { useCmsCollection } from "../dashboard/editor/useCmsCollection"
import CmsItemToolbar from "../dashboard/editor/CmsItemToolbar"
import CmsItemEditor from "../dashboard/editor/CmsItemEditor"

const NAV_ITEM_FIELDS = [{ key: "label", label: "Label", type: "text" }]

const Logo = () => {
  return (
    <a
      href="#home"
      className="notranslate flex items-center leading-none"
      aria-label="ProVisuell Home"
      translate="no"
    >
      <span className="text-[25px] font-[800] tracking-[-0.04em] text-[#ff4b00] md:text-[27px]">
        Pro
      </span>

      <span className="text-[25px] font-[800] tracking-[-0.04em] text-white md:text-[27px]">
        Visuell
      </span>
    </a>
  )
}

const MenuIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className="h-[22px] w-[22px]"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M4 7H20M4 12H20M4 17H20"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  </svg>
)

const CloseIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className="h-[22px] w-[22px]"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M6 6L18 18M18 6L6 18"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
)

const openStartOrder = () => window.dispatchEvent(new Event(OPEN_ORDER_EVENT))

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef(null)
  const { isAuthenticated, needsEmailVerification, profile, firebaseUser } = useAuth()
  // Pending email verification is a Firebase session with no application
  // access yet — don't let the bell fire an authenticated fetch for it.
  const showNotifications = isAuthenticated && !needsEmailVerification
  const { language, setLanguage, t } = useTranslation()
  const { enabled } = useEditorMode()
  const { items: navLinks, addItem, updateItem, deleteItem, reorder } = useCmsCollection("headerNav")
  const [editingNavItem, setEditingNavItem] = useState(null)
  const [navEditAnchor, setNavEditAnchor] = useState(null)
  const navAnchorRef = { current: navEditAnchor }

  const openNavEditor = (item, e) => {
    setNavEditAnchor(e.currentTarget)
    setEditingNavItem(item)
  }

  const moveNavItem = (index, dir) => {
    const next = [...navLinks]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    reorder(next.map((i) => i._id))
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    const onClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  return (
    <header
      className={`fixed left-0 top-0 z-50 w-full transition-colors duration-300 ${
        scrolled ? "border-b border-white/10 bg-[#0a0a0a]/95 backdrop-blur-md" : "bg-transparent"
      }`}
    >
      <div className="flex h-[78px] w-full items-center justify-between gap-[8px] px-[16px] sm:px-[28px] md:px-[36px] lg:px-[40px] xl:px-[46px]">
        <Logo />

        <div className="hidden items-center lg:flex">
          <div
            translate="no"
            className="notranslate mr-[27px] flex items-center gap-[7px] text-[11px] font-[600] uppercase tracking-[0.07em]"
          >
            {LANGUAGES.map((lng, i) => (
              <div key={lng.code} className="flex items-center gap-[7px]">
                {i > 0 && <span className="text-white/35">/</span>}
                <button
                  type="button"
                  onClick={() => setLanguage(lng.code)}
                  className={`transition-colors duration-200 hover:text-white ${language === lng.code ? "text-white" : "text-white/60"}`}
                >
                  {lng.label}
                </button>
              </div>
            ))}
          </div>

          <nav className="flex items-center gap-[25px] xl:gap-[29px]">
            {navLinks.map((item, index) => {
              const NavTag = (item.link || "").startsWith("#") ? "a" : Link
              const navProps = NavTag === "a" ? { href: item.link || "#" } : { to: item.link || "/" }
              return (
                <span
                  key={item._id}
                  className={`group relative inline-flex ${enabled && !item.published ? "opacity-40" : ""}`}
                >
                  <NavTag
                    {...navProps}
                    onClick={enabled ? (e) => e.preventDefault() : undefined}
                    onDoubleClick={enabled ? (e) => openNavEditor(item, e) : undefined}
                    className="relative py-[9px] text-[12px] font-[600] tracking-[0.01em] text-white/85 transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-[#ff4b00] after:transition-all after:duration-300 hover:text-white hover:after:w-full xl:text-[13px]"
                    title={enabled ? "Double-click to edit" : undefined}
                  >
                    {item.label}
                  </NavTag>
                  {enabled && (
                    <CmsItemToolbar
                      orientation="horizontal"
                      published={item.published}
                      onEdit={(e) => openNavEditor(item, e)}
                      onDelete={() => confirm(t("common.confirmDeleteItem", { name: item.label })) && deleteItem(item._id)}
                      onTogglePublish={() => updateItem(item._id, { published: !item.published })}
                      onMoveUp={() => moveNavItem(index, -1)}
                      onMoveDown={() => moveNavItem(index, 1)}
                      canMoveUp={index > 0}
                      canMoveDown={index < navLinks.length - 1}
                      className="pv-cms-toolbar-inline"
                    />
                  )}
                </span>
              )
            })}
            {enabled && (
              <button
                type="button"
                onClick={(e) => openNavEditor({}, e)}
                className="flex h-[24px] w-[24px] items-center justify-center rounded-[6px] border border-dashed border-[#ff4b00]/60 text-[#ff4b00] hover:bg-[#ff4b00]/10"
                title="Add nav item"
              >
                <Plus size={14} />
              </button>
            )}
          </nav>

          {isAuthenticated ? (
            <div className="ml-[28px] flex items-center gap-[10px]">
              {showNotifications && <NotificationBell />}
              <div ref={profileRef} className="relative">
                <button
                  type="button"
                  onClick={() => setProfileOpen((v) => !v)}
                  className="flex items-center gap-[9px] rounded-full border border-white/15 py-[5px] pl-[6px] pr-[11px] text-white transition-colors hover:border-white/35"
                >
                  <span className="flex h-[27px] w-[27px] items-center justify-center rounded-full bg-[#ff4b00]/20 text-[#ff4b00]">
                    <User size={14} strokeWidth={2.2} />
                  </span>
                  <span className="max-w-[120px] truncate text-[12px] font-[600]">{getDisplayName(profile, firebaseUser)}</span>
                  <ChevronDown size={14} className={`text-white/60 transition-transform ${profileOpen ? "rotate-180" : ""}`} />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-[calc(100%+8px)] w-[190px] overflow-hidden rounded-[10px] border border-white/10 bg-[#141515] py-[6px] shadow-xl">
                    <Link
                      to="/dashboard"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-[10px] px-[14px] py-[10px] text-[13px] font-[600] text-white/85 hover:bg-white/[0.06]"
                    >
                      <LayoutDashboard size={15} className="text-white/50" />
                      <EditableText k="header.myPage" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false)
                        logout()
                      }}
                      className="flex w-full items-center gap-[10px] px-[14px] py-[10px] text-left text-[13px] font-[600] text-white/85 hover:bg-white/[0.06]"
                    >
                      <LogOut size={15} className="text-white/50" />
                      <EditableText k="header.logout" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <Link
              to="/login"
              className="ml-[28px] rounded-[7px] bg-[#ff4b00] px-[19px] py-[10px] text-[12px] font-[800] uppercase tracking-[0.03em] text-white transition-all duration-200 hover:brightness-110 xl:text-[13px]"
            >
              <EditableText k="header.login" />
            </Link>
          )}

          <button
            type="button"
            onClick={openStartOrder}
            className="ml-[18px] flex h-[37px] items-center gap-[13px] border border-white/50 px-[18px] text-[11px] font-[700] uppercase tracking-[0.045em] text-white transition-all duration-200 hover:border-[#ff4b00] hover:bg-[#ff4b00] hover:text-white"
          >
            <span><EditableText k="header.startProject" /></span>

            <span className="text-[14px] leading-none">
              ↗
            </span>
          </button>
        </div>

        {/* Mobile-only cluster: notification bell, a compact always-visible
            Order Now CTA, and the sidebar/menu trigger — grouped together so
            none of them ever end up isolated off past the edge of a small
            screen, and the primary CTA is visible without opening the menu. */}
        <div className="flex shrink-0 items-center gap-[8px] lg:hidden">
          {showNotifications && <NotificationBell />}

          <button
            type="button"
            onClick={openStartOrder}
            className="flex h-[36px] shrink-0 items-center gap-[6px] rounded-[8px] bg-[#ff4b00] px-[10px] text-[10px] font-[800] uppercase tracking-[0.03em] text-white"
          >
            <ShoppingBag size={14} className="shrink-0" />
            <span className="hidden min-[360px]:inline whitespace-nowrap">
              <EditableText k="header.startProject" />
            </span>
          </button>

          <button
            type="button"
            aria-label={t("header.menuAriaLabel")}
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-[36px] w-[36px] shrink-0 items-center justify-center border border-white/40 text-white"
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      <div
        className={`absolute left-0 top-[78px] w-full overflow-y-auto bg-[#0b0b0b]/95 backdrop-blur-xl transition-all duration-300 lg:hidden ${
          menuOpen
            ? "max-h-[calc(100vh-78px)] border-t border-white/10 opacity-100"
            : "max-h-0 opacity-0"
        }`}
      >
        <nav className="flex flex-col px-[16px] py-[20px] sm:px-[24px] sm:py-[24px]">
          {navLinks.map((item, index) => {
            const NavTag = (item.link || "").startsWith("#") ? "a" : Link
            const navProps = NavTag === "a" ? { href: item.link || "#" } : { to: item.link || "/" }
            return (
              <span key={item._id} className={`group relative flex items-center justify-between border-b border-white/10 py-[16px] ${enabled && !item.published ? "opacity-40" : ""}`}>
                <NavTag {...navProps} onClick={() => setMenuOpen(false)} className="text-[14px] font-[600] text-white">
                  {item.label}
                </NavTag>
                {enabled && (
                  <CmsItemToolbar
                    published={item.published}
                    onEdit={(e) => openNavEditor(item, e)}
                    onDelete={() => confirm(t("common.confirmDeleteItem", { name: item.label })) && deleteItem(item._id)}
                    onTogglePublish={() => updateItem(item._id, { published: !item.published })}
                    onMoveUp={() => moveNavItem(index, -1)}
                    onMoveDown={() => moveNavItem(index, 1)}
                    canMoveUp={index > 0}
                    canMoveDown={index < navLinks.length - 1}
                    className="pv-cms-toolbar-static"
                  />
                )}
              </span>
            )
          })}
          {enabled && (
            <button type="button" onClick={(e) => openNavEditor({}, e)} className="pv-add-item-btn mt-[10px] w-fit">
              + Add Nav Item
            </button>
          )}

          <div
            translate="no"
            className="notranslate flex flex-wrap items-center gap-[10px] border-b border-white/10 py-[16px] text-[13px] font-[700] uppercase tracking-[0.05em]"
          >
            {LANGUAGES.map((lng, i) => (
              <div key={lng.code} className="flex items-center gap-[10px]">
                {i > 0 && <span className="text-white/25">/</span>}
                <button type="button" onClick={() => setLanguage(lng.code)} className={language === lng.code ? "text-white" : "text-white/50"}>
                  {lng.label}
                </button>
              </div>
            ))}
          </div>

          {isAuthenticated ? (
            <>
              <div className="flex items-center gap-[12px] border-b border-white/10 py-[16px]">
                <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#ff4b00]/20 text-[#ff4b00]">
                  <User size={17} strokeWidth={2.2} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-[700] text-white">{getDisplayName(profile, firebaseUser)}</p>
                  <p className="truncate text-[11px] text-white/45">{profile?.email}</p>
                </div>
              </div>
              <Link
                to="/dashboard"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-[10px] border-b border-white/10 py-[16px] text-[14px] font-[600] text-white"
              >
                <LayoutDashboard size={16} className="text-white/50" />
                <EditableText k="header.myPage" />
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  logout()
                }}
                className="flex items-center gap-[10px] border-b border-white/10 py-[16px] text-left text-[14px] font-[600] text-white"
              >
                <LogOut size={16} className="text-white/50" />
                <EditableText k="header.logout" />
              </button>
            </>
          ) : (
            <Link
              to="/login"
              onClick={() => setMenuOpen(false)}
              className="mt-[6px] flex h-[45px] items-center justify-center rounded-[7px] bg-[#ff4b00] text-[12px] font-[800] uppercase tracking-[0.04em] text-white"
            >
              <EditableText k="header.login" />
            </Link>
          )}

          <button
            type="button"
            onClick={() => {
              setMenuOpen(false)
              openStartOrder()
            }}
            className="mt-[14px] flex h-[45px] items-center justify-center border border-white/40 text-[12px] font-[800] uppercase tracking-[0.04em] text-white"
          >
            <EditableText k="header.startProject" />
          </button>
        </nav>
      </div>

      <CmsItemEditor
        key={editingNavItem?._id || (editingNavItem ? "new" : "closed")}
        anchorRef={navAnchorRef}
        open={editingNavItem !== null}
        fieldsConfig={NAV_ITEM_FIELDS}
        hasLink
        item={editingNavItem?._id ? editingNavItem : null}
        addItem={addItem}
        updateItem={updateItem}
        onClose={() => setEditingNavItem(null)}
      />
    </header>
  )
}

export default Header
