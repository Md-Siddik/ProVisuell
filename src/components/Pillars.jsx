import { useState } from "react"
import { useEditorMode } from "../dashboard/editor/EditorModeContext"
import { useCmsCollection } from "../dashboard/editor/useCmsCollection"
import CmsItemToolbar from "../dashboard/editor/CmsItemToolbar"
import CmsItemEditor from "../dashboard/editor/CmsItemEditor"
import AddCmsItemButton from "../dashboard/editor/AddCmsItemButton"

const FIELDS = [
  { key: "name", label: "Service name", type: "text" },
  { key: "description", label: "Short description", type: "textarea" },
  { key: "ctaText", label: "CTA button text", type: "text" },
]

function slugify(name) {
  return (name || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

export default function Pillars() {
  const { enabled } = useEditorMode()
  const { items, addItem, updateItem, deleteItem, reorder } = useCmsCollection("services")
  const [editingItem, setEditingItem] = useState(null) // null = closed, {} = new item, item = editing
  const [editAnchor, setEditAnchor] = useState(null)
  const anchorRef = { current: editAnchor }

  const openEditor = (item, e) => {
    setEditAnchor(e.currentTarget)
    setEditingItem(item)
  }

  // Public reads are already published-only (filtered server-side); admin
  // reads include hidden items too, dimmed in the preview — so no extra
  // client-side filter is needed (or safe: the public shape has no
  // `published` field at all, so filtering on it here would drop everything).
  const visibleItems = items

  const move = (index, dir) => {
    const next = [...visibleItems]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    reorder(next.map((i) => i._id))
  }

  return (
    <section className="bg-paper pb-5">
      <div className="page-shell space-y-5">
        {visibleItems.map((item, index) => (
          <article
            key={item._id}
            id={slugify(item.name) || undefined}
            className={`group relative min-h-[70vh] overflow-hidden bg-black text-white sm:min-h-[78vh] lg:min-h-[90vh] ${
              enabled && !item.published ? "opacity-40" : ""
            }`}
          >
            <div className="absolute inset-0">
              {item.video ? (
                <video autoPlay muted loop playsInline preload="auto" className="h-full w-full object-cover">
                  <source src={item.video} type="video/mp4" />
                </video>
              ) : (
                <img
                  src={item.image}
                  alt=""
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]"
                />
              )}
            </div>
            <div className="image-scrim absolute inset-0" />
            <div className="relative z-10 flex min-h-[70vh] items-center px-7 py-10 sm:min-h-[78vh] sm:px-12 lg:min-h-[90vh] lg:px-16">
              <div className="max-w-[470px]">
                <h2 className="display-title text-[48px] sm:text-[58px] lg:text-[64px]">{item.name}</h2>
                <p className="mt-5 max-w-[430px] text-sm leading-7 text-white/[0.82] sm:text-[15px]">{item.description}</p>
                {item.ctaText && (
                  <a href={item.link || "#contact"} className="outline-button mt-7 border-white/60 text-white">
                    {item.ctaText}
                  </a>
                )}
              </div>
            </div>

            {enabled && (
              <CmsItemToolbar
                published={item.published}
                onEdit={(e) => openEditor(item, e)}
                onDelete={() => confirm(`Delete "${item.name}"?`) && deleteItem(item._id)}
                onTogglePublish={() => updateItem(item._id, { published: !item.published })}
                onMoveUp={() => move(index, -1)}
                onMoveDown={() => move(index, 1)}
                canMoveUp={index > 0}
                canMoveDown={index < visibleItems.length - 1}
              />
            )}
          </article>
        ))}
      </div>

      {enabled && (
        <div className="page-shell mt-5">
          <AddCmsItemButton label="Add Service" onClick={(e) => openEditor({}, e)} />
        </div>
      )}

      <CmsItemEditor
        key={editingItem?._id || (editingItem ? "new" : "closed")}
        anchorRef={anchorRef}
        open={editingItem !== null}
        fieldsConfig={FIELDS}
        hasLink
        hasVideo
        item={editingItem?._id ? editingItem : null}
        addItem={addItem}
        updateItem={updateItem}
        onClose={() => setEditingItem(null)}
      />
    </section>
  )
}
