const CONFLICT_PROFILES = [
  {
    slug: 'iran-israel-us',
    title: 'Iran / Israel / U.S.',
    summary: 'Israeli and Iranian strike cycles, proxy fire, and Hormuz-to-Levant spillover.',
    description:
      'This theater follows the direct Iran-Israel confrontation plus linked proxy and shipping pressure across Lebanon, Syria, Iraq, Yemen, and the Gulf lanes. U.S. activity is treated as context, not a standalone map state, so it only enters this tab when the reporting is explicitly tied to the regional confrontation.',
    countries: ['IRN', 'ISR', 'LBN', 'SYR', 'IRQ', 'YEM', 'USA', 'JOR', 'SAU', 'ARE'],
    mapCountries: ['IRN', 'ISR', 'LBN', 'SYR', 'IRQ', 'YEM'],
    coreCountries: ['IRN', 'ISR', 'LBN', 'SYR', 'IRQ', 'YEM'],
    contextCountries: ['USA', 'JOR', 'SAU', 'ARE'],
    aliases: [
      'iran',
      'israel',
      'tehran',
      'tel aviv',
      'irgc',
      'idf',
      'hezbollah',
      'hormuz',
      'strait of hormuz',
      'gulf of aden',
      'u.s.',
      'united states',
      'american strike',
      'proxy fire'
    ],
    allowAliasOnlyMatch: true,
    aliasOnlyMinSeverity: 3.2,
    sources: [
      { key: 'iranstrike', label: 'IranStrike', kind: 'structured-live', url: 'https://iranstrike.com/', adapter: 'iranstrike' },
      { key: 'missilestrikes', label: 'MissileStrikes', kind: 'analysis-feed', url: 'https://missilestrikes.com/', adapter: 'missilestrikes' },
      {
        key: 'liveuamap-iran',
        label: 'Iran LiveUAMap',
        kind: 'reference-map',
        url: 'https://iran.liveuamap.com/',
        summaryOverride:
          'Live conflict map centered on Iranian, Israeli, Lebanese, Syrian, and Gulf-linked strike reporting.',
        detailOverride: 'Regional live map'
      },
      {
        key: 'worldpopulationreview',
        label: 'World Population Review',
        kind: 'registry-source',
        url: 'https://worldpopulationreview.com/country-rankings/countries-currently-at-war',
        summaryOverride:
          'High-level registry listing current wars and active armed conflicts for fast cross-checking.',
        detailOverride: 'Conflict registry'
      }
    ],
    history: {
      updatedAt: 'April 14, 2026',
      summary:
        'The current phase is a regional war system rather than a single front. It sits on top of the October 7, 2023 Gaza war, the Israel-Hezbollah confrontation on the Lebanon border, Iranian proxy networks across the region, and the direct Israel-Iran exchange that intensified again in early 2026.',
      scopeNote:
        'Kompass maps the Middle East battle space itself. The United States is an active military and political actor in this theater, but it does not appear as a default map country unless the reporting is directly tied to the conflict chain.',
      sections: [
        {
          title: 'How it escalated',
          body:
            'The regional confrontation accelerated after Hamas attacked Israel on October 7, 2023 and Israel launched the Gaza war. Since then, Israel, Iran-backed groups, Hezbollah, the Houthis, and U.S. forces have all been pulled into overlapping strike cycles. By early 2026, the theater had hardened into a connected conflict arc stretching from Lebanon and Syria to Iraq, Yemen, and the Gulf shipping lanes.'
        },
        {
          title: 'Who is involved',
          body:
            'The core state actors are Iran and Israel, with Hezbollah in Lebanon, armed groups in Syria and Iraq, and the Houthis in Yemen driving much of the daily escalation. The United States matters because of regional basing, naval presence, air defense operations, and deterrence strikes, but it is treated here as contextual unless the event is explicitly linked to the theater.'
        },
        {
          title: 'What matters operationally',
          body:
            'Kompass follows missile launches, airstrikes, proxy attacks, cross-border raids, and shipping disruption around the Strait of Hormuz and adjacent sea lanes. The key risk is not only headline strikes, but the way simultaneous pressure across multiple fronts can create sudden jumps in oil, shipping, and regional war risk.'
        }
      ],
      timeline: [
        { date: 'October 7, 2023', label: 'Hamas attacks Israel, triggering the Gaza war and a wider regional escalation cycle.' },
        { date: '2024-2025', label: 'Direct Israel-Iran exchanges and proxy attacks widen the conflict beyond Gaza.' },
        { date: 'February 28, 2026', label: 'A sharper direct Israel-Iran military phase further tightens the regional war linkage.' }
      ],
      sources: [
        { label: 'IranStrike', url: 'https://iranstrike.com/' },
        { label: 'MissileStrikes', url: 'https://missilestrikes.com/' },
        { label: 'Iran LiveUAMap', url: 'https://iran.liveuamap.com/' },
        { label: 'World Population Review', url: 'https://worldpopulationreview.com/country-rankings/countries-currently-at-war' }
      ]
    }
  },
  {
    slug: 'russia-ukraine',
    title: 'Russia / Ukraine',
    summary: 'Frontline warfare, deep-strike exchanges, and Black Sea pressure.',
    description:
      'This theater is centered on Ukraine and western Russia. Belarus, Poland, Romania, and Moldova are treated as context states only, so they enter the tab when the reporting is explicitly about the war, cross-border spillover, logistics, or air-defense exposure.',
    countries: ['UKR', 'RUS', 'BLR', 'POL', 'ROU', 'MDA'],
    mapCountries: ['UKR', 'RUS', 'BLR'],
    coreCountries: ['UKR', 'RUS'],
    contextCountries: ['BLR', 'POL', 'ROU', 'MDA'],
    aliases: [
      'ukraine',
      'russia',
      'kyiv',
      'kherson',
      'kharkiv',
      'donetsk',
      'luhansk',
      'zaporizhzhia',
      'crimea',
      'odesa',
      'odessa',
      'black sea',
      'kursk'
    ],
    allowAliasOnlyMatch: true,
    aliasOnlyMinSeverity: 3,
    sources: [
      {
        key: 'warmonit',
        label: 'WarMonit',
        kind: 'reference-map',
        url: 'https://warmonit.com/ukraine-war-map',
        summaryOverride:
          'Conflict map and reporting focused on battlefield geography, strike patterns, and frontline changes in the Russia-Ukraine war.',
        detailOverride: 'Ukraine war map'
      },
      {
        key: 'liveuamap-ukraine',
        label: 'Ukraine LiveUAMap',
        kind: 'reference-map',
        url: 'https://liveuamap.com/',
        summaryOverride:
          'Live map of strikes, cross-border attacks, and military developments in Ukraine and adjacent war space.',
        detailOverride: 'Live incident map'
      },
      {
        key: 'kyivindependent',
        label: 'Kyiv Independent',
        kind: 'field-reporting',
        url: 'https://kyivindependent.com/',
        summaryOverride:
          'Field-focused reporting on Ukrainian military operations, civilian damage, and war policy.',
        detailOverride: 'Field reporting'
      },
      {
        key: 'isw',
        label: 'Institute for the Study of War',
        kind: 'analysis-feed',
        url: 'https://www.understandingwar.org/',
        summaryOverride:
          'Daily analytical reporting on operational trends, territorial shifts, and force posture.',
        detailOverride: 'Operational analysis'
      }
    ],
    history: {
      updatedAt: 'April 14, 2026',
      summary:
        'Russia seized Crimea in 2014 and backed separatist war in eastern Ukraine before launching a full-scale invasion on February 24, 2022. The conflict is now a long war of attrition combining trench warfare, drones, missiles, infrastructure strikes, and pressure on Black Sea logistics.',
      scopeNote:
        'Kompass keeps the map centered on Ukraine and Russia. Neighboring NATO and border states show up only when reporting explicitly ties them to the war, not just because they are nearby.',
      sections: [
        {
          title: 'How it began',
          body:
            'The present war has two layers: the first started in 2014 with Russia s annexation of Crimea and the Donbas war; the second began on February 24, 2022 with Russia s full-scale invasion. Since then the conflict has expanded beyond frontlines into a constant exchange of missiles, drones, and infrastructure attacks.'
        },
        {
          title: 'What drives it now',
          body:
            'The war is defined by attrition, industrial capacity, air defense endurance, long-range strike adaptation, and access to ammunition and external support. Black Sea shipping, grain routes, and energy infrastructure remain economically important parts of the war, not just side stories.'
        },
        {
          title: 'Why the theater is scoped this way',
          body:
            'Belarus, Poland, Romania, and Moldova matter because they sit on the logistics and spillover edge of the war. Kompass treats them as context states, so they are included only when the event text is explicitly about the Ukraine war or a direct war-related knock-on effect.'
        }
      ],
      timeline: [
        { date: '2014', label: 'Russia annexes Crimea and the Donbas war begins.' },
        { date: 'February 24, 2022', label: 'Russia launches its full-scale invasion of Ukraine.' },
        { date: '2023-2026', label: 'The war evolves into a long attritional conflict with drones, deep strikes, and Black Sea disruption.' }
      ],
      sources: [
        { label: 'WarMonit', url: 'https://warmonit.com/ukraine-war-map' },
        { label: 'Ukraine LiveUAMap', url: 'https://liveuamap.com/' },
        { label: 'Kyiv Independent', url: 'https://kyivindependent.com/' },
        { label: 'Institute for the Study of War', url: 'https://www.understandingwar.org/' }
      ]
    }
  },
  {
    slug: 'israel-gaza-lebanon',
    title: 'Israel / Gaza / Lebanon',
    summary: 'The Gaza war, northern border fire, and Beirut-to-Rafah escalation risk.',
    description:
      'This theater is anchored in Israel, Gaza, the West Bank, and Lebanon. Egypt, Jordan, and Syria matter for corridors and spillover, but Kompass only pulls them into this tab when the reporting is explicitly tied to the Gaza-Lebanon war chain.',
    countries: ['ISR', 'PSE', 'LBN', 'EGY', 'JOR', 'SYR'],
    mapCountries: ['ISR', 'PSE', 'LBN'],
    coreCountries: ['ISR', 'PSE', 'LBN'],
    contextCountries: ['EGY', 'JOR', 'SYR'],
    aliases: [
      'gaza',
      'west bank',
      'rafah',
      'hamas',
      'hezbollah',
      'beirut',
      'southern lebanon',
      'idf',
      'israel',
      'palestine',
      'ceasefire'
    ],
    allowAliasOnlyMatch: true,
    aliasOnlyMinSeverity: 2.8,
    sources: [
      {
        key: 'liveuamap-israel',
        label: 'Israel-Palestine LiveUAMap',
        kind: 'reference-map',
        url: 'https://israelpalestine.liveuamap.com/',
        summaryOverride:
          'Live map covering Gaza, Israel, the West Bank, and linked cross-border incidents.',
        detailOverride: 'Live conflict map'
      },
      {
        key: 'liveuamap-lebanon',
        label: 'Lebanon LiveUAMap',
        kind: 'reference-map',
        url: 'https://lebanon.liveuamap.com/',
        summaryOverride:
          'Lebanon-focused strike and border-fire map useful for the northern front and Hezbollah exchange.',
        detailOverride: 'Northern front map'
      },
      {
        key: 'timesofisrael',
        label: 'Times of Israel',
        kind: 'field-reporting',
        url: 'https://www.timesofisrael.com/',
        summaryOverride:
          'Daily conflict reporting on Israeli operations, domestic debate, and regional escalation.',
        detailOverride: 'Field reporting'
      },
      {
        key: 'middleeasteye',
        label: 'Middle East Eye',
        kind: 'field-reporting',
        url: 'https://www.middleeasteye.net/',
        summaryOverride:
          'Regional reporting and commentary on Gaza, Lebanon, and civilian impact across the war zone.',
        detailOverride: 'Regional reporting'
      }
    ],
    history: {
      updatedAt: 'April 14, 2026',
      summary:
        'The current war cycle began on October 7, 2023 when Hamas attacked Israel and Israel launched a major military campaign in Gaza. Fighting in Gaza, repeated strikes in Lebanon, and persistent West Bank tension have kept this theater active well into 2026.',
      scopeNote:
        'Kompass keeps the core map focused on Israel, Palestine, and Lebanon. Egypt, Jordan, and Syria are treated as context states because they matter for corridors, diplomacy, and spillover, but they are not the main battlefield in this tab.',
      sections: [
        {
          title: 'How it began',
          body:
            'The current phase opened on October 7, 2023 with the Hamas-led attack on Israel and Israel s response in Gaza. The war rapidly expanded beyond Gaza through displacement, hostage politics, and repeated cross-border fire on the northern front.'
        },
        {
          title: 'What drives it now',
          body:
            'The theater is shaped by Gaza combat, hostage and ceasefire negotiations, northern-border exchange involving Hezbollah, and recurring risk of wider regional escalation. Civilian harm, aid access, and urban warfare remain central rather than secondary issues.'
        },
        {
          title: 'Why it is separate from the Iran tab',
          body:
            'This tab is meant to stay grounded in the Gaza-Lebanon war system itself. The broader Iran / Israel / U.S. tab handles the wider regional strike network, while this one stays tighter on Israel, Palestine, and Lebanon unless the reporting clearly crosses into the larger regional war.'
        }
      ],
      timeline: [
        { date: 'October 7, 2023', label: 'Hamas attacks Israel and the Gaza war begins.' },
        { date: 'Late 2023', label: 'The Israel-Hezbollah border exchange hardens into a persistent northern front.' },
        { date: '2024-2026', label: 'Gaza operations, ceasefire diplomacy, and Lebanon spillover continue to define the theater.' }
      ],
      sources: [
        { label: 'Israel-Palestine LiveUAMap', url: 'https://israelpalestine.liveuamap.com/' },
        { label: 'Lebanon LiveUAMap', url: 'https://lebanon.liveuamap.com/' },
        { label: 'Times of Israel', url: 'https://www.timesofisrael.com/' },
        { label: 'Middle East Eye', url: 'https://www.middleeasteye.net/' }
      ]
    }
  },
  {
    slug: 'sudan',
    title: 'Sudan',
    summary: 'SAF-RSF warfare, state fracture, and mass humanitarian collapse.',
    description:
      'Sudan is the core battlefield in this tab. South Sudan, Chad, Egypt, and Ethiopia are context states only, so they appear when the reporting is explicitly tied to refugee spillover, border corridors, external backing, or direct war spillover.',
    countries: ['SDN', 'SSD', 'TCD', 'EGY', 'ETH'],
    mapCountries: ['SDN'],
    coreCountries: ['SDN'],
    contextCountries: ['SSD', 'TCD', 'EGY', 'ETH'],
    aliases: ['sudan', 'khartoum', 'darfur', 'rsf', 'saf', 'oumdurman', 'el fasher', 'port sudan'],
    allowAliasOnlyMatch: true,
    aliasOnlyMinSeverity: 3,
    sources: [
      {
        key: 'liveuamap-sudan',
        label: 'Sudan LiveUAMap',
        kind: 'reference-map',
        url: 'https://sudan.liveuamap.com/',
        summaryOverride:
          'Live map of clashes, artillery strikes, and city-level movement in the Sudan war.',
        detailOverride: 'Live conflict map'
      },
      {
        key: 'reliefweb-sudan',
        label: 'ReliefWeb Sudan',
        kind: 'registry-source',
        url: 'https://reliefweb.int/country/sdn',
        summaryOverride:
          'Humanitarian reporting on displacement, aid access, food pressure, and conflict impact across Sudan.',
        detailOverride: 'Humanitarian monitor'
      },
      {
        key: 'radiodabanga',
        label: 'Radio Dabanga',
        kind: 'field-reporting',
        url: 'https://www.dabangasudan.org/en',
        summaryOverride:
          'Sudan-focused reporting with strong attention to Darfur, local violence, and civilian conditions.',
        detailOverride: 'Field reporting'
      }
    ],
    history: {
      updatedAt: 'April 14, 2026',
      summary:
        'Sudan s current war began on April 15, 2023 when fighting erupted between the Sudanese Armed Forces and the Rapid Support Forces. What started as a power struggle inside the state turned into nationwide urban combat, Darfur atrocities, and one of the world s worst humanitarian crises.',
      scopeNote:
        'This is fundamentally a Sudan war. Neighboring countries matter for refugees, arms routes, and diplomacy, but Kompass does not map them as core theater states unless the reporting is directly tied to the war.',
      sections: [
        {
          title: 'How it began',
          body:
            'The war broke out after a long power struggle between the Sudanese Armed Forces, led by Abdel Fattah al-Burhan, and the Rapid Support Forces, led by Mohamed Hamdan Dagalo. Their rivalry intensified during the failed transition that followed the fall of Omar al-Bashir and became open war on April 15, 2023.'
        },
        {
          title: 'What defines the conflict',
          body:
            'Khartoum, Omdurman, Darfur, and later Port Sudan became key theaters. The conflict combines city fighting, militia violence, ethnic targeting, and state collapse, which is why humanitarian indicators matter almost as much as pure battlefield updates.'
        },
        {
          title: 'Why Kompass scopes it tightly',
          body:
            'Many Sudan stories mention Chad, Egypt, Ethiopia, or South Sudan because the war pushes people and weapons across borders. Those states are treated as context only, so this tab stays focused on Sudan itself rather than turning into a general Horn of Africa panel.'
        }
      ],
      timeline: [
        { date: 'April 15, 2023', label: 'Open war begins between the SAF and RSF.' },
        { date: '2023-2024', label: 'Khartoum and Darfur become central combat and atrocity zones.' },
        { date: '2025-2026', label: 'State fragmentation deepens and humanitarian collapse becomes entrenched.' }
      ],
      sources: [
        { label: 'Sudan LiveUAMap', url: 'https://sudan.liveuamap.com/' },
        { label: 'ReliefWeb Sudan', url: 'https://reliefweb.int/country/sdn' },
        { label: 'Radio Dabanga', url: 'https://www.dabangasudan.org/en' }
      ]
    }
  },
  {
    slug: 'myanmar',
    title: 'Myanmar',
    summary: 'Junta airstrikes, resistance offensives, and a nationwide civil war.',
    description:
      'Myanmar is the core battlefield in this tab. Thailand, India, China, and Bangladesh are context states only, so they appear here when the reporting explicitly references the Myanmar war, refugee spillover, border fighting, or state support linked to the conflict.',
    countries: ['MMR', 'THA', 'IND', 'CHN', 'BGD'],
    mapCountries: ['MMR'],
    coreCountries: ['MMR'],
    contextCountries: ['THA', 'IND', 'CHN', 'BGD'],
    aliases: [
      'myanmar',
      'burma',
      'junta',
      'tatmadaw',
      'naypyidaw',
      'yangon',
      'sagaing',
      'magway',
      'shan',
      'kachin',
      'chin state',
      'rakhine',
      'arakan army',
      "people's defence forces",
      "people's defense forces",
      'people s defence forces',
      'people s defense forces',
      'national unity government',
      'karenni',
      'karen state',
      'karen national union'
    ],
    allowAliasOnlyMatch: true,
    aliasOnlyMinSeverity: 2.8,
    sources: [
      {
        key: 'liveuamap-myanmar',
        label: 'Myanmar LiveUAMap',
        kind: 'reference-map',
        url: 'https://myanmar.liveuamap.com/',
        summaryOverride:
          'Live map focused on Myanmar fighting, airstrikes, and significant border-related incidents.',
        detailOverride: 'Live conflict map'
      },
      {
        key: 'myanmar-now',
        label: 'Myanmar Now',
        kind: 'field-reporting',
        url: 'https://myanmar-now.org/en/',
        summaryOverride:
          'Independent reporting on junta operations, resistance activity, and local conditions across Myanmar.',
        detailOverride: 'Field reporting'
      },
      {
        key: 'frontier-myanmar',
        label: 'Frontier Myanmar',
        kind: 'field-reporting',
        url: 'https://www.frontiermyanmar.net/en/',
        summaryOverride:
          'Long-form reporting and analysis on Myanmar s civil war, armed groups, and state breakdown.',
        detailOverride: 'Field reporting'
      }
    ],
    history: {
      updatedAt: 'April 14, 2026',
      summary:
        'Myanmar s current civil war was triggered by the military coup on February 1, 2021, but it sits on top of decades of older ethnic insurgencies. Since late 2023, the war has become more nationwide, with resistance coalitions and ethnic armed organizations taking and contesting territory while the junta relies heavily on air power.',
      scopeNote:
        'This is why the Myanmar tab should not paint half of Asia by default. Neighboring states matter for refugees, trade, and diplomacy, but Kompass now treats them as context only unless the reporting is explicitly about the Myanmar war.',
      sections: [
        {
          title: 'How it began',
          body:
            'Myanmar gained independence in 1948 and has lived with multiple ethnic insurgencies for decades. The current nationwide phase began on February 1, 2021 when the military overthrew the elected government, which triggered mass protest, armed resistance, and the rapid spread of local People s Defence Forces.'
        },
        {
          title: 'Who is fighting',
          body:
            'The junta and Tatmadaw are fighting a fragmented but increasingly coordinated anti-junta camp that includes the National Unity Government, local People s Defence Forces, and long-established ethnic armed organizations such as the Arakan Army, Kachin Independence Army, and Karen and Karenni forces.'
        },
        {
          title: 'What changed after 2023',
          body:
            'Late-2023 offensives, especially Operation 1027 and related campaigns, showed that the junta could lose ground across multiple fronts at once. Since then, Myanmar has looked less like a contained post-coup crisis and more like a full civil war with regional humanitarian spillover.'
        }
      ],
      timeline: [
        { date: '1948 onward', label: 'Myanmar inherits long-running ethnic insurgencies after independence.' },
        { date: 'February 1, 2021', label: 'The military coup triggers nationwide protest and armed resistance.' },
        { date: 'Late 2023-2026', label: 'Coordinated resistance offensives expand the war and erode junta control in multiple regions.' }
      ],
      sources: [
        { label: 'Myanmar LiveUAMap', url: 'https://myanmar.liveuamap.com/' },
        { label: 'Myanmar Now', url: 'https://myanmar-now.org/en/' },
        { label: 'Frontier Myanmar', url: 'https://www.frontiermyanmar.net/en/' }
      ]
    }
  },
  {
    slug: 'drc',
    title: 'DRC',
    summary: 'Eastern Congo rebel warfare, M23 advances, and Great Lakes spillover.',
    description:
      'This theater is centered on eastern Democratic Republic of the Congo. Rwanda, Uganda, Burundi, and Tanzania appear as context states when the reporting explicitly concerns the M23 conflict, cross-border backing, refugee flows, or Great Lakes military spillover.',
    countries: ['COD', 'RWA', 'UGA', 'BDI', 'TZA'],
    mapCountries: ['COD', 'RWA', 'UGA'],
    coreCountries: ['COD'],
    contextCountries: ['RWA', 'UGA', 'BDI', 'TZA'],
    aliases: [
      'congo',
      'drc',
      'democratic republic of congo',
      'm23',
      'north kivu',
      'south kivu',
      'goma',
      'bukavu',
      'kinshasa'
    ],
    allowAliasOnlyMatch: true,
    aliasOnlyMinSeverity: 3,
    sources: [
      {
        key: 'liveuamap-drc',
        label: 'DR Congo LiveUAMap',
        kind: 'reference-map',
        url: 'https://drcongo.liveuamap.com/',
        summaryOverride:
          'Live map of eastern Congo violence, rebel movement, and cross-border incident reporting.',
        detailOverride: 'Live conflict map'
      },
      {
        key: 'newhumanitarian-drc',
        label: 'The New Humanitarian',
        kind: 'field-reporting',
        url: 'https://www.thenewhumanitarian.org/africa/democratic-republic-congo',
        summaryOverride:
          'Field reporting on displacement, armed-group violence, and humanitarian conditions in eastern Congo.',
        detailOverride: 'Field reporting'
      },
      {
        key: 'africacenter',
        label: 'Africa Center',
        kind: 'analysis-feed',
        url: 'https://africacenter.org/',
        summaryOverride:
          'Regional security analysis on M23, Great Lakes spillover, and militia-linked instability.',
        detailOverride: 'Regional analysis'
      }
    ],
    history: {
      updatedAt: 'April 14, 2026',
      summary:
        'The eastern Congo conflict is part of the wider post-1990s Great Lakes crisis, but the current phase is heavily shaped by the resurgence of M23 from 2021 onward and renewed offensives from 2022 through 2026. The conflict mixes local armed-group violence, interstate tension, and massive civilian displacement.',
      scopeNote:
        'Kompass centers this tab on the eastern DRC battlefield. Rwanda, Uganda, Burundi, and Tanzania are treated as context states because they matter to the Great Lakes security system, but they should only show up here when the reporting clearly connects them to the Congo conflict.',
      sections: [
        {
          title: 'Historical roots',
          body:
            'Eastern Congo has been unstable since the aftermath of the 1994 Rwandan genocide and the regional wars that followed in the late 1990s and early 2000s. The area contains overlapping rebellions, foreign military involvement, resource competition, and weak state control.'
        },
        {
          title: 'What M23 changed',
          body:
            'The M23 movement revived in 2021 and became a defining force again from 2022 onward, especially around North Kivu. Its offensives, the question of outside support, and the threat to cities such as Goma pushed the crisis back into a high-intensity regional-security story.'
        },
        {
          title: 'Why Kompass treats neighbors carefully',
          body:
            'Many reports about this war mention Rwanda or Uganda, but not every story in those countries belongs in the DRC tab. Kompass now requires explicit Congo-war linkage before context-country incidents enter this theater.'
        }
      ],
      timeline: [
        { date: 'Late 1990s-2000s', label: 'The regional Congo wars create the long-term security crisis in the east.' },
        { date: '2012-2013', label: 'M23 first emerges as a major rebel force.' },
        { date: '2021-2026', label: 'M23 resurges and eastern Congo returns to a high-intensity conflict cycle.' }
      ],
      sources: [
        { label: 'DR Congo LiveUAMap', url: 'https://drcongo.liveuamap.com/' },
        { label: 'The New Humanitarian', url: 'https://www.thenewhumanitarian.org/africa/democratic-republic-congo' },
        { label: 'Africa Center', url: 'https://africacenter.org/' }
      ]
    }
  },
  {
    slug: 'yemen-red-sea',
    title: 'Yemen / Red Sea',
    summary: 'Houthi conflict, Red Sea shipping pressure, and coalition retaliation.',
    description:
      'Yemen is the core battlefield, while Saudi Arabia, the UAE, Oman, Djibouti, Eritrea, and Egypt are context states tied to sea-lane exposure, coalition activity, and Bab al-Mandeb or Suez disruption. They appear here only when the reporting is explicitly linked to the Yemen war or Red Sea attack cycle.',
    countries: ['YEM', 'SAU', 'ARE', 'OMN', 'DJI', 'ERI', 'EGY'],
    mapCountries: ['YEM', 'SAU', 'DJI', 'ERI', 'EGY'],
    coreCountries: ['YEM'],
    contextCountries: ['SAU', 'ARE', 'OMN', 'DJI', 'ERI', 'EGY'],
    aliases: [
      'yemen',
      'houthi',
      'houthis',
      'ansarallah',
      'red sea',
      'bab al-mandeb',
      'gulf of aden',
      'sanaa',
      'hodeidah',
      'hudaidah'
    ],
    allowAliasOnlyMatch: true,
    aliasOnlyMinSeverity: 2.8,
    sources: [
      {
        key: 'liveuamap-yemen',
        label: 'Yemen LiveUAMap',
        kind: 'reference-map',
        url: 'https://yemen.liveuamap.com/',
        summaryOverride:
          'Live map of Yemen strikes, Houthi activity, and Red Sea-linked incident reporting.',
        detailOverride: 'Live conflict map'
      },
      {
        key: 'usni-redsea',
        label: 'USNI Red Sea Security',
        kind: 'analysis-feed',
        url: 'https://news.usni.org/2026/02/25/report-to-congress-on-yemen-and-red-sea-security',
        summaryOverride:
          'Structured background on the Yemen conflict, Houthi activity, and the security of the Red Sea shipping corridor.',
        detailOverride: 'Security backgrounder'
      },
      {
        key: 'gcaptain-redsea',
        label: 'gCaptain',
        kind: 'field-reporting',
        url: 'https://gcaptain.com/',
        summaryOverride:
          'Shipping-focused reporting on vessel rerouting, tanker risk, and maritime disruption linked to Red Sea attacks.',
        detailOverride: 'Shipping reporting'
      }
    ],
    history: {
      updatedAt: 'April 14, 2026',
      summary:
        'Yemen s war deepened after the Houthi movement seized Sanaa in 2014 and the Saudi-led intervention began in 2015. A newer layer was added from late 2023 onward, when Houthi attacks on shipping turned the Bab al-Mandeb and Red Sea into a global economic choke-point story as well as a war story.',
      scopeNote:
        'This tab is not a generic Middle East or shipping panel. Yemen is the core battlefield, and sea-lane states appear only when the event text clearly ties them to Houthi attacks, Red Sea disruption, coalition response, or the Yemen war itself.',
      sections: [
        {
          title: 'How it began',
          body:
            'The modern war escalated in 2014 when the Houthis captured Sanaa and in 2015 when a Saudi-led coalition intervened. The conflict became a long mix of civil war, regional intervention, and humanitarian collapse.'
        },
        {
          title: 'Why the Red Sea matters',
          body:
            'From late 2023, Houthi attacks on commercial shipping and naval assets turned the Bab al-Mandeb and Red Sea into one of the world s most important war-linked trade chokepoints. That means energy, freight, and insurance stress are part of this theater s logic, not a side effect.'
        },
        {
          title: 'What Kompass watches',
          body:
            'Kompass tracks strikes inside Yemen, cross-border retaliation, missile and drone launches, naval incidents, and shipping disruptions that explicitly reference the Houthi campaign or the Yemen war chain.'
        }
      ],
      timeline: [
        { date: '2014', label: 'The Houthis seize Sanaa and the conflict enters a new phase.' },
        { date: '2015', label: 'The Saudi-led military intervention internationalizes the war.' },
        { date: 'Late 2023-2026', label: 'Red Sea and Bab al-Mandeb attacks turn the conflict into a major shipping-security crisis.' }
      ],
      sources: [
        { label: 'Yemen LiveUAMap', url: 'https://yemen.liveuamap.com/' },
        { label: 'USNI Red Sea Security', url: 'https://news.usni.org/2026/02/25/report-to-congress-on-yemen-and-red-sea-security' },
        { label: 'gCaptain', url: 'https://gcaptain.com/' }
      ]
    }
  },
  {
    slug: 'sahel',
    title: 'Sahel',
    summary: 'Jihadist insurgency, coups, and cross-border state erosion in the central Sahel.',
    description:
      'This theater follows the core insurgency belt across Mali, Burkina Faso, and Niger. Mauritania, Chad, Benin, and Nigeria are context states that appear here only when the reporting explicitly concerns Sahel insurgent spillover, military operations, or cross-border pressure.',
    countries: ['MLI', 'NER', 'BFA', 'TCD', 'MRT', 'BEN', 'NGA'],
    mapCountries: ['MLI', 'NER', 'BFA'],
    coreCountries: ['MLI', 'NER', 'BFA'],
    contextCountries: ['TCD', 'MRT', 'BEN', 'NGA'],
    aliases: [
      'sahel',
      'mali',
      'niger',
      'burkina',
      'burkina faso',
      'jnim',
      'isgs',
      'agad',
      'agadz',
      'tillaberi',
      'gao',
      'mopti',
      'ouagadougou'
    ],
    allowAliasOnlyMatch: true,
    aliasOnlyMinSeverity: 2.8,
    sources: [
      {
        key: 'liveuamap-sahel',
        label: 'Sahel LiveUAMap',
        kind: 'reference-map',
        url: 'https://sahel.liveuamap.com/',
        summaryOverride:
          'Regional map of insurgent violence, military operations, and security incidents across the Sahel belt.',
        detailOverride: 'Live conflict map'
      },
      {
        key: 'africacenter-sahel',
        label: 'Africa Center',
        kind: 'analysis-feed',
        url: 'https://africacenter.org/',
        summaryOverride:
          'Security analysis on JNIM, IS Sahel, coups, and the spread of violence across West Africa.',
        detailOverride: 'Regional analysis'
      },
      {
        key: 'acled',
        label: 'ACLED',
        kind: 'analysis-feed',
        url: 'https://acleddata.com/',
        summaryOverride:
          'Conflict-event monitoring used widely for tracking armed-group violence and escalation patterns.',
        detailOverride: 'Conflict data'
      }
    ],
    history: {
      updatedAt: 'April 14, 2026',
      summary:
        'The modern Sahel conflict system grew out of Mali s 2012 crisis and spread across Burkina Faso and Niger through the mid-2010s. Military coups, weak state reach, jihadist network adaptation, and cross-border maneuver have turned the central Sahel into a persistent regional insurgency belt.',
      scopeNote:
        'Kompass keeps the map tight on Mali, Burkina Faso, and Niger because that is the core belt. Other nearby states show up only when the incident is clearly part of the same insurgent and counterinsurgent system.',
      sections: [
        {
          title: 'How it formed',
          body:
            'The current security crisis traces back to the 2012 rebellion and jihadist surge in Mali. Over time, violence spread south and east, especially into Burkina Faso and Niger, while states struggled to hold territory outside major urban centers.'
        },
        {
          title: 'Why coups matter',
          body:
            'Successive coups in Mali, Burkina Faso, and Niger changed the political layer of the conflict but did not solve the insurgency. Instead, the military and diplomatic fragmentation of the region often made cross-border response harder.'
        },
        {
          title: 'What Kompass tracks',
          body:
            'Kompass watches attacks on towns, bases, and transport corridors, plus insurgent movement, civilian massacres, and cross-border spread into the wider coastal and Lake Chad arc when that linkage is explicit.'
        }
      ],
      timeline: [
        { date: '2012', label: 'Mali s rebellion and jihadist surge ignite the modern Sahel conflict cycle.' },
        { date: 'Mid-2010s', label: 'Violence spreads strongly into Burkina Faso and Niger.' },
        { date: '2020-2023', label: 'Coups reshape the region s politics without ending the insurgency.' }
      ],
      sources: [
        { label: 'Sahel LiveUAMap', url: 'https://sahel.liveuamap.com/' },
        { label: 'Africa Center', url: 'https://africacenter.org/' },
        { label: 'ACLED', url: 'https://acleddata.com/' }
      ]
    }
  }
];

module.exports = {
  CONFLICT_PROFILES
};
