
export type Language = 'en' | 'am' | 'om' | 'ti';

export const translations = {
  en: {
    common: {
      search: "Search command...",
      notifications: "Notifications",
      revenue: "Revenue",
      needHelp: "Need Help?",
      contactSupport: "Contact Support",
      logout: "Sign Out",
      profile: "Profile",
      today: "Today",
      loading: "Loading...",
      retry: "Retry",
      back: "Back",
      verify: "Verify",
      cancel: "Cancel",
      confirm: "Confirm",
      close: "Close"
    },
    roles: {
      owner: "Owner",
      manager: "Manager",
      waiter: "Waiter",
      kitchen: "Kitchen",
      admin: "Admin",
      security: "Security"
    },
    nav: {
      dashboard: "Dashboard",
      overview: "Overview",
      menuAnalytics: "Menu Analytics",
      inventory: "Inventory",
      staffPerf: "Staff Perf.",
      tableMap: "Table Map",
      opsDashboard: "Ops Dashboard",
      staff: "Staff",
      orders: "Orders",
      myStation: "My Station",
      kds: "Kitchen Display",
      pantry: "Pantry",
      settings: "Settings"
    },
    landing: {
      title: "Sosha OS",
      subtitle: "Select your workspace",
      poweredBy: "powered by withramin.ai",
      roles: {
        owner: { label: "Owner / Admin", sub: "System Control", tag: "Management" },
        manager: { label: "Manager", sub: "Operations Lead", tag: "Oversight" },
        waiter: { label: "Waiter", sub: "Table Service", tag: "Front of House" },
        kitchen: { label: "Kitchen", sub: "KDS Display", tag: "Back of House" }
      }
    },
    login: {
      title: "Login",
      subtitle: "Enter your credentials",
      email: "Email",
      password: "Password",
      signIn: "Sign In",
      verifying: "Verifying...",
      firstTime: "First time? Sign up here",
      backToRoles: "Back to Role Selection",
      welcomeBack: "Welcome back!",
      error: "Login failed"
    },
    dashboard: {
      title: "Operations Overview",
      subtitle: "Real-time snapshot",
      kpi: {
        revenue: "Today's Revenue",
        orders: "Order Volume",
        inventory: "Inventory Health",
        staff: "Staff Load",
        critical: "Critical",
        active: "Active"
      },
      kitchenStatus: "Kitchen Status",
      avgPrepTime: "Avg Prep Time",
      tableService: "Table Service",
      occupied: "Occupied",
      lossIndicators: "Loss Indicators",
      remadeDishes: "Remade Dishes",
      canceledOrders: "Canceled Orders",
      estWaste: "Est. Daily Waste"
    }
  },
  am: {
    common: {
      search: "ፈልግ...",
      notifications: "ማስታወቂያዎች",
      revenue: "ገቢ",
      needHelp: "እርዳታ ይፈልጋሉ?",
      contactSupport: "ድጋፍ ያግኙ",
      logout: "ውጣ",
      profile: "መገለጫ",
      today: "ዛሬ",
      loading: "በመጫን ላይ...",
      retry: "እንደገና ሞክር",
      back: "መለስ",
      verify: "አረጋግጥ",
      cancel: "ሰርዝ",
      confirm: "አረጋግጥ",
      close: "ዝጋ"
    },
    roles: {
      owner: "ባለቤት",
      manager: "ሥራ አስኪያጅ",
      waiter: "አስተናጋጅ",
      kitchen: "ወጥ ቤት",
      admin: "አድሚን",
      security: "ጥበቃ"
    },
    nav: {
      dashboard: "ዳሽቦርድ",
      overview: "ጠቅላላ እይታ",
      menuAnalytics: "የምግብ ትንታኔ",
      inventory: "ኢንቬንቶሪ",
      staffPerf: "የሰራተኛ አፈጻጸም",
      tableMap: "የጠረጴዛ ካርታ",
      opsDashboard: "የኦፕሬሽን ዳሽቦርድ",
      staff: "ሰራተኞች",
      orders: "ትእዛዞች",
      myStation: "የእኔ ቦታ",
      kds: "የወጥ ቤት ስክሪን",
      pantry: "ፓንትሪ",
      settings: "ቅንብሮች"
    },
    landing: {
      title: "Sosha OS",
      subtitle: "የሥራ ቦታዎን ይምረጡ",
      poweredBy: "በ withramin.ai የተዘጋጀ",
      roles: {
        owner: { label: "ባለቤት / አድሚን", sub: "የሲስተም ቁጥጥር", tag: "አስተዳደር" },
        manager: { label: "ሥራ አስኪያጅ", sub: "የሥራ ክንውን መሪ", tag: "ቁጥጥር" },
        waiter: { label: "አስተናጋጅ", sub: "የደንበኛ አገልግሎት", tag: "ፊት ለፊት" },
        kitchen: { label: "ወጥ ቤት", sub: "የምግብ ዝግጅት", tag: "ጀርባ" }
      }
    },
    login: {
      title: "ግባ",
      subtitle: "መለያዎን ያስገቡ",
      email: "ኢሜይል",
      password: "የይለፍ ቃል",
      signIn: "ግባ",
      verifying: "በማረጋገጥ ላይ...",
      firstTime: "አዲስ ነዎት? እዚህ ይመዝገቡ",
      backToRoles: "ወደ መጀመሪያ ተመለስ",
      welcomeBack: "እንኳን ደህና መጡ!",
      error: "መግባት አልተቻለም"
    },
    dashboard: {
      title: "የሥራ ክንውን አጠቃላይ እይታ",
      subtitle: "የሬስቶራንቱ ወቅታዊ ሁኔታ",
      kpi: {
        revenue: "የዛሬ ገቢ",
        orders: "የቲኬት ብዛት",
        inventory: "የእቃዎች ሁኔታ",
        staff: "የሰራተኛ ሁኔታ",
        critical: "አሳሳቢ",
        active: "ንቁ"
      },
      kitchenStatus: "የወጥ ቤት ሁኔታ",
      avgPrepTime: "አማካይ የዝግጅት ጊዜ",
      tableService: "የጠረጴዛ አገልግሎት",
      occupied: "የተያዘ",
      lossIndicators: "የኪሳራ ጠቋሚዎች",
      remadeDishes: "ተመልሰው የተሰሩ ምግቦች",
      canceledOrders: "የተሰረዙ ትዕዛዞች",
      estWaste: "ግምታዊ የውድመት ዋጋ"
    }
  },
  om: {
    common: {
      search: "Barbaadi...",
      notifications: "Beeksisa",
      revenue: "Galii",
      needHelp: "Gargaarsa?",
      contactSupport: "Deeggarsa Gaafadhu",
      logout: "Ba'i",
      profile: "Profaayilii",
      today: "Har'a",
      loading: "Fe'aa jira...",
      retry: "Irra deebi'i",
      back: "Duuba",
      verify: "Mirkaneessi",
      cancel: "Haqi",
      confirm: "Mirkaneessi",
      close: "Cufi"
    },
    roles: {
      owner: "Abbaa Qabeenyaa",
      manager: "Hoogganaa",
      waiter: "Keessummeessaa",
      kitchen: "Kushina",
      admin: "Admin",
      security: "Eegduu"
    },
    nav: {
      dashboard: "Daashboordii",
      overview: "Waliigala",
      menuAnalytics: "Qorannoo Menu",
      inventory: "Inveentorii",
      staffPerf: "Ga'umsa Hojjetaa",
      tableMap: "Kaartaa Minjaala",
      opsDashboard: "Daashboordii Hojii",
      staff: "Hojjettoota",
      orders: "Ajaja",
      myStation: "Bakka Koo",
      kds: "Iskirinii Kushina",
      pantry: "Kuusaa",
      settings: "Qindaa'ina"
    },
    landing: {
      title: "Sosha OS",
      subtitle: "Bakka hojii filadhu",
      poweredBy: "withramin.ai dhaan kan qophaa'e",
      roles: {
        owner: { label: "Abbaa / Admin", sub: "To'annoo Sirnaa", tag: "Bulchiinsa" },
        manager: { label: "Hoogganaa", sub: "Hoggansa Hojii", tag: "To'annoo" },
        waiter: { label: "Keessummeessaa", sub: "Tajaajila Minjaalaa", tag: "Fuuldura" },
        kitchen: { label: "Kushina", sub: "Qophii Nyaataa", tag: "Duuba" }
      }
    },
    login: {
      title: "Seeni",
      subtitle: "Odeeffannoo kee galchi",
      email: "Iimeeyilii",
      password: "Jecha Darbii",
      signIn: "Seeni",
      verifying: "Mirkaneessaa jira...",
      firstTime: "Haaraa dhaa? Asitti galmaa'i",
      backToRoles: "Gara filannootti deebi'i",
      welcomeBack: "Baga nagaan dhufte!",
      error: "Seenuun hin danda'amne"
    },
    dashboard: {
      title: "Waliigala Hojii",
      subtitle: "Haala yeroo ammaa",
      kpi: {
        revenue: "Galii Har'aa",
        orders: "Baay'ina Ajaja",
        inventory: "Haala Meeshaalee",
        staff: "Ba'aa Hojii",
        critical: "Yaaddessaa",
        active: "Hojii Irra"
      },
      kitchenStatus: "Haala Kushina",
      avgPrepTime: "Giddu-galeessa Yeroo",
      tableService: "Tajaajila Minjaalaa",
      occupied: "Qabameera",
      lossIndicators: "Agarsiiftuu Kisaaraa",
      remadeDishes: "Nyaata Irra Deebi'ame",
      canceledOrders: "Ajaja Haqame",
      estWaste: "Tilmaama Baasii Qisaasamaa"
    }
  },
  ti: {
    common: {
      search: "ድለ...",
      notifications: "ምልክታታት",
      revenue: "ኣታዊ",
      needHelp: "ሓገዝ ይደልዩ?",
      contactSupport: "ደገፍ ርኸቡ",
      logout: "ውጻእ",
      profile: "ፕሮፋይል",
      today: "ሎሚ",
      loading: "ይጽዕን ኣሎ...",
      retry: "ደጊምካ ፈትን",
      back: "ተመለስ",
      verify: "ኣረጋግጽ",
      cancel: "ሰርዝ",
      confirm: "ኣረጋግጽ",
      close: "ዕጸው"
    },
    roles: {
      owner: "ዋና",
      manager: "መካየዲ ስራሕ",
      waiter: "ኣሰናጋይ",
      kitchen: "ክሽነ",
      admin: "ኣመሓዳሪ",
      security: "ሓለዋ"
    },
    nav: {
      dashboard: "ዳሽቦርድ",
      overview: "ሓፈሻዊ ርእይቶ",
      menuAnalytics: "ትንተና ሜኑ",
      inventory: "ኢንቨንተሪ",
      staffPerf: "ብቕዓት ሰራሕተኛ",
      tableMap: "ካርታ ጠረጴዛ",
      opsDashboard: "ዳሽቦርድ ስራሕ",
      staff: "ሰራሕተኛታት",
      orders: "ትእዛዛት",
      myStation: "ቦታይ",
      kds: "ስክሪን ክሽነ",
      pantry: "መኽዘን",
      settings: "ቅንጅታት"
    },
    landing: {
      title: "Sosha OS",
      subtitle: "ናይ ስራሕ ቦታ ምረጽ",
      poweredBy: "ብ withramin.ai ዝተዳለወ",
      roles: {
        owner: { label: "ዋና / ኣመሓዳሪ", sub: "ቁጽጽር ሲስተም", tag: "ምምሕዳር" },
        manager: { label: "መካየዲ ስራሕ", sub: "መራሒ ስራሕ", tag: "ቁጽጽር" },
        waiter: { label: "ኣሰናጋይ", sub: "ግልጋሎት ጠረጴዛ", tag: "ቅድሚት" },
        kitchen: { label: "ክሽነ", sub: "ምድላው መግቢ", tag: "ድሕሪት" }
      }
    },
    login: {
      title: "እተው",
      subtitle: "መረዳእታኻ ኣእቱ",
      email: "ኢሜይል",
      password: "መንገዲ ቃል",
      signIn: "እተው",
      verifying: "የረጋግጽ ኣሎ...",
      firstTime: "ሓዲሽ ዲኻ? ኣብዚ ተመዝገብ",
      backToRoles: "ናብ መመረጺ ተመለስ",
      welcomeBack: "እንቋዕ ብደሓን መጻእካ!",
      error: "ምእታው ኣይተኻእለን"
    },
    dashboard: {
      title: "ሓፈሻዊ ስራሕ",
      subtitle: "ኩነታት ሬስቶራንት",
      kpi: {
        revenue: "ናይ ሎሚ ኣታዊ",
        orders: "ብዝሒ ትእዛዝ",
        inventory: "ኩነታት ንብረት",
        staff: "ኩነታት ሰራሕተኛ",
        critical: "ተወዲኡ",
        active: "ንጡፍ"
      },
      kitchenStatus: "ኩነታት ክሽነ",
      avgPrepTime: "ማእኸላይ ግዜ ምድላው",
      tableService: "ግልጋሎት ጠረጴዛ",
      occupied: "ተታሒዙ",
      lossIndicators: "ምልክት ክሳራ",
      remadeDishes: "ዳግማይ ዝተሰርሑ",
      canceledOrders: "ዝተሰረዙ ትእዛዛት",
      estWaste: "ግምታዊ ዋጋ ዝባኸነ"
    }
  }
};
