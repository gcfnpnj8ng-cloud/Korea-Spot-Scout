# Korea Spot Scout

Mobilvenlig swipe-app til planlægning af Sydkorea 2027.

## Funktioner
- Swipe eller brug Nej / Måske / Like
- To profiler: Mikkel og Partner
- Matches når begge liker samme spot
- Filtre efter by og kategori
- Detaljevisning med Naver Map og Google Maps
- Hike-felter for relevante ruter
- Lokal lagring i browseren
- Eksport/import af valg som JSON, så valg kan flyttes mellem enheder

## Data
Hovedbunken indeholder 23 verificerede spots fra Seoul, Busan, Gyeongju, Sokcho/Seoraksan og Jeju. De 13 seneste kort kommer fra TikTok/social discovery og er først optaget efter deduplikering og kontrol mod officielle eller primære kilder.

Den separate `discovery/`-bunke indeholder hele den tidligere rensede TikTok-pipeline: 12.338 fund blev behandlet, 5.974 frasorteret og 6.364 TikToks bevaret. Da flere opslag nævner flere steder, giver det 10.015 lokaliserbare TikTok-stedkort. De vises som discovery-leads, ikke som færdigt verificerede eller scorede spots.

Discovery-data bevarer de samlede kilde-URL'er, mention-id'er, evidensniveau, lokationslabel og mapsøgning. Kun hovedbunkens 23 kort regnes som verificerede.

Discovery-bunken åbner som en fane inde i hovedappen og indlæses først, når `TikTok-fund` vælges. Den bruger de samme Mikkel/Louise-profiler og samme lokale valglager. Et `Nej` fjerner kortet fra den aktive bunke, mens filtrene `Mine likes`, `Mine måske`, `Frasorterede`, `Vores matches` og `Alle vurderinger` gør alle valg genfindelige.

TikTok-fanen viser som standard 3.352 swipekort: 20 steder kontrolleret manuelt på Naver Map eller mod en officiel/primær kilde samt 3.332 stærke Google-adressematches. Google-kortene er tydeligt mærket `Afventer Naver` og kan vælges eller frasorteres efter relevans, mens den manuelle lokationskontrol fortsætter. Filteret `20 Naver-/kildekontrollerede` viser kun den sikre bunke. En udtrukket adresse eller et genereret Maps-søgelink er ikke i sig selv en verifikation.

Den kontrollerede TikTok-bunke indeholder nu 13 steder: Inwangsan, Igidae Coastal Walk, Gwangjang Market, Sewoon Plaza, MUSINSA EMPTY Seongsu, The Hyundai Seoul, Spa Land Centum City, Haeundae Sky Capsule, National Museum of Korea, Kakao Friends Hongdae, KT&G Sangsang Madang Busan, Times Square Yeongdeungpo og Seoul Arts Center Opera Theater. Kontrollen bekræfter stedet og placeringen; tidsfølsomt TikTok-indhold skal fortsat re-tjekkes.

TikTok-data er opdelt i mindre bidder, så en ustabil forbindelse ikke efterlader fanen med en tom bunke. Hvis en bid mangler, vises en tydelig advarsel i stedet for misvisende nuller.

Det aktuelle TikTok-kort henter sit previewbillede via TikToks offentlige oEmbed-data. Billeder indlæses ét ad gangen og caches kun under besøget; private eller fjernede opslag viser en neutral fallback.

## Automatisk lokationskontrol uden Naver Cloud

Naver Cloud Platform kan ikke oprettes for den aktuelle danske konto. Appen bruger derfor fortsat almindelige Naver Map-søgelinks, som ikke kræver login eller API-nøgle. Automatisk kontrol sker i stedet med Google Places API (New) som en lokal byggeproces; API-nøglen bliver aldrig lagt i GitHub Pages.

1. Opret en ny Google-nøgle, begræns den til **Places API (New)** og sæt en lav budget-/forbrugsalarm. En nøgle, der har været delt i chat, skal erstattes.
2. Kopiér `.env.example` til `.env` og indsæt nøglen lokalt.
3. Kontrollér omfanget uden API-kald med `npm run verify:places:dry`.
4. Kør ID-opslag med `npm run verify:places -- --limit=10000`. Scriptet bruger kun den gratis **Places API Text Search Essentials (IDs Only)**-variant. Tilladte Place ID'er og vores egen kontrolstatus caches i den ignorerede `work/`-mappe; navne, adresser og andet Google Places-indhold hentes eller gemmes ikke.
5. Kør `npm run verify:addresses -- --limit=10000` for en gratis Places Details Essentials-kontrol af kort med adresser. Kun den afledte matchafgørelse og Place ID gemmes; Googles adresse gemmes ikke.
6. Gennemgå den reducerede `work/naver-manual-unresolved.json` på Naver Map. Registrér sikre lokationer og afvisninger i `data/location-review-decisions.json`, og kør `npm run verify:apply`.

Et Google Place ID og et adresse-match er kun første kontroltrin. De aktuelle kørsler gav 3.335 stærke Google-adressematches, men de vises kun i den separate ventekø, indtil de også er kontrolleret manuelt på Naver. De første Naver-runder har godkendt syv steder og frasorteret to; 6.671 kort afventer fortsat manuel Naver-kontrol. Poster uden en sikker lokation skrives til `discovery/removed-after-map-review.json` og vises kun under filteret **Frasorteret uden lokation**. Et sted promoveres først til den verificerede hovedbunke efter kontrol mod en officiel eller anden primær kilde.

Kilder og discovery-mentions vises separat på hvert kort. Kandidater, dubletter og frasorterede fund fra seneste gennemgang ligger i `data/tiktok-candidates-2026-09-27.json`.

Research-masteren ligger i Google Sheet'et "Korea Spot Database" under Rejser → Sydkorea 2027.

## Hosting
Sitet er lavet som en statisk GitHub Pages-app uden betalt backend.
