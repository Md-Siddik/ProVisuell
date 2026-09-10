// One-off migration: populates the new dynamic CmsItem collections
// (services, portfolioItems, featuredProjects) with the content that used
// to be hardcoded in Pillars.jsx / Portfolio.jsx / Results.jsx, so the
// public site's content doesn't change the moment those components switch
// to reading from MongoDB. Safe to re-run — skips a collection if it
// already has items.
import "dotenv/config"
import dns from "node:dns"
import mongoose from "mongoose"
import { CmsItem } from "../src/models/CmsItem.js"

dns.setServers(["8.8.8.8", "1.1.1.1"])
await mongoose.connect(process.env.MONGO_URI)

const T = (no, en, sv, fi, da) => ({ no, en, sv, fi, da })

async function seed(collectionKey, items) {
  const existing = await CmsItem.countDocuments({ collectionKey })
  if (existing > 0) {
    console.log(`Skipping "${collectionKey}" — already has ${existing} item(s).`)
    return
  }
  let order = 0
  for (const item of items) {
    await CmsItem.create({ collectionKey, order: order++, published: true, ...item })
  }
  console.log(`Seeded "${collectionKey}" with ${items.length} item(s).`)
}

await seed("services", [
  {
    translations: {
      name: T("Brandify", "Brandify", "Brandify", "Brandify", "Brandify"),
      description: T(
        "Merkevarestrategi, visuell identitet og digital vekst bygget for å gjøre virksomheten din minneverdig og lett å finne.",
        "Brand strategy, visual identity and digital growth built to make your business memorable and easy to find.",
        "Varumärkesstrategi, visuell identitet och digital tillväxt byggd för att göra ditt företag minnesvärt och lätt att hitta.",
        "Brändistrategia, visuaalinen identiteetti ja digitaalinen kasvu, jotka tekevät yrityksestäsi mieleenpainuvan ja helposti löydettävän.",
        "Brandstrategi, visuel identitet og digital vækst bygget til at gøre din virksomhed mindeværdig og let at finde."
      ),
      ctaText: T("Utforsk Brandify", "Explore Brandify", "Utforska Brandify", "Tutustu Brandifyyn", "Udforsk Brandify"),
    },
    link: "#contact",
    image: "/assets/result-brandify.jpg",
  },
  {
    translations: {
      name: T("Packaging", "Packaging", "Packaging", "Packaging", "Packaging"),
      description: T(
        "Emballasjedesign, etiketter, produktidentitet og produksjon med en premium, helhetlig finish.",
        "Packaging design, labels, product identity and production with a premium, consistent finish.",
        "Förpackningsdesign, etiketter, produktidentitet och produktion med en premium, enhetlig finish.",
        "Pakkaussuunnittelu, etiketit, tuoteidentiteetti ja tuotanto premium-tasoisella, yhtenäisellä viimeistelyllä.",
        "Emballagedesign, etiketter, produktidentitet og produktion med en premium, ensartet finish."
      ),
      ctaText: T("Utforsk Packaging", "Explore Packaging", "Utforska Packaging", "Tutustu Packagingiin", "Udforsk Packaging"),
    },
    link: "#contact",
    image: "/assets/packaging-hero.png",
  },
])

await seed("portfolioItems", [
  {
    translations: { title: T("Premium produktemballasje", "Premium Product Packaging", "Premium produktförpackning", "Premium-tuotepakkaus", "Premium produktemballage") },
    image: "/assets/portfolio-packaging-1.png",
  },
  {
    translations: { title: T("Etikettdetalj", "Label Detail", "Etikettdetalj", "Etikettidetalji", "Etiketdetalje") },
    image: "/assets/portfolio-label.png",
  },
  {
    translations: { title: T("Beskyttende fraktemballasje", "Protective Shipping Packaging", "Skyddande fraktförpackning", "Suojaava kuljetuspakkaus", "Beskyttende forsendelsesemballage") },
    image: "/assets/portfolio-packaging-2.png",
  },
  {
    translations: { title: T("PPF-installasjon", "PPF Installation", "PPF-installation", "PPF-asennus", "PPF-installation") },
    image: "/assets/portfolio-ppf.png",
  },
  {
    translations: { title: T("Kjøretøyfinish", "Vehicle Finish", "Fordonsfinish", "Ajoneuvon viimeistely", "Køretøjsfinish") },
    image: "/assets/portfolio-car.png",
  },
  {
    translations: { title: T("Beskyttelsesdetalj", "Protection Detail", "Skyddsdetalj", "Suojausdetalji", "Beskyttelsesdetalje") },
    image: "/assets/portfolio-protection.png",
  },
])

await seed("featuredProjects", [
  {
    translations: {
      title: T("Brandify", "Brandify", "Brandify", "Brandify", "Brandify"),
      category: T("MERKEIDENTITET", "BRAND IDENTITY", "VARUMÄRKESIDENTITET", "BRÄNDI-IDENTITEETTI", "BRANDIDENTITET"),
    },
    image: "/assets/result-brandify.jpg",
  },
  {
    translations: {
      title: T("Packaging", "Packaging", "Packaging", "Packaging", "Packaging"),
      category: T("EMBALLASJEDESIGN", "PACKAGING DESIGN", "FÖRPACKNINGSDESIGN", "PAKKAUSSUUNNITTELU", "EMBALLAGEDESIGN"),
    },
    image: "/assets/result-packaging.jpg",
  },
  {
    translations: {
      title: T("Vehicle Protection", "Vehicle Protection", "Vehicle Protection", "Vehicle Protection", "Vehicle Protection"),
      category: T("WINDOW TINT & PPF", "WINDOW TINT & PPF", "WINDOW TINT & PPF", "WINDOW TINT & PPF", "WINDOW TINT & PPF"),
    },
    image: "/assets/result-vehicle.jpg",
  },
])

await seed("headerNav", [
  { translations: { label: T("Hjem", "Home", "Hem", "Koti", "Hjem") }, link: "/" },
  { translations: { label: T("Tjenester", "Services", "Tjänster", "Palvelut", "Tjenester") }, link: "#services" },
  { translations: { label: T("Prosjekter", "Projects", "Projekt", "Projektit", "Projekter") }, link: "#projects" },
  { translations: { label: T("Om oss", "About", "Om oss", "Meistä", "Om os") }, link: "#about" },
  { translations: { label: T("Kontakt", "Contact", "Kontakt", "Yhteystiedot", "Kontakt") }, link: "#contact" },
])

await seed("heroServices", [
  { translations: { name: T("Packaging", "Packaging", "Packaging", "Packaging", "Packaging") } },
  { translations: { name: T("Window Tint", "Window Tint", "Window Tint", "Window Tint", "Window Tint") } },
  { translations: { name: T("PPF", "PPF", "PPF", "PPF", "PPF") } },
])

await seed("socialLinks", [
  { translations: { platform: T("Instagram", "Instagram", "Instagram", "Instagram", "Instagram") }, link: "#", image: "instagram" },
  { translations: { platform: T("Facebook", "Facebook", "Facebook", "Facebook", "Facebook") }, link: "#", image: "facebook" },
  { translations: { platform: T("LinkedIn", "LinkedIn", "LinkedIn", "LinkedIn", "LinkedIn") }, link: "#", image: "linkedin" },
])

await mongoose.disconnect()
console.log("Done.")
