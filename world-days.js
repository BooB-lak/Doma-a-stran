/*
 * Svetovni dnevi, preverjeno 15. 11. 2026.
 * Slovenska Wikipedija (sodelavci, CC BY-SA 4.0), prirejeno in dopolnjeno:
 * https://sl.wikipedia.org/w/index.php?oldid=6774056
 * https://creativecommons.org/licenses/by-sa/4.0/
 * ZN: https://www.un.org/observances/list-days-weeks
 * Datumi z letnimi pravili: GINA, GOLD, IFRC, UIA, UN/UNESCO, IMO, WMBD, WFTO in FAO.
 * Izjeme: Safe.si objavi leto in datum dneva varne rabe interneta.
 */
(() => {
  const fixed = {
    "01-01": ["Svetovni dan miru"],
    "01-04": ["Svetovni dan brajice"],
    "01-19": ["Svetovni dan edinosti Cerkve"],
    "01-27": ["Svetovni dan spomina na žrtve holokavsta"],
    "01-31": ["Svetovni dan boja proti kajenju"],
    "02-02": ["Svetovni dan mokrišč"],
    "02-04": ["Svetovni dan boja proti raku"],
    "02-10": ["Svetovni dan stročnic"],
    "02-11": ["Svetovni dan bolnikov"],
    "02-13": ["Svetovni dan radia"],
    "02-17": ["Svetovni dan odpornosti turizma"],
    "02-20": ["Svetovni dan socialne pravičnosti"],
    "02-21": ["Svetovni dan materinščine"],
    "03-01": ["Svetovni dan civilne zaščite","Svetovni dan morskih trav"],
    "03-03": ["Svetovni dan prosto živečih živalskih in rastlinskih vrst"],
    "03-06": ["Svetovni dan varčevanja z energijo"],
    "03-15": ["Svetovni dan varstva potrošnikov"],
    "03-20": ["Svetovni dan ustnega zdravja","Svetovni dan pripovedništva"],
    "03-21": ["Svetovni dan boja proti rasni diskriminaciji","Svetovni dan Downovega sindroma","Svetovni dan gozdov","Svetovni dan lutkarjev","Svetovni dan poezije","Svetovni dan ledenikov"],
    "03-22": ["Svetovni dan voda"],
    "03-23": ["Svetovni dan meteorologije"],
    "03-24": ["Svetovni dan tuberkuloze"],
    "03-25": ["Svetovni dan mater"],
    "03-27": ["Svetovni dan gledališča"],
    "04-02": ["Svetovni dan etnologije","Svetovni dan mladinske književnosti","Svetovni dan ozaveščanja o avtizmu"],
    "04-04": ["Svetovni dan zapuščenih živali"],
    "04-07": ["Svetovni dan zdravja"],
    "04-08": ["Svetovni dan Romov"],
    "04-11": ["Svetovni dan hišnih ljubljenčkov"],
    "04-12": ["Svetovni dan lionizma"],
    "04-14": ["Svetovni dan Chagasove bolezni"],
    "04-15": ["Svetovni dan mladih prostovoljcev"],
    "04-17": ["Svetovni dan hemofilije"],
    "04-18": ["Svetovni dan radioamaterjev"],
    "04-21": ["Svetovni dan ustvarjalnosti in inovacij"],
    "04-22": ["Svetovni dan Zemlje"],
    "04-23": ["Svetovni dan knjige in avtorskih pravic"],
    "04-25": ["Svetovni dan malarije"],
    "04-26": ["Svetovni dan intelektualne lastnine"],
    "04-28": ["Svetovni dan varnosti in zdravja pri delu"],
    "04-29": ["Svetovni dan plesa"],
    "05-02": ["Svetovni dan tunov"],
    "05-03": ["Svetovni dan svobode tiska"],
    "05-04": ["Svetovni dan gasilcev"],
    "05-05": ["Svetovni dan portugalskega jezika"],
    "05-06": ["Svetovni dan medicinskih sester in babic"],
    "05-08": ["Svetovni dan Rdečega križa"],
    "05-09": ["Svetovni dan Evrope"],
    "05-15": ["Svetovni dan družine","Svetovni dan oporečnikov","Svetovni dan podnebnih sprememb"],
    "05-17": ["Svetovni dan telekomunikacij","Svetovni dan hipertenzije"],
    "05-18": ["Svetovni dan muzejev"],
    "05-19": ["Svetovni dan poštene igre"],
    "05-20": ["Svetovni dan čebel"],
    "05-21": ["Svetovni dan kulturnega razvoja"],
    "05-22": ["Svetovni dan biodiverzitete"],
    "05-25": ["Svetovni dan nogometa"],
    "05-28": ["Svetovni dan sonca"],
    "05-29": ["Svetovni dan pripadnikov mirovnih operacij ZN"],
    "05-31": ["Svetovni dan nekajenja","Svetovni dan športa"],
    "06-01": ["Svetovni dan staršev"],
    "06-03": ["Svetovni dan kolesarjenja"],
    "06-05": ["Svetovni dan varstva okolja"],
    "06-07": ["Svetovni dan varnosti hrane"],
    "06-08": ["Svetovni dan oceanov"],
    "06-12": ["Svetovni dan boja proti otroškemu delu"],
    "06-14": ["Svetovni dan krvodajalstva"],
    "06-15": ["Svetovni dan osveščanja o nasilju nad starejšimi"],
    "06-17": ["Svetovni dan boja proti širjenju puščav in suše"],
    "06-20": ["Svetovni dan beguncev"],
    "06-21": ["Svetovni dan amiotrofične lateralne skleroze","Svetovni dan glasbe","Svetovni dan joge"],
    "06-26": ["Svetovni dan podpore žrtvam mučenja"],
    "07-06": ["Svetovni dan razvoja podeželja"],
    "07-07": ["Svetovni dan svahilskega jezika"],
    "07-11": ["Svetovni dan prebivalstva","Svetovni dan konj"],
    "07-15": ["Svetovni dan veščin mladih"],
    "07-20": ["Svetovni dan šaha"],
    "07-25": ["Svetovni dan preprečevanja utopitev"],
    "07-28": ["Svetovni dan hepatitisa"],
    "07-30": ["Svetovni dan boja proti trgovini z ljudmi"],
    "08-02": ["Svetovni dan dojenja"],
    "08-08": ["Svetovni dan mačk"],
    "08-11": ["Svetovni dan trinidadskega jeklenega bobna"],
    "08-12": ["Svetovni dan mladih"],
    "08-19": ["Svetovni dan humanitarnosti"],
    "08-27": ["Svetovni dan jezer"],
    "09-07": ["Svetovni dan ozaveščanja o Duchennovi mišični distrofiji"],
    "09-08": ["Svetovni dan boja proti nepismenosti"],
    "09-10": ["Svetovni dan preprečevanja samomorov"],
    "09-15": ["Svetovni dan miotonične distrofije"],
    "09-16": ["Svetovni dan ohranjanja ozonske plasti"],
    "09-17": ["Svetovni dan varnosti pacientov"],
    "09-20": ["Svetovni dan čiščenja okolja"],
    "09-21": ["Svetovni dan alzheimerjeve bolezni"],
    "09-22": ["Svetovni dan brez avtomobila"],
    "09-25": ["Svetovni dan farmacevtov"],
    "09-26": ["Svetovni dan jezikov"],
    "09-27": ["Svetovni dan turizma"],
    "09-28": ["Svetovni dan pravice vedeti"],
    "09-29": ["Svetovni dan srca"],
    "09-30": ["Svetovni dan gluhonemih"],
    "10-01": ["Svetovni dan starejših","Svetovni dan vegetarijanstva"],
    "10-02": ["Svetovni dan stomistov"],
    "10-04": ["Svetovni dan varstva živali"],
    "10-05": ["Svetovni dan učiteljev"],
    "10-07": ["Svetovni dan nepopolnosti","Svetovni dan bombaža"],
    "10-09": ["Svetovni dan pošte"],
    "10-10": ["Svetovni dan duševnega zdravja"],
    "10-11": ["Svetovni dan boja proti bolečini"],
    "10-12": ["Svetovni dan revmatskih bolezni"],
    "10-14": ["Svetovni dan standardizacije"],
    "10-15": ["Svetovni dan hoje","Svetovni dan kmetic"],
    "10-16": ["Svetovni dan hrane","Svetovni dan hrbteničnih bolezni in okvar"],
    "10-17": ["Svetovni dan boja proti revščini","Svetovni dan travme"],
    "10-20": ["Svetovni dan osteoporoze"],
    "10-24": ["Svetovni dan OZN","Svetovni dan obveščanja o razvoju"],
    "10-27": ["Svetovni dan delovne terapije","Svetovni dan avdiovizualne dediščine"],
    "10-29": ["Svetovni dan psoriaze","Svetovni dan možganske kapi"],
    "10-31": ["Svetovni dan varčevanja","Svetovni dan mest"],
    "11-05": ["Svetovni dan ozaveščanja o cunamijih"],
    "11-08": ["Svetovni dan urbanizma"],
    "11-10": ["Svetovni dan znanosti za mir in razvoj"],
    "11-11": ["Svetovni dan boja proti odvisnosti","Svetovni dan mladine"],
    "11-14": ["Svetovni dan diabetisa"],
    "11-16": ["Svetovni dan strpnosti"],
    "11-17": ["Svetovni dan izseljencev","Svetovni dan študentov"],
    "11-18": ["Svetovni dan preprečevanja spolnega izkoriščanja, zlorab in nasilja nad otroki ter okrevanja po njih"],
    "11-19": ["Svetovni dan podjetnic","Svetovni dan stranišč"],
    "11-20": ["Svetovni dan otroka"],
    "11-21": ["Svetovni dan pozdrava","Svetovni dan televizije"],
    "11-24": ["Svetovni dan zraščenih dvojčkov"],
    "11-25": ["Svetovni dan boja proti nasilju nad ženskami"],
    "11-26": ["Svetovni dan trajnostnega prometa"],
    "11-30": ["Svetovni dan boja proti smrtni kazni"],
    "12-01": ["Svetovni dan boja proti aidsu"],
    "12-02": ["Svetovni dan boja proti sužnosti"],
    "12-03": ["Svetovni dan invalidov"],
    "12-05": ["Svetovni dan prostovoljcev","Svetovni dan tal"],
    "12-07": ["Svetovni dan civilnega letalstva"],
    "12-10": ["Svetovni dan človekovih pravic"],
    "12-11": ["Svetovni dan gora"],
    "12-15": ["Svetovni dan turške jezikovne družine"],
    "12-17": ["Svetovni dan letalstva"],
    "12-18": ["Svetovni dan migrantov"],
    "12-20": ["Svetovni dan človeške solidarnosti"],
    "12-21": ["Svetovni dan košarke","Svetovni dan meditacije"]
  };

  // Mesec, dan tedna (0 = nedelja), pojavitev (-1 = zadnja), ime.
  const moving = [
    [1,0,3,"Svetovni dan religij"],
    [4,6,-1,"Svetovni dan veterinarjev"],
    [5,2,1,"Svetovni dan astme"],
    [5,6,2,"Svetovni dan ptic selivk"],
    [5,6,2,"Svetovni dan pravične trgovine"],
    [6,6,2,"Svetovni dan velnesa"],
    [7,0,-1,"Svetovni dan barij"],
    [9,3,-1,"Svetovni dan šolskega mleka"],
    [9,4,-1,"Svetovni dan pomorstva"],
    [9,6,2,"Svetovni dan prve pomoči"],
    [9,0,4,"Svetovni dan rek"],
    [10,1,1,"Svetovni dan habitata (bivalnega okolja)"],
    [10,1,1,"Svetovni dan arhitekture"],
    [10,6,2,"Svetovni dan ptic selivk"],
    [11,0,3,"Svetovni dan spomina na žrtve prometnih nesreč"],
    [11,3,3,"Svetovni dan kronične obstruktivne pljučne bolezni"],
    [11,4,3,"Svetovni dan filozofije"],
    [12,0,2,"Svetovni dan zborovskega petja"]
  ];

  const saferInternetDay = { 2026: "02-10", 2027: "02-09" };

  // Sprejme civilni datum, predstavljen v UTC.
  function forDate(date) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const weekday = date.getUTCDay();
    const key = String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
    const observed = [...(fixed[key] || [])];
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (const [m, d, occurrence, title] of moving) {
      if (m === month && d === weekday && (occurrence === -1 ? day + 7 > lastDay : Math.ceil(day / 7) === occurrence)) {
        observed.push(title);
      }
    }
    if (saferInternetDay[year] === key) observed.push("Svetovni dan varne uporabe interneta");
    return observed;
  }

  const longestTitle = [...Object.values(fixed).flat(), ...moving.map(entry => entry[3])]
    .reduce((longest, title) => title.length > longest.length ? title : longest, "");
  const calendar = { forDate, longestTitle };
  if (typeof module === "object" && module.exports) module.exports = calendar;
  else globalThis.worldDays = calendar;
})();
