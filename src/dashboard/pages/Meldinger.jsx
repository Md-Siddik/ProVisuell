import { useEffect, useRef, useState } from "react"
import { AlertCircle, ChevronLeft, Send } from "lucide-react"
import { api } from "../../lib/api"
import { useTranslation } from "../../i18n"

const TYPING_STALE_MS = 5000
const TYPING_POLL_MS = 2500
const TEXTAREA_MAX_HEIGHT = 88

function isRecent(dateStr) {
  return Boolean(dateStr) && Date.now() - new Date(dateStr).getTime() < TYPING_STALE_MS
}

function TypingBubble() {
  return (
    <div data-testid="typing-bubble" className="flex items-start">
      <div className="flex items-center gap-[4px] rounded-[14px] rounded-bl-[4px] border border-white/10 bg-white/[0.06] px-[14px] py-[11px]">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-[6px] w-[6px] animate-bounce rounded-full bg-white/50"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}

function timeAgo(iso, t) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return t("messagesPage.timeJustNow")
  if (mins < 60) return t("messagesPage.timeMinutes", { n: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t("messagesPage.timeHours", { n: hours })
  return new Date(iso).toLocaleDateString("no-NO", { day: "numeric", month: "short" })
}

export default function Meldinger() {
  const { t } = useTranslation()
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [active, setActive] = useState(null)
  const [draft, setDraft] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState("")
  const [customerTypingAt, setCustomerTypingAt] = useState(null)
  // Below `lg`, the list and the open thread are two separate full-width
  // screens (not a permanent split view) — this tracks which one is showing.
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)
  const listRef = useRef(null)
  const textareaRef = useRef(null)
  const lastTypingPingRef = useRef(0)
  // Shared by every fetch that can overwrite `active` (initial load, the
  // live poll, and sending a reply) — each grabs a ticket before awaiting
  // and only applies its result if no newer request has started since.
  // Without this, a slow poll response landing after you hit send could
  // overwrite your just-sent reply with stale server data, making the
  // thread appear to show a different message than what was typed.
  //
  // Two different guards are needed, not one shared counter: switching
  // conversations must discard any response for the conversation you left
  // (activeGenerationRef, bumped only on switch) — but a live poll must
  // never be allowed to overwrite state while a send to the SAME
  // conversation is in flight, even if the poll started afterward. A
  // "last request wins" rule gets this backwards: if the poll's GET reads
  // the conversation before the send's POST has actually committed, the
  // poll "wins" and wipes the optimistic message — and then the send's own
  // (correct, authoritative) response gets discarded for being "older",
  // even though the message really was saved. sendingRef closes that gap.
  const activeGenerationRef = useRef(0)
  const sendingRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function load(isFirst) {
      try {
        const { conversations } = await api.get("/messages")
        if (cancelled) return
        setConversations(conversations)
        if (isFirst && conversations.length > 0) setActiveId(conversations[0]._id)
      } catch (err) {
        console.error(err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load(true)
    // Poll so a brand new conversation (or one moving to the top, or an
    // unread badge appearing on another thread) shows up without a manual
    // refresh.
    const interval = setInterval(() => load(false), 8000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (!activeId) return
    activeGenerationRef.current += 1
    const myGeneration = activeGenerationRef.current
    setCustomerTypingAt(null)
    setSendError("")
    let cancelled = false
    async function load() {
      if (sendingRef.current) return // a reply to this conversation is in flight — let it settle first
      try {
        const { conversation } = await api.get(`/messages/${activeId}`)
        if (cancelled || sendingRef.current || myGeneration !== activeGenerationRef.current) return
        setActive(conversation)
        setCustomerTypingAt(conversation.typing?.user || null)
        // Opening this thread clears its unread badge server-side —
        // reflect that immediately in the sidebar instead of waiting for
        // the next 8s list poll.
        setConversations((prev) => prev.map((c) => (c._id === activeId ? { ...c, unreadAdminCount: 0 } : c)))
      } catch (err) {
        console.error(err)
      }
    }
    load()
    // Poll the open thread so a customer's new message — and typing status
    // — appears live.
    const interval = setInterval(load, TYPING_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [activeId])

  const pingTyping = () => {
    if (!activeId) return
    const now = Date.now()
    if (now - lastTypingPingRef.current < TYPING_POLL_MS) return
    lastTypingPingRef.current = now
    api.post(`/messages/${activeId}/typing`).catch(() => {})
  }

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" })
  }, [active, customerTypingAt])

  const handleDraftChange = (e) => {
    setDraft(e.target.value)
    if (sendError) setSendError("")
    pingTyping()
    const el = e.target
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT)}px`
  }

  const handleSend = async () => {
    const text = draft.trim()
    const sendingTo = activeId
    if (!text || !sendingTo) return
    setSendError("")
    setDraft("")
    if (textareaRef.current) textareaRef.current.style.height = "auto"

    // Optimistic echo — the reply appears instantly instead of waiting on
    // the round trip, matching the customer-facing widget's feel.
    const optimisticId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    setActive((prev) =>
      prev && prev._id === sendingTo
        ? { ...prev, messages: [...prev.messages, { _id: optimisticId, sender: "admin", text, time: new Date().toISOString() }] }
        : prev
    )

    const myGeneration = activeGenerationRef.current
    setSending(true)
    sendingRef.current = true
    try {
      const { conversation } = await api.post(`/messages/${sendingTo}`, { text })
      // Only apply if the admin hasn't switched to a different conversation
      // while this was in flight — the send's own response is always
      // authoritative for its own conversation, regardless of any poll.
      if (myGeneration === activeGenerationRef.current) setActive(conversation)
      setConversations((prev) =>
        prev
          .map((c) => (c._id === sendingTo ? { ...c, lastMessageAt: conversation.lastMessageAt } : c))
          .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
      )
    } catch (err) {
      console.error(err)
      setSendError(t("messagesPage.sendError"))
      setDraft(text) // restore the draft so a failed send doesn't silently lose what was typed
      // Drop the optimistic bubble again — it never actually made it.
      setActive((prev) => (prev && prev._id === sendingTo ? { ...prev, messages: prev.messages.filter((m) => m._id !== optimisticId) } : prev))
    } finally {
      setSending(false)
      sendingRef.current = false
    }
  }

  return (
    <div>
      <h1 className="text-[26px] font-[800] tracking-[-0.02em] text-white">{t("messagesPage.title")}</h1>
      <p className="mt-[4px] text-[14px] text-white/50">{t("messagesPage.subtitle")}</p>

      <div className="mt-[18px] grid grid-cols-1 overflow-hidden rounded-[14px] border border-white/[0.08] bg-[#111212] lg:grid-cols-[280px_1fr]" style={{ minHeight: 520 }}>
        <div className={`border-b border-white/[0.08] lg:border-b-0 lg:border-r ${mobileDetailOpen ? "hidden lg:block" : ""}`}>
          {loading && <p className="p-[16px] text-[13px] text-white/40">{t("messagesPage.loadingConversations")}</p>}
          {!loading && conversations.length === 0 && (
            <p className="p-[16px] text-[13px] text-white/40">{t("messagesPage.noConversations")}</p>
          )}
          {conversations.map((c) => {
            const unread = c.unreadAdminCount || 0
            return (
              <button
                key={c._id}
                onClick={() => {
                  setActiveId(c._id)
                  setMobileDetailOpen(true)
                }}
                className={`flex w-full items-center gap-[12px] border-b border-white/[0.06] px-[16px] py-[14px] text-left transition-colors ${
                  activeId === c._id ? "bg-[#ff4b00]/10" : "hover:bg-white/[0.03]"
                }`}
              >
                <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[13px] font-[700] text-white">
                  {(c.customerName || "?").slice(0, 2).toUpperCase()}
                </div>
                <div className="notranslate min-w-0 flex-1" translate="no">
                  <p className={`truncate text-[13.5px] ${unread > 0 ? "font-[800] text-white" : "font-[700] text-white/90"}`}>
                    {c.customerName}
                  </p>
                  <p className="truncate text-[12px] text-white/45">{c.customerEmail}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-[5px]">
                  <span className="text-[11px] text-white/35">{timeAgo(c.lastMessageAt, t)}</span>
                  {unread > 0 && (
                    <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ff4b00] px-[5px] text-[10px] font-[800] text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        <div className={`flex-col ${mobileDetailOpen ? "flex" : "hidden lg:flex"}`}>
          {!active ? (
            <div className="flex flex-1 items-center justify-center p-[24px] text-[13px] text-white/40">
              {t("messagesPage.selectConversation")}
            </div>
          ) : (
            <>
              <div className="notranslate flex items-center gap-[10px] border-b border-white/[0.08] px-[18px] py-[14px]" translate="no">
                <button
                  type="button"
                  onClick={() => setMobileDetailOpen(false)}
                  aria-label={t("messagesPage.backToList")}
                  className="-ml-[6px] flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-white/60 hover:bg-white/[0.06] hover:text-white lg:hidden"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-[700] text-white">{active.customerName}</p>
                  <p className="truncate text-[12px] text-white/45">{active.customerEmail}</p>
                </div>
              </div>

              <div ref={listRef} translate="no" className="notranslate flex-1 space-y-[10px] overflow-y-auto px-[18px] py-[16px]" style={{ maxHeight: 380 }}>
                {active.messages.map((m) => (
                  <div key={m._id} className={`flex flex-col ${m.sender === "admin" ? "items-end" : "items-start"}`}>
                    <div
                      translate="no"
                      className={`notranslate max-w-[75%] whitespace-pre-wrap break-words px-[14px] py-[9px] text-[13.5px] leading-[1.45] ${
                        m.sender === "admin"
                          ? "rounded-[14px] rounded-br-[4px] bg-[#ff4b00] text-white"
                          : "rounded-[14px] rounded-bl-[4px] border border-white/10 bg-white/[0.06] text-white/85"
                      }`}
                    >
                      {m.text}
                    </div>
                    <span className="mt-[3px] px-[2px] text-[10px] text-white/30">
                      {new Date(m.time).toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
                {isRecent(customerTypingAt) && <TypingBubble />}
              </div>

              {sendError && (
                <div className="mx-[16px] mb-[8px] flex items-center gap-[7px] rounded-[8px] border border-red-500/25 bg-red-500/10 px-[12px] py-[7px] text-[12px] text-red-300">
                  <AlertCircle size={13} className="shrink-0" />
                  {sendError}
                </div>
              )}

              <div className="flex items-end gap-[10px] border-t border-white/[0.08] px-[16px] py-[12px]">
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={handleDraftChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  rows={1}
                  placeholder={t("messagesPage.messagePlaceholder")}
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="none"
                  autoComplete="off"
                  translate="no"
                  className="notranslate max-h-[88px] flex-1 resize-none rounded-[12px] border border-white/10 bg-white/[0.05] px-[12px] py-[10px] text-[13.5px] text-white placeholder-white/40 outline-none transition-colors focus:border-[#ff4b00]"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !draft.trim()}
                  aria-label={t("messagesPage.sendAriaLabel")}
                  className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-[#ff4b00] text-white transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Send size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
