const fs = require('fs');
const path = require('path');

// Ensure the path is correct for both local and CI environments
const file = path.resolve(__dirname, 'lib/translations.ts');
if (!fs.existsSync(file)) {
  console.warn(`File not found: ${file}. Skipping translation update.`);
  process.exit(0);
}

let content = fs.readFileSync(file, 'utf8');

const additions = {
    en: {
        nav: `
      adminHome: "ADMIN HOME",
      ownerCommand: "OWNER COMMAND",
      myOrderTransaction: "My Order Transaction",
      myTipsGratuity: "My Tips & Gratuity",
      kitchenBoard: "Kitchen Board",
      floorLiveMap: "Floor Live Map",
      tipsAudit: "Tips & Gratuity Audit",
      wasteAnalytics: "Waste Analytics",`,
        extra: `
    tableStatus: {
      filters: { all: "ALL", indoor: "INDOOR", outdoor: "OUTDOOR", vip: "VIP", bar: "BAR" },
      view: { live: "LIVE", map: "MAP", data: "DATA" },
      actions: { setup: "SETUP", syncOn: "SYNC ON", table: "TABLE" },
      stats: { total: "Total", free: "Free", inUse: "In Use", dirty: "Dirty", load: "Load" },
      metrics: { score: "SCORE", orders: "ORDERS", history: "HISTORY" }
    },
    analytics: {
      period: { today: "today", week: "week", month: "month" }
    },`
    },
    am: {
        nav: `
      adminHome: "የአስተዳደር ማዕከል",
      ownerCommand: "ዋና ማዘዣ",
      myOrderTransaction: "የእኔ ትዕዛዞች",
      myTipsGratuity: "የእኔ ጉርሻዎች",
      kitchenBoard: "የወጥ ቤት ስክሪን",
      floorLiveMap: "የጠረጴዛዎች ካርታ",
      tipsAudit: "የጉርሻ ቁጥጥር",
      wasteAnalytics: "የብክነት ትንታኔ",`,
        extra: `
    tableStatus: {
      filters: { all: "ሁሉም", indoor: "ውስጥ", outdoor: "ውጪ", vip: "ልዩ (VIP)", bar: "ባር" },
      view: { live: "ቀጥታ", map: "ካርታ", data: "መረጃ" },
      actions: { setup: "አደራጅ", syncOn: "ማስተካከያ", table: "ጠረጴዛ" },
      stats: { total: "ጠቅላላ", free: "ክፍት", inUse: "የተያዘ", dirty: "ለማፅዳት", load: "ስራ ጫና" },
      metrics: { score: "ነጥብ", orders: "ትዕዛዞች", history: "ታሪክ" }
    },
    analytics: {
      period: { today: "ዛሬ", week: "ሳምንት", month: "ወር" }
    },`
    },
    om: {
        nav: `
      adminHome: "Giddugala Bulchiinsaa",
      ownerCommand: "Ajaja Abbaa Qabeenyaa",
      myOrderTransaction: "Ajaja fi Herrega Koo",
      myTipsGratuity: "Badhaasa Koo",
      kitchenBoard: "Gabatee Kushinaa",
      floorLiveMap: "Kaartaa Minjaalaa",
      tipsAudit: "To'annoo Badhaasaa",
      wasteAnalytics: "Xiinxala Kasaaraa",`,
        extra: `
    tableStatus: {
      filters: { all: "HUNDAA", indoor: "KEESSA", outdoor: "ALAA", vip: "VIP", bar: "BAARII" },
      view: { live: "KALLATTII", map: "KAARTAA", data: "DAATAA" },
      actions: { setup: "QINDAA'INA", syncOn: "WAL-QABSIISI", table: "MINJAALA" },
      stats: { total: "Waliigala", free: "Duwwaa", inUse: "Qabameera", dirty: "Qulqullaa'uu Qaba", load: "Faa'idaarra" },
      metrics: { score: "QABXII", orders: "AJAJA", history: "SEENAA" }
    },
    analytics: {
      period: { today: "har'a", week: "torbee", month: "ji'a" }
    },`
    },
    ti: {
        nav: `
      adminHome: "ማእከል ምምሕዳር",
      ownerCommand: "ቀንዲ ትእዛዝ",
      myOrderTransaction: "ትእዛዛተይን ሕሳበይን",
      myTipsGratuity: "ናተይ ጉርሻ",
      kitchenBoard: "ስክሪን ክሽነ",
      floorLiveMap: "ካርታ ጣውላታት",
      tipsAudit: "ቁጽጽር ጉርሻ",
      wasteAnalytics: "ትንተና ክሳራ",`,
        extra: `
    tableStatus: {
      filters: { all: "ኩሉ", indoor: "ውሽጢ", outdoor: "ደገ", vip: "ፍሉይ (VIP)", bar: "ባር" },
      view: { live: "ቀጥታ", map: "ካርታ", data: "ሓበሬታ" },
      actions: { setup: "ኣዳሉ", syncOn: "ምትእስሳር", table: "ጣውላ" },
      stats: { total: "ጠቕላላ", free: "ክፉት", inUse: "ዝተትሓዘ", dirty: "ክጸሪ ዘለዎ", load: "ጸቕጢ ስራሕ" },
      metrics: { score: "ነጥቢ", orders: "ትእዛዛት", history: "ታሪኽ" }
    },
    analytics: {
      period: { today: "ሎሚ", week: "ሰሙን", month: "ወርሒ" }
    },`
    },
    af: {
        nav: `
      adminHome: "Taama Abak Majlis",
      ownerCommand: "Amri Buqre",
      myOrderTransaction: "Yi Amri Kee Hisaab",
      myTipsGratuity: "Yi Maqanqara",
      kitchenBoard: "Kishin Gabate",
      floorLiveMap: "Midiira Kaarta",
      tipsAudit: "Maqanqara Taama",
      wasteAnalytics: "Bayte Macaada",`,
        extra: `
    tableStatus: {
      filters: { all: "UMMAN", indoor: "ADDA", outdoor: "GUUB", vip: "VIP", bar: "BAAR" },
      view: { live: "CABBIL", map: "KAARTA", data: "DATA" },
      actions: { setup: "QINDAAM", syncOn: "TAQABAL", table: "MIDIIRA" },
      stats: { total: "Maraaki", free: "Gufne", inUse: "Beeta", dirty: "Qulqulle", load: "Buqre" },
      metrics: { score: "QABXI", orders: "AMRI", history: "TAARIX" }
    },
    analytics: {
      period: { today: "asaaku", week: "ayyaama", month: "alsa" }
    },`
    }
};

for (const lang of ['en', 'am', 'om', 'ti', 'af']) {
    // Insert into nav
    // Using parentheses to create capturing groups for $1
    const navRegex = new RegExp(`(${lang}: {[\\s\\S]*?nav: {)`);
    content = content.replace(navRegex, `$1${additions[lang].nav}`);

    // Insert extra blocks before footer
    // Using parentheses to create capturing groups for $1 and $2
    const injectTargetRegex = new RegExp(`(${lang}: {[\\s\\S]*?)(footer: {)`);
    content = content.replace(injectTargetRegex, `$1${additions[lang].extra}\n    $2`);
}

// Write back
fs.writeFileSync(file, content);
console.log("Translations updated!");
