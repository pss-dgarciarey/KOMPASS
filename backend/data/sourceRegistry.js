const countries = require('i18n-iso-countries');
const enLocale = require('i18n-iso-countries/langs/en.json');

countries.registerLocale(enLocale);

const GOOGLE_NEWS_BASE = 'https://news.google.com/rss/search';

const GLOBAL_RSS_FEEDS = [
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', sourceKind: 'rss' },
  { name: 'BBC Africa', url: 'https://feeds.bbci.co.uk/news/world/africa/rss.xml', sourceKind: 'rss' },
  { name: 'BBC Asia', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml', sourceKind: 'rss' },
  { name: 'BBC Europe', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml', sourceKind: 'rss' },
  { name: 'BBC Middle East', url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml', sourceKind: 'rss' },
  { name: 'Guardian World', url: 'https://www.theguardian.com/world/rss', sourceKind: 'rss' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', sourceKind: 'rss' },
  { name: 'NPR World', url: 'https://feeds.npr.org/1004/rss.xml', sourceKind: 'rss' },
  { name: 'DW World', url: 'https://rss.dw.com/rdf/rss-en-world', sourceKind: 'rss' },
  { name: 'France 24', url: 'https://www.france24.com/en/rss', sourceKind: 'rss' },
  { name: 'UN News', url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml', sourceKind: 'rss' },
  { name: 'ReliefWeb', url: 'https://reliefweb.int/updates?format=rss', sourceKind: 'rss' },
  { name: 'Kyiv Independent', url: 'https://kyivindependent.com/feed/', sourceKind: 'rss' },
  { name: 'Times of Israel', url: 'https://www.timesofisrael.com/feed/', sourceKind: 'rss' },
  { name: 'Middle East Eye', url: 'https://www.middleeasteye.net/rss', sourceKind: 'rss' }
];

const GLOBAL_SHIPPING_FEEDS = [
  {
    key: 'shipping:gcaptain',
    name: 'gCaptain shipping watch',
    url: googleNewsSearchUrl('site:gcaptain.com (shipping OR tanker OR lng OR port OR refinery OR vessel) when:7d'),
    outletLabel: 'gCaptain',
    sourceKind: 'shipping-lane',
    scope: 'shipping-lane',
    priority: 1
  },
  {
    key: 'shipping:splash247',
    name: 'Splash247 shipping watch',
    url: googleNewsSearchUrl('site:splash247.com (shipping OR tanker OR lng OR port OR vessel) when:7d'),
    outletLabel: 'Splash247',
    sourceKind: 'shipping-lane',
    scope: 'shipping-lane',
    priority: 1
  },
  {
    key: 'shipping:porttechnology',
    name: 'Port Technology watch',
    url: googleNewsSearchUrl('site:porttechnology.org (port OR congestion OR shipping OR container OR terminal) when:7d'),
    outletLabel: 'Port Technology',
    sourceKind: 'shipping-lane',
    scope: 'shipping-lane',
    priority: 2
  },
  {
    key: 'shipping:safety4sea',
    name: 'Safety4Sea watch',
    url: googleNewsSearchUrl('site:safety4sea.com (shipping OR tanker OR lng OR port OR maritime) when:7d'),
    outletLabel: 'Safety4Sea',
    sourceKind: 'shipping-lane',
    scope: 'shipping-lane',
    priority: 2
  },
  {
    key: 'shipping:offshoreenergy',
    name: 'Offshore Energy watch',
    url: googleNewsSearchUrl('site:offshore-energy.biz (lng OR shipping OR tanker OR port OR gas) when:7d'),
    outletLabel: 'Offshore Energy',
    sourceKind: 'shipping-lane',
    scope: 'shipping-lane',
    priority: 2
  },
  {
    key: 'shipping:seatrade',
    name: 'Seatrade Maritime watch',
    url: googleNewsSearchUrl('site:seatrade-maritime.com (shipping OR tanker OR port OR lng OR vessel) when:7d'),
    outletLabel: 'Seatrade Maritime',
    sourceKind: 'shipping-lane',
    scope: 'shipping-lane',
    priority: 3
  },
  {
    key: 'shipping:hormuz',
    name: 'Hormuz tanker pulse',
    url: googleNewsSearchUrl('("Strait of Hormuz" OR Hormuz) (tanker OR lng OR shipping OR crude OR vessel) when:7d'),
    outletLabel: 'Hormuz pulse',
    countryIso3: 'IRN',
    sourceKind: 'shipping-lane',
    scope: 'shipping-lane',
    priority: 1
  },
  {
    key: 'shipping:redsea',
    name: 'Red Sea shipping pulse',
    url: googleNewsSearchUrl('("Red Sea" OR "Bab el-Mandeb") (shipping OR tanker OR vessel OR lng OR container ship) when:7d'),
    outletLabel: 'Red Sea pulse',
    countryIso3: 'YEM',
    sourceKind: 'shipping-lane',
    scope: 'shipping-lane',
    priority: 1
  },
  {
    key: 'shipping:blacksea',
    name: 'Black Sea shipping pulse',
    url: googleNewsSearchUrl('("Black Sea" OR Odesa OR Odessa) (shipping OR port OR grain corridor OR tanker OR vessel) when:7d'),
    outletLabel: 'Black Sea pulse',
    countryIso3: 'UKR',
    sourceKind: 'shipping-lane',
    scope: 'shipping-lane',
    priority: 1
  },
  {
    key: 'shipping:panama',
    name: 'Panama Canal pulse',
    url: googleNewsSearchUrl('("Panama Canal") (shipping OR congestion OR drought OR vessel queue) when:7d'),
    outletLabel: 'Panama Canal pulse',
    countryIso3: 'PAN',
    sourceKind: 'shipping-lane',
    scope: 'shipping-lane',
    priority: 2
  }
];

const HOTSPOT_COUNTRIES = [
  'USA', 'GBR', 'DEU', 'FRA', 'ESP', 'ITA', 'POL', 'UKR', 'RUS', 'ISR',
  'IRN', 'IND', 'CHN', 'JPN', 'BRA', 'MEX', 'CAN', 'AUS', 'ZAF', 'TUR',
  'SAU', 'ARE', 'EGY', 'NGA', 'KEN', 'ARG', 'SDN', 'YEM', 'MMR', 'COD',
  'LBN', 'IRQ', 'SYR', 'PSE'
];

const COUNTRY_OUTLET_DOMAINS = {
  USA: [
    ['The New York Times', 'nytimes.com'],
    ['Washington Post', 'washingtonpost.com'],
    ['NPR', 'npr.org'],
    ['Politico', 'politico.com'],
    ['CBS News', 'cbsnews.com']
  ],
  GBR: [
    ['BBC', 'bbc.com'],
    ['The Guardian', 'theguardian.com'],
    ['Sky News', 'news.sky.com'],
    ['Reuters UK', 'reuters.com'],
    ['Financial Times', 'ft.com']
  ],
  DEU: [
    ['Der Spiegel', 'spiegel.de'],
    ['Tagesschau', 'tagesschau.de'],
    ['Die Welt', 'welt.de'],
    ['FAZ', 'faz.net'],
    ['DW', 'dw.com']
  ],
  FRA: [
    ['Le Monde', 'lemonde.fr'],
    ['France 24', 'france24.com'],
    ['Le Figaro', 'lefigaro.fr'],
    ['Liberation', 'liberation.fr'],
    ['RFI', 'rfi.fr']
  ],
  ESP: [
    ['El Pais', 'elpais.com'],
    ['El Mundo', 'elmundo.es'],
    ['ABC', 'abc.es'],
    ['La Vanguardia', 'lavanguardia.com'],
    ['RTVE', 'rtve.es']
  ],
  ITA: [
    ['La Repubblica', 'repubblica.it'],
    ['Corriere della Sera', 'corriere.it'],
    ['ANSA', 'ansa.it'],
    ['Il Sole 24 Ore', 'ilsole24ore.com'],
    ['RAI News', 'rainews.it']
  ],
  POL: [
    ['TVP World', 'tvpworld.com'],
    ['Notes from Poland', 'notesfrompoland.com'],
    ['Onet', 'onet.pl'],
    ['Gazeta Wyborcza', 'wyborcza.pl'],
    ['Polskie Radio', 'polskieradio.pl']
  ],
  UKR: [
    ['Kyiv Independent', 'kyivindependent.com'],
    ['Ukrainska Pravda', 'pravda.com.ua'],
    ['Euromaidan Press', 'euromaidanpress.com'],
    ['Interfax Ukraine', 'interfax.com.ua'],
    ['Suspilne', 'suspilne.media']
  ],
  RUS: [
    ['TASS', 'tass.com'],
    ['The Moscow Times', 'themoscowtimes.com'],
    ['Meduza', 'meduza.io'],
    ['Interfax', 'interfax.com'],
    ['RT', 'rt.com']
  ],
  ISR: [
    ['Times of Israel', 'timesofisrael.com'],
    ['Jerusalem Post', 'jpost.com'],
    ['Ynet News', 'ynetnews.com'],
    ['Haaretz', 'haaretz.com'],
    ['i24NEWS', 'i24news.tv']
  ],
  IRN: [
    ['Tehran Times', 'tehrantimes.com'],
    ['IRNA', 'irna.ir'],
    ['Tasnim', 'tasnimnews.com'],
    ['Mehr News', 'mehrnews.com'],
    ['Press TV', 'presstv.ir']
  ],
  IND: [
    ['The Hindu', 'thehindu.com'],
    ['Hindustan Times', 'hindustantimes.com'],
    ['NDTV', 'ndtv.com'],
    ['Indian Express', 'indianexpress.com'],
    ['Times of India', 'timesofindia.indiatimes.com']
  ],
  CHN: [
    ['Global Times', 'globaltimes.cn'],
    ['South China Morning Post', 'scmp.com'],
    ['China Daily', 'chinadaily.com.cn'],
    ['Xinhua', 'xinhua.net'],
    ['Caixin', 'caixinglobal.com']
  ],
  JPN: [
    ['Japan Times', 'japantimes.co.jp'],
    ['Nikkei', 'nikkei.com'],
    ['Asahi', 'asahi.com'],
    ['Mainichi', 'mainichi.jp'],
    ['NHK', 'nhk.or.jp']
  ],
  BRA: [
    ['O Globo', 'globo.com'],
    ['Folha', 'folha.uol.com.br'],
    ['Estadao', 'estadao.com.br'],
    ['Poder360', 'poder360.com.br'],
    ['CNN Brasil', 'cnnbrasil.com.br']
  ],
  MEX: [
    ['El Universal', 'eluniversal.com.mx'],
    ['Milenio', 'milenio.com'],
    ['La Jornada', 'jornada.com.mx'],
    ['Animal Politico', 'animalpolitico.com'],
    ['Aristegui Noticias', 'aristeguinoticias.com']
  ],
  CAN: [
    ['CBC', 'cbc.ca'],
    ['Globe and Mail', 'theglobeandmail.com'],
    ['National Post', 'nationalpost.com'],
    ['CTV News', 'ctvnews.ca'],
    ['Global News', 'globalnews.ca']
  ],
  AUS: [
    ['ABC Australia', 'abc.net.au'],
    ['Sydney Morning Herald', 'smh.com.au'],
    ['The Age', 'theage.com.au'],
    ['AFR', 'afr.com'],
    ['News.com.au', 'news.com.au']
  ],
  ZAF: [
    ['News24', 'news24.com'],
    ['Daily Maverick', 'dailymaverick.co.za'],
    ['Mail & Guardian', 'mg.co.za'],
    ['TimesLIVE', 'timeslive.co.za'],
    ['eNCA', 'enca.com']
  ],
  TUR: [
    ['Hurriyet Daily News', 'hurriyetdailynews.com'],
    ['Daily Sabah', 'dailysabah.com'],
    ['Anadolu Agency', 'aa.com.tr'],
    ['TRT World', 'trtworld.com'],
    ['Sozcu', 'sozcu.com.tr']
  ],
  SAU: [
    ['Arab News', 'arabnews.com'],
    ['Saudi Gazette', 'saudigazette.com.sa'],
    ['Al Arabiya', 'alarabiya.net'],
    ['Asharq Al-Awsat', 'aawsat.com'],
    ['SPA', 'spa.gov.sa']
  ],
  ARE: [
    ['The National', 'thenationalnews.com'],
    ['Gulf News', 'gulfnews.com'],
    ['Khaleej Times', 'khaleejtimes.com'],
    ['WAM', 'wam.ae'],
    ['Arabian Business', 'arabianbusiness.com']
  ],
  EGY: [
    ['Ahram Online', 'english.ahram.org.eg'],
    ['Egypt Independent', 'egyptindependent.com'],
    ['Daily News Egypt', 'dailynewsegypt.com'],
    ['Mada Masr', 'madamasr.com'],
    ['State Information Service', 'sis.gov.eg']
  ],
  NGA: [
    ['Punch', 'punchng.com'],
    ['Premium Times', 'premiumtimesng.com'],
    ['Guardian Nigeria', 'guardian.ng'],
    ['Channels TV', 'channelstv.com'],
    ['BusinessDay', 'businessday.ng']
  ],
  KEN: [
    ['Nation', 'nation.africa'],
    ['The Star', 'the-star.co.ke'],
    ['The Standard', 'standardmedia.co.ke'],
    ['Citizen Digital', 'citizen.digital'],
    ['Capital FM', 'capitalfm.co.ke']
  ],
  ARG: [
    ['Clarin', 'clarin.com'],
    ['La Nacion', 'lanacion.com.ar'],
    ['Pagina12', 'pagina12.com.ar'],
    ['Buenos Aires Herald', 'buenosairesherald.com'],
    ['Infobae', 'infobae.com']
  ],
  SDN: [
    ['Sudan Tribune', 'sudantribune.com'],
    ['Dabanga', 'dabangasudan.org'],
    ['Radio Tamazuj', 'radiotamazuj.org'],
    ['Asharq Al-Awsat', 'aawsat.com'],
    ['AllAfrica Sudan', 'allafrica.com']
  ],
  YEM: [
    ['Yemen Online', 'yemenonline.info'],
    ['Saba Net', 'saba.ye'],
    ['Al Masirah', 'almasirah.net.ye'],
    ['Middle East Eye', 'middleeasteye.net'],
    ['Al Jazeera', 'aljazeera.com']
  ],
  MMR: [
    ['Myanmar Now', 'myanmar-now.org'],
    ['Irrawaddy', 'irrawaddy.com'],
    ['Mizzima', 'mizzima.com'],
    ['DVB', 'english.dvb.no'],
    ['Frontier Myanmar', 'frontiermyanmar.net']
  ],
  COD: [
    ['Actualite', 'actualite.cd'],
    ['Radio Okapi', 'radiookapi.net'],
    ['AllAfrica DRC', 'allafrica.com'],
    ['Congo Forum', 'congoforum.be'],
    ['VOA DRC', 'voaafrique.com']
  ],
  LBN: [
    ['LOrient Today', 'lorienttoday.com'],
    ['The Daily Star', 'dailystar.com.lb'],
    ['Naharnet', 'naharnet.com'],
    ['MTV Lebanon', 'mtv.com.lb'],
    ['An Nahar', 'annahar.com']
  ],
  IRQ: [
    ['Shafaq', 'shafaq.com'],
    ['Rudaw', 'rudaw.net'],
    ['Iraqi News', 'iraqinews.com'],
    ['The New Arab', 'newarab.com'],
    ['Al Sumaria', 'alsumaria.tv']
  ],
  SYR: [
    ['Enab Baladi', 'english.enabbaladi.net'],
    ['Syria Direct', 'syriadirect.org'],
    ['North Press', 'npasyria.com'],
    ['SANA', 'sana.sy'],
    ['SOHR', 'syriahr.com']
  ],
  PSE: [
    ['WAFA', 'wafa.ps'],
    ['Maan News', 'maannews.net'],
    ['Al Quds', 'alquds.com'],
    ['Middle East Eye', 'middleeasteye.net'],
    ['Al Jazeera', 'aljazeera.com']
  ],
  NLD: [
    ['NOS', 'nos.nl'],
    ['NL Times', 'nltimes.nl'],
    ['DutchNews', 'dutchnews.nl'],
    ['De Volkskrant', 'volkskrant.nl'],
    ['NRC', 'nrc.nl']
  ],
  BEL: [
    ['VRT NWS', 'vrt.be'],
    ['Brussels Times', 'brusselstimes.com'],
    ['Le Soir', 'lesoir.be'],
    ['La Libre', 'lalibre.be'],
    ['RTBF', 'rtbf.be']
  ],
  CHE: [
    ['Swissinfo', 'swissinfo.ch'],
    ['Le Temps', 'letemps.ch'],
    ['NZZ', 'nzz.ch'],
    ['Tages-Anzeiger', 'tagesanzeiger.ch'],
    ['RTS', 'rts.ch']
  ],
  PRT: [
    ['Publico', 'publico.pt'],
    ['Expresso', 'expresso.pt'],
    ['Observador', 'observador.pt'],
    ['RTP', 'rtp.pt'],
    ['Jornal de Noticias', 'jn.pt']
  ],
  SWE: [
    ['SVT', 'svt.se'],
    ['Dagens Nyheter', 'dn.se'],
    ['The Local Sweden', 'thelocal.se'],
    ['Svenska Dagbladet', 'svd.se'],
    ['Aftonbladet', 'aftonbladet.se']
  ],
  NOR: [
    ['NRK', 'nrk.no'],
    ['Aftenposten', 'aftenposten.no'],
    ['The Local Norway', 'thelocal.no'],
    ['VG', 'vg.no'],
    ['E24', 'e24.no']
  ],
  FIN: [
    ['Yle', 'yle.fi'],
    ['Helsingin Sanomat', 'hs.fi'],
    ['Iltalehti', 'iltalehti.fi'],
    ['Kauppalehti', 'kauppalehti.fi'],
    ['MTV Uutiset', 'mtvuutiset.fi']
  ],
  DNK: [
    ['DR', 'dr.dk'],
    ['The Local Denmark', 'thelocal.dk'],
    ['Politiken', 'politiken.dk'],
    ['Berlingske', 'berlingske.dk'],
    ['Jyllands-Posten', 'jyllands-posten.dk']
  ],
  IRL: [
    ['RTE', 'rte.ie'],
    ['Irish Times', 'irishtimes.com'],
    ['Independent.ie', 'independent.ie'],
    ['TheJournal', 'thejournal.ie'],
    ['Irish Examiner', 'irishexaminer.com']
  ],
  AUT: [
    ['ORF', 'orf.at'],
    ['Der Standard', 'derstandard.at'],
    ['Kleine Zeitung', 'kleinezeitung.at'],
    ['Kurier', 'kurier.at'],
    ['Die Presse', 'diepresse.com']
  ],
  CZE: [
    ['CT24', 'ct24.ceskatelevize.cz'],
    ['Prague Morning', 'praguemorning.cz'],
    ['iDNES', 'idnes.cz'],
    ['Seznam Zpravy', 'seznamzpravy.cz'],
    ['Czech Radio', 'irozhlas.cz']
  ],
  HUN: [
    ['Telex', 'telex.hu'],
    ['Portfolio', 'portfolio.hu'],
    ['Budapest Business Journal', 'bbj.hu'],
    ['Hungary Today', 'hungarytoday.hu'],
    ['Index', 'index.hu']
  ],
  ROU: [
    ['Digi24', 'digi24.ro'],
    ['Romania Insider', 'romania-insider.com'],
    ['Adevarul', 'adevarul.ro'],
    ['HotNews', 'hotnews.ro'],
    ['Europa Libera Romania', 'romania.europalibera.org']
  ],
  GRC: [
    ['Kathimerini', 'ekathimerini.com'],
    ['To Vima', 'tovima.com'],
    ['Keep Talking Greece', 'keeptalkinggreece.com'],
    ['Proto Thema', 'protothema.gr'],
    ['ERT', 'ertnews.gr']
  ],
  SRB: [
    ['N1 Serbia', 'n1info.rs'],
    ['Blic', 'blic.rs'],
    ['Politika', 'politika.rs'],
    ['Danas', 'danas.rs'],
    ['RTS', 'rts.rs']
  ],
  BGR: [
    ['BTA', 'bta.bg'],
    ['Novinite', 'novinite.com'],
    ['Dnevnik', 'dnevnik.bg'],
    ['24 Chasa', '24chasa.bg'],
    ['BNR', 'bnr.bg']
  ],
  CHL: [
    ['La Tercera', 'latercera.com'],
    ['El Mercurio', 'emol.com'],
    ['BioBioChile', 'biobiochile.cl'],
    ['Cooperativa', 'cooperativa.cl'],
    ['Diario Financiero', 'df.cl']
  ],
  COL: [
    ['El Tiempo', 'eltiempo.com'],
    ['Semana', 'semana.com'],
    ['El Espectador', 'elespectador.com'],
    ['La Silla Vacia', 'lasillavacia.com'],
    ['Blu Radio', 'bluradio.com']
  ],
  PER: [
    ['El Comercio', 'elcomercio.pe'],
    ['La Republica', 'larepublica.pe'],
    ['Gestion', 'gestion.pe'],
    ['Peru21', 'peru21.pe'],
    ['RPP', 'rpp.pe']
  ],
  VEN: [
    ['El Nacional', 'elnacional.com'],
    ['Tal Cual', 'talcualdigital.com'],
    ['Efecto Cocuyo', 'efectococuyo.com'],
    ['El Pitazo', 'elpitazo.net'],
    ['Banca y Negocios', 'bancaynegocios.com']
  ],
  ECU: [
    ['El Universo', 'eluniverso.com'],
    ['Primicias', 'primicias.ec'],
    ['El Comercio Ecuador', 'elcomercio.com'],
    ['GK', 'gk.city'],
    ['Teleamazonas', 'teleamazonas.com']
  ],
  URY: [
    ['El Pais Uruguay', 'elpais.com.uy'],
    ['Montevideo Portal', 'montevideo.com.uy'],
    ['Subrayado', 'subrayado.com.uy'],
    ['La Diaria', 'ladiaria.com.uy'],
    ['Busqueda', 'busqueda.com.uy']
  ],
  MAR: [
    ['Hespress', 'hespress.com'],
    ['Le360', 'le360.ma'],
    ['Morocco World News', 'moroccoworldnews.com'],
    ['Medias24', 'medias24.com'],
    ['TelQuel', 'telquel.ma']
  ],
  DZA: [
    ['APS', 'aps.dz'],
    ['El Watan', 'elwatan.com'],
    ['TSA Algerie', 'tsa-algerie.com'],
    ['Algerie Eco', 'algerie-eco.com'],
    ['Ennahar', 'ennaharonline.com']
  ],
  TUN: [
    ['Mosaique FM', 'mosaiquefm.net'],
    ['La Presse', 'lapresse.tn'],
    ['Business News', 'businessnews.com.tn'],
    ['Tunisie Numerique', 'tunisienumerique.com'],
    ['TAP', 'tap.info.tn']
  ],
  ETH: [
    ['Addis Standard', 'addisstandard.com'],
    ['Fana', 'fanabc.com'],
    ['Ethiopian Reporter', 'thereporterethiopia.com'],
    ['ENA', 'ena.et'],
    ['Capital Ethiopia', 'capitalethiopia.com']
  ],
  UGA: [
    ['Daily Monitor', 'monitor.co.ug'],
    ['New Vision', 'newvision.co.ug'],
    ['The Independent Uganda', 'independent.co.ug'],
    ['Nile Post', 'nilepost.co.ug'],
    ['ChimpReports', 'chimpreports.com']
  ],
  TZA: [
    ['The Citizen', 'thecitizen.co.tz'],
    ['The EastAfrican', 'theeastafrican.co.ke'],
    ['Daily News Tanzania', 'dailynews.co.tz'],
    ['Mwananchi', 'mwananchi.co.tz'],
    ['IPP Media', 'ippmedia.com']
  ],
  GHA: [
    ['Graphic Online', 'graphic.com.gh'],
    ['Citi Newsroom', 'citinewsroom.com'],
    ['Joy Online', 'myjoyonline.com'],
    ['GhanaWeb', 'ghanaweb.com'],
    ['The Chronicle', 'thechronicle.com.gh']
  ],
  CIV: [
    ['Abidjan.net', 'abidjan.net'],
    ['Fraternite Matin', 'fratmat.info'],
    ['Connection Ivoirienne', 'connectionivoirienne.net'],
    ['APA News', 'apanews.net'],
    ['RTI Info', 'rti.info']
  ],
  SEN: [
    ['Seneweb', 'seneweb.com'],
    ['Le Soleil', 'lesoleil.sn'],
    ['DakarActu', 'dakaractu.com'],
    ['APS Senegal', 'aps.sn'],
    ['Sud Quotidien', 'sudonline.sn']
  ],
  KAZ: [
    ['Astana Times', 'astanatimes.com'],
    ['Kazinform', 'inform.kz'],
    ['Tengrinews', 'tengrinews.kz'],
    ['The Times of Central Asia', 'timesca.com'],
    ['Kursiv', 'kursiv.media']
  ],
  UZB: [
    ['Gazeta.uz', 'gazeta.uz'],
    ['Kun.uz', 'kun.uz'],
    ['UzDaily', 'uzdaily.uz'],
    ['Daryo', 'daryo.uz'],
    ['Podrobno', 'podrobno.uz']
  ],
  PAK: [
    ['Dawn', 'dawn.com'],
    ['The News', 'thenews.com.pk'],
    ['Geo News', 'geo.tv'],
    ['Express Tribune', 'tribune.com.pk'],
    ['Business Recorder', 'brecorder.com']
  ],
  BGD: [
    ['The Daily Star', 'thedailystar.net'],
    ['Dhaka Tribune', 'dhakatribune.com'],
    ['Prothom Alo', 'prothomalo.com'],
    ['bdnews24', 'bdnews24.com'],
    ['New Age', 'newagebd.net']
  ],
  LKA: [
    ['Daily Mirror', 'dailymirror.lk'],
    ['EconomyNext', 'economynext.com'],
    ['Ada Derana', 'adaderana.lk'],
    ['Sunday Times Sri Lanka', 'sundaytimes.lk'],
    ['Newswire Lanka', 'newswire.lk']
  ],
  NPL: [
    ['Kathmandu Post', 'kathmandupost.com'],
    ['The Himalayan Times', 'thehimalayantimes.com'],
    ['Onlinekhabar', 'english.onlinekhabar.com'],
    ['My Republica', 'myrepublica.nagariknetwork.com'],
    ['Setopati', 'setopati.com']
  ],
  THA: [
    ['Bangkok Post', 'bangkokpost.com'],
    ['The Nation Thailand', 'nationthailand.com'],
    ['Thai PBS', 'thaipbsworld.com'],
    ['Khaosod English', 'khaosodenglish.com'],
    ['Prachatai', 'prachatai.com']
  ],
  VNM: [
    ['VnExpress', 'vnexpress.net'],
    ['Vietnam News', 'vietnamnews.vn'],
    ['Tuoi Tre News', 'tuoitrenews.vn'],
    ['Nhan Dan', 'nhandan.vn'],
    ['Vietnam Plus', 'vietnamplus.vn']
  ],
  IDN: [
    ['Jakarta Post', 'thejakartapost.com'],
    ['Tempo', 'tempo.co'],
    ['Kompas', 'kompas.com'],
    ['Jakarta Globe', 'jakartaglobe.id'],
    ['CNBC Indonesia', 'cnbcindonesia.com']
  ],
  PHL: [
    ['Inquirer', 'inquirer.net'],
    ['Rappler', 'rappler.com'],
    ['Philippine Star', 'philstar.com'],
    ['ABS-CBN News', 'news.abs-cbn.com'],
    ['Manila Bulletin', 'mb.com.ph']
  ],
  MYS: [
    ['The Star', 'thestar.com.my'],
    ['Malay Mail', 'malaymail.com'],
    ['Free Malaysia Today', 'fmt.com.my'],
    ['Bernama', 'bernama.com'],
    ['New Straits Times', 'nst.com.my']
  ],
  NZL: [
    ['RNZ', 'rnz.co.nz'],
    ['NZ Herald', 'nzherald.co.nz'],
    ['Stuff', 'stuff.co.nz'],
    ['Newsroom', 'newsroom.co.nz'],
    ['1News', '1news.co.nz']
  ],
  KOR: [
    ['Korea Herald', 'koreaherald.com'],
    ['Yonhap', 'yonhapnews.co.kr'],
    ['Korea JoongAng Daily', 'koreajoongangdaily.joins.com'],
    ['Chosun Ilbo', 'chosun.com'],
    ['Hankyoreh', 'hani.co.kr']
  ]
};

const BLUESKY_SOURCE_REGISTRY = [
  {
    key: 'reuters-bsky',
    label: 'Reuters',
    handle: 'reuters.com',
    url: 'https://bsky.app/profile/reuters.com',
    sourceKind: 'social-bluesky'
  },
  {
    key: 'ap-bsky',
    label: 'Associated Press',
    handle: 'apnews.com',
    url: 'https://bsky.app/profile/apnews.com',
    sourceKind: 'social-bluesky'
  },
  {
    key: 'bno-bsky',
    label: 'BNO News',
    handle: 'bnonews.com',
    url: 'https://bsky.app/profile/bnonews.com',
    sourceKind: 'social-bluesky'
  },
  {
    key: 'kyivindependent-bsky',
    label: 'Kyiv Independent',
    handle: 'kyivindependent.com',
    url: 'https://bsky.app/profile/kyivindependent.com',
    sourceKind: 'social-bluesky',
    countryIso3Hints: ['UKR']
  }
];

const CONFLICT_OUTLET_REGISTRY = [
  {
    conflictKey: 'myanmar',
    theaterLabel: 'Myanmar',
    countryIso3: 'MMR',
    outletLabel: 'Myanmar Now',
    domain: 'myanmar-now.org',
    priority: 1,
    query: 'site:myanmar-now.org ("Myanmar" OR Burma OR junta OR resistance OR airstrike OR "Arakan Army" OR Rakhine OR Sagaing OR Karenni) when:7d'
  },
  {
    conflictKey: 'myanmar',
    theaterLabel: 'Myanmar',
    countryIso3: 'MMR',
    outletLabel: 'Frontier Myanmar',
    domain: 'frontiermyanmar.net',
    priority: 1,
    query: 'site:frontiermyanmar.net ("Myanmar" OR Burma OR junta OR resistance OR airstrike OR Rakhine OR Shan OR Sagaing) when:7d'
  },
  {
    conflictKey: 'myanmar',
    theaterLabel: 'Myanmar',
    countryIso3: 'MMR',
    outletLabel: 'Irrawaddy',
    domain: 'irrawaddy.com',
    priority: 2,
    query: 'site:irrawaddy.com ("Myanmar" OR Burma OR junta OR resistance OR airstrike OR Rakhine OR Karenni OR Shan) when:7d'
  },
  {
    conflictKey: 'myanmar',
    theaterLabel: 'Myanmar',
    countryIso3: 'MMR',
    outletLabel: 'Mizzima',
    domain: 'mizzima.com',
    priority: 2,
    query: 'site:mizzima.com ("Myanmar" OR Burma OR junta OR resistance OR airstrike OR Sagaing OR Mandalay) when:7d'
  },
  {
    conflictKey: 'myanmar',
    theaterLabel: 'Myanmar',
    countryIso3: 'MMR',
    outletLabel: 'DVB',
    domain: 'english.dvb.no',
    priority: 3,
    query: 'site:english.dvb.no ("Myanmar" OR Burma OR junta OR resistance OR airstrike OR Shan OR Kachin) when:7d'
  },
  {
    conflictKey: 'sudan',
    theaterLabel: 'Sudan',
    countryIso3: 'SDN',
    outletLabel: 'Sudan Tribune',
    domain: 'sudantribune.com',
    priority: 1,
    query: 'site:sudantribune.com (Sudan OR RSF OR SAF OR Darfur OR Khartoum OR "El Fasher" OR Kordofan OR Omdurman) when:7d'
  },
  {
    conflictKey: 'sudan',
    theaterLabel: 'Sudan',
    countryIso3: 'SDN',
    outletLabel: 'Dabanga',
    domain: 'dabangasudan.org',
    priority: 1,
    query: 'site:dabangasudan.org (Sudan OR Darfur OR RSF OR SAF OR "El Fasher" OR Nyala OR Kordofan) when:7d'
  },
  {
    conflictKey: 'sudan',
    theaterLabel: 'Sudan',
    countryIso3: 'SDN',
    outletLabel: 'Radio Tamazuj',
    domain: 'radiotamazuj.org',
    priority: 2,
    query: 'site:radiotamazuj.org (Sudan OR RSF OR SAF OR Darfur OR Khartoum OR "South Kordofan") when:7d'
  },
  {
    conflictKey: 'sudan',
    theaterLabel: 'Sudan',
    countryIso3: 'SDN',
    outletLabel: 'AllAfrica Sudan',
    domain: 'allafrica.com',
    priority: 3,
    query: 'site:allafrica.com (Sudan OR RSF OR SAF OR Darfur OR Khartoum OR "El Fasher") when:7d'
  },
  {
    conflictKey: 'drc',
    theaterLabel: 'DRC',
    countryIso3: 'COD',
    outletLabel: 'Actualite',
    domain: 'actualite.cd',
    priority: 1,
    query: 'site:actualite.cd ("DR Congo" OR Congo OR M23 OR Goma OR Bukavu OR "North Kivu" OR Ituri OR Beni) when:7d'
  },
  {
    conflictKey: 'drc',
    theaterLabel: 'DRC',
    countryIso3: 'COD',
    outletLabel: 'Radio Okapi',
    domain: 'radiookapi.net',
    priority: 1,
    query: 'site:radiookapi.net ("DR Congo" OR Congo OR M23 OR Goma OR Bukavu OR "North Kivu" OR Ituri) when:7d'
  },
  {
    conflictKey: 'drc',
    theaterLabel: 'DRC',
    countryIso3: 'COD',
    outletLabel: 'VOA Afrique DRC',
    domain: 'voaafrique.com',
    priority: 2,
    query: 'site:voaafrique.com ("DR Congo" OR Congo OR M23 OR Goma OR Bukavu OR Rwanda OR "North Kivu") when:7d'
  },
  {
    conflictKey: 'drc',
    theaterLabel: 'DRC',
    countryIso3: 'COD',
    outletLabel: 'AllAfrica DRC',
    domain: 'allafrica.com',
    priority: 3,
    query: 'site:allafrica.com ("DR Congo" OR Congo OR M23 OR Goma OR Bukavu OR "North Kivu") when:7d'
  },
  {
    conflictKey: 'yemen-red-sea',
    theaterLabel: 'Yemen / Red Sea',
    countryIso3: 'YEM',
    outletLabel: 'Yemen Online',
    domain: 'yemenonline.info',
    priority: 1,
    query: 'site:yemenonline.info (Yemen OR Houthi OR Houthis OR Sanaa OR Hodeidah OR Marib OR Aden OR "Red Sea") when:7d'
  },
  {
    conflictKey: 'yemen-red-sea',
    theaterLabel: 'Yemen / Red Sea',
    countryIso3: 'YEM',
    outletLabel: 'Middle East Eye',
    domain: 'middleeasteye.net',
    priority: 1,
    query: 'site:middleeasteye.net (Yemen OR Houthi OR Houthis OR "Red Sea" OR Hodeidah OR Sanaa OR Marib) when:7d'
  },
  {
    conflictKey: 'yemen-red-sea',
    theaterLabel: 'Yemen / Red Sea',
    countryIso3: 'YEM',
    outletLabel: 'Al Jazeera',
    domain: 'aljazeera.com',
    priority: 2,
    query: 'site:aljazeera.com (Yemen OR Houthi OR Houthis OR "Red Sea" OR Hodeidah OR Sanaa OR Marib) when:7d'
  },
  {
    conflictKey: 'yemen-red-sea',
    theaterLabel: 'Yemen / Red Sea',
    countryIso3: 'YEM',
    outletLabel: 'Saba Net',
    domain: 'saba.ye',
    priority: 3,
    query: 'site:saba.ye (Yemen OR Houthi OR Houthis OR Sanaa OR Hodeidah OR Marib) when:7d'
  },
  {
    conflictKey: 'sahel',
    theaterLabel: 'Sahel',
    countryIso3: 'MLI',
    outletLabel: 'RFI Afrique',
    domain: 'rfi.fr',
    priority: 1,
    query: 'site:rfi.fr (Sahel OR Mali OR "Burkina Faso" OR Niger OR JNIM OR ISGS OR Gao OR Menaka OR Tillaberi) when:7d'
  },
  {
    conflictKey: 'sahel',
    theaterLabel: 'Sahel',
    countryIso3: 'MLI',
    outletLabel: 'France 24',
    domain: 'france24.com',
    priority: 1,
    query: 'site:france24.com (Sahel OR Mali OR "Burkina Faso" OR Niger OR JNIM OR ISGS OR Gao OR Tillaberi) when:7d'
  },
  {
    conflictKey: 'sahel',
    theaterLabel: 'Sahel',
    countryIso3: 'MLI',
    outletLabel: 'VOA Afrique',
    domain: 'voaafrique.com',
    priority: 2,
    query: 'site:voaafrique.com (Sahel OR Mali OR "Burkina Faso" OR Niger OR JNIM OR ISGS OR Gao OR Tillaberi) when:7d'
  },
  {
    conflictKey: 'sahel',
    theaterLabel: 'Sahel',
    countryIso3: 'MLI',
    outletLabel: 'AllAfrica Sahel',
    domain: 'allafrica.com',
    priority: 2,
    query: 'site:allafrica.com (Sahel OR Mali OR "Burkina Faso" OR Niger OR JNIM OR ISGS OR Gao OR Tillaberi) when:7d'
  },
  {
    conflictKey: 'sahel',
    theaterLabel: 'Sahel',
    countryIso3: 'BFA',
    outletLabel: 'Le Faso',
    domain: 'lefaso.net',
    priority: 3,
    query: 'site:lefaso.net ("Burkina Faso" OR Sahel OR jihadist OR insurgent OR JNIM OR ISGS OR Djibo) when:7d'
  }
];

function googleNewsSearchUrl(query) {
  return `${GOOGLE_NEWS_BASE}?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
}

function getCountryName(iso3) {
  const alpha2 = countries.alpha3ToAlpha2(iso3);
  return alpha2 ? countries.getName(alpha2, 'en') : '';
}

const COUNTRY_PULSE_QUERY_SPECS = [
  {
    key: 'domestic',
    label: 'domestic pulse',
    query: (countryName) =>
      `"${countryName}" (government OR parliament OR election OR minister OR cabinet OR policy OR reform OR corruption OR protest) when:3d`,
    priorityOffset: 0
  },
  {
    key: 'macro',
    label: 'macro pulse',
    query: (countryName) =>
      `"${countryName}" (economy OR inflation OR unemployment OR gdp OR exports OR imports OR trade OR budget OR deficit) when:5d`,
    priorityOffset: 1
  },
  {
    key: 'business',
    label: 'business pulse',
    query: (countryName) =>
      `"${countryName}" (stocks OR bonds OR market OR bank OR currency OR manufacturing OR industry OR energy company) when:5d`,
    priorityOffset: 2
  },
  {
    key: 'security',
    label: 'security pulse',
    query: (countryName) =>
      `"${countryName}" (security OR military OR border OR sanctions OR attack OR drone OR missile OR raid OR insurgent) when:7d`,
    priorityOffset: 3
  },
  {
    key: 'society',
    label: 'society pulse',
    query: (countryName) =>
      `"${countryName}" (strike OR union OR labor OR housing OR migration OR student OR civil society OR demonstration) when:5d`,
    priorityOffset: 4
  },
  {
    key: 'diplomacy',
    label: 'diplomacy pulse',
    query: (countryName) =>
      `"${countryName}" (diplomacy OR summit OR treaty OR alliance OR nato OR eu OR un OR ministerial talks OR mediation) when:5d`,
    priorityOffset: 5
  },
  {
    key: 'energy',
    label: 'energy pulse',
    query: (countryName) =>
      `"${countryName}" (oil OR gas OR pipeline OR refinery OR power grid OR blackout OR lng OR shipping corridor) when:7d`,
    priorityOffset: 6
  }
];

function buildCountryOutletFeeds() {
  const curatedFeeds = Object.entries(COUNTRY_OUTLET_DOMAINS).flatMap(([countryIso3, outlets]) => {
    const countryName = getCountryName(countryIso3);
    return outlets.map(([outletLabel, domain], index) => ({
      key: `${countryIso3}:${domain}`,
      name: `${countryIso3} ${outletLabel}`,
      url: googleNewsSearchUrl(`site:${domain} "${countryName}" when:7d`),
      countryIso3,
      outletLabel,
      domain,
      sourceKind: 'country-outlet',
      scope: 'country-outlet',
      priority: index + 1
    }));
  });

  const fallbackWireFeeds = Object.keys(countries.getNames('en')).flatMap((alpha2) => {
    const countryIso3 = countries.alpha2ToAlpha3(alpha2);
    const countryName = countries.getName(alpha2, 'en');
    if (!countryIso3 || !countryName) {
      return [];
    }

    const hasCuratedPack =
      Array.isArray(COUNTRY_OUTLET_DOMAINS[countryIso3]) &&
      COUNTRY_OUTLET_DOMAINS[countryIso3].length > 0;
    const basePriority = hasCuratedPack ? 7 : HOTSPOT_COUNTRIES.includes(countryIso3) ? 2 : 1;

    return [
      {
        key: `wire:${countryIso3}:domestic`,
        name: `${countryIso3} country wire`,
        url: googleNewsSearchUrl(
          `"${countryName}" (government OR politics OR parliament OR economy OR inflation OR protest OR security) when:5d`
        ),
        countryIso3,
        outletLabel: `${countryName} wire`,
        domain: 'news.google.com',
        sourceKind: 'country-wire',
        scope: 'country-outlet',
        priority: basePriority
      },
      {
        key: `wire:${countryIso3}:markets`,
        name: `${countryIso3} market wire`,
        url: googleNewsSearchUrl(
          `"${countryName}" (market OR stocks OR bank OR currency OR rates OR unemployment OR trade OR industry) when:5d`
        ),
        countryIso3,
        outletLabel: `${countryName} market wire`,
        domain: 'news.google.com',
        sourceKind: 'country-wire',
        scope: 'country-outlet',
        priority: basePriority + 1
      }
    ];
  });

  return [...curatedFeeds, ...fallbackWireFeeds];
}

function buildCountryPulseFeeds() {
  return Object.keys(countries.getNames('en'))
    .flatMap((alpha2) => {
      const countryIso3 = countries.alpha2ToAlpha3(alpha2);
      const countryName = countries.getName(alpha2, 'en');
      if (!countryIso3 || !countryName) {
        return [];
      }

      const basePriority = HOTSPOT_COUNTRIES.includes(countryIso3) ? 1 : 5;
      return COUNTRY_PULSE_QUERY_SPECS.map((spec) => ({
        key: `pulse:${countryIso3}:${spec.key}`,
        name: `${countryIso3} ${spec.label}`,
        url: googleNewsSearchUrl(spec.query(countryName)),
        countryIso3,
        outletLabel: `${countryName} ${spec.label}`,
        domain: 'news.google.com',
        sourceKind: 'country-pulse',
        scope: 'country-pulse',
        priority: basePriority + spec.priorityOffset
      }));
    })
    .filter(Boolean);
}

function buildConflictOutletFeeds() {
  return CONFLICT_OUTLET_REGISTRY.map((entry) => ({
    key: `conflict:${entry.conflictKey}:${entry.domain}`,
    conflictKey: entry.conflictKey,
    theaterLabel: entry.theaterLabel,
    name: `${entry.theaterLabel} ${entry.outletLabel}`,
    url: googleNewsSearchUrl(entry.query),
    countryIso3: entry.countryIso3,
    outletLabel: entry.outletLabel,
    domain: entry.domain,
    sourceKind: 'conflict-outlet',
    scope: 'conflict-outlet',
    priority: entry.priority || 1
  }));
}

module.exports = {
  GLOBAL_RSS_FEEDS,
  GLOBAL_SHIPPING_FEEDS,
  HOTSPOT_COUNTRIES,
  BLUESKY_SOURCE_REGISTRY,
  buildCountryOutletFeeds,
  buildCountryPulseFeeds,
  buildConflictOutletFeeds
};
