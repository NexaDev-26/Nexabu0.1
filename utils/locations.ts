// Tanzanian Regions and Districts
export const TANZANIAN_REGIONS = [
  'Arusha',
  'Dar es Salaam',
  'Dodoma',
  'Geita',
  'Iringa',
  'Kagera',
  'Katavi',
  'Kigoma',
  'Kilimanjaro',
  'Lindi',
  'Manyara',
  'Mara',
  'Mbeya',
  'Mjini Magharibi',
  'Morogoro',
  'Mtwara',
  'Mwanza',
  'Njombe',
  'Pemba North',
  'Pemba South',
  'Pwani',
  'Rukwa',
  'Ruvuma',
  'Shinyanga',
  'Simiyu',
  'Singida',
  'Songwe',
  'Tabora',
  'Tanga',
  'Unguja North',
  'Unguja South',
  'Zanzibar North',
  'Zanzibar South and Central'
];

export const TANZANIAN_DISTRICTS: { [key: string]: string[] } = {
  'Dar es Salaam': [
    'Ilala',
    'Kinondoni',
    'Temeke',
    'Ubungo',
    'Kigamboni'
  ],
  'Arusha': [
    'Arusha City',
    'Arusha District',
    'Karatu',
    'Longido',
    'Meru',
    'Monduli',
    'Ngorongoro'
  ],
  'Dodoma': [
    'Bahi',
    'Chamwino',
    'Chemba',
    'Dodoma City',
    'Kondoa',
    'Kongwa',
    'Mpwapwa'
  ],
  'Mwanza': [
    'Ilemela',
    'Kwimba',
    'Magu',
    'Misungwi',
    'Nyamagana',
    'Sengerema',
    'Ukerewe'
  ],
  'Mbeya': [
    'Chunya',
    'Ileje',
    'Kyela',
    'Mbarali',
    'Mbeya City',
    'Mbeya District',
    'Mbozi',
    'Rungwe'
  ],
  'Tanga': [
    'Handeni',
    'Kilindi',
    'Korogwe',
    'Lushoto',
    'Mkinga',
    'Muheza',
    'Pangani',
    'Tanga City'
  ],
  'Morogoro': [
    'Gairo',
    'Kilombero',
    'Kilosa',
    'Malinyi',
    'Morogoro District',
    'Morogoro Municipal',
    'Mvomero',
    'Ulanga'
  ],
  'Kilimanjaro': [
    'Hai',
    'Moshi District',
    'Moshi Municipal',
    'Mwanga',
    'Rombo',
    'Same',
    'Siha'
  ],
  'Tabora': [
    'Igunga',
    'Kaliua',
    'Nzega',
    'Sikonge',
    'Tabora Municipal',
    'Urambo',
    'Uyui'
  ],
  'Mara': [
    'Bunda',
    'Butiama',
    'Musoma District',
    'Musoma Municipal',
    'Rorya',
    'Serengeti',
    'Tarime'
  ],
  'Kagera': [
    'Biharamulo',
    'Bukoba District',
    'Bukoba Municipal',
    'Karagwe',
    'Kyerwa',
    'Missenyi',
    'Muleba',
    'Ngara'
  ],
  'Iringa': [
    'Iringa District',
    'Iringa Municipal',
    'Kilolo',
    'Mafinga',
    'Mufindi',
    'Njombe'
  ],
  'Mtwara': [
    'Masasi',
    'Mtwara District',
    'Mtwara Municipal',
    'Nanyumbu',
    'Newala',
    'Tandahimba'
  ],
  'Lindi': [
    'Kilwa',
    'Lindi District',
    'Lindi Municipal',
    'Liwale',
    'Nachingwea',
    'Ruangwa'
  ],
  'Ruvuma': [
    'Mbinga',
    'Namtumbo',
    'Nyasa',
    'Songea District',
    'Songea Municipal',
    'Tunduru'
  ],
  'Shinyanga': [
    'Kahama',
    'Kishapu',
    'Shinyanga District',
    'Shinyanga Municipal'
  ],
  'Kigoma': [
    'Buhigwe',
    'Kakonko',
    'Kasulu',
    'Kibondo',
    'Kigoma District',
    'Kigoma-Ujiji',
    'Uvinza'
  ],
  'Rukwa': [
    'Kalambo',
    'Nkasi',
    'Sumbawanga District',
    'Sumbawanga Municipal'
  ],
  'Pwani': [
    'Bagamoyo',
    'Kibaha District',
    'Kibaha Town',
    'Kisarawe',
    'Mafia',
    'Mkuranga',
    'Rufiji'
  ],
  'Manyara': [
    'Babati',
    'Hanang',
    'Kiteto',
    'Mbulu',
    'Simanjiro'
  ],
  'Simiyu': [
    'Bariadi',
    'Busega',
    'Itilima',
    'Maswa',
    'Meatu'
  ],
  'Geita': [
    'Bukombe',
    'Chato',
    'Geita',
    'Mbogwe',
    'Nyang\'hwale'
  ],
  'Katavi': [
    'Mlele',
    'Mpanda District',
    'Mpanda Town'
  ],
  'Njombe': [
    'Ludewa',
    'Makambako',
    'Makete',
    'Njombe District',
    'Njombe Town',
    'Wanging\'ombe'
  ],
  'Songwe': [
    'Ileje',
    'Mbozi',
    'Momba'
  ],
  'Mjini Magharibi': [
    'Magharibi',
    'Mjini'
  ],
  'Pemba North': [
    'Micheweni',
    'Wete'
  ],
  'Pemba South': [
    'Chake Chake',
    'Mkoani'
  ],
  'Unguja North': [
    'Kaskazini A',
    'Kaskazini B'
  ],
  'Unguja South': [
    'Kati',
    'Kusini'
  ],
  'Zanzibar North': [
    'Kaskazini A',
    'Kaskazini B'
  ],
  'Zanzibar South and Central': [
    'Kati',
    'Kusini'
  ]
};

export interface LocationOption {
  region: string;
  district: string;
  fullName: string;
}

export const getAllLocations = (): LocationOption[] => {
  const locations: LocationOption[] = [];
  TANZANIAN_REGIONS.forEach(region => {
    const districts = TANZANIAN_DISTRICTS[region] || [];
    if (districts.length > 0) {
      districts.forEach(district => {
        locations.push({
          region,
          district,
          fullName: `${district}, ${region}`
        });
      });
    } else {
      // If no districts, add region as location
      locations.push({
        region,
        district: region,
        fullName: region
      });
    }
  });
  return locations.sort((a, b) => a.fullName.localeCompare(b.fullName));
};

export const getDistrictsByRegion = (region: string): string[] => {
  return TANZANIAN_DISTRICTS[region] || [];
};

