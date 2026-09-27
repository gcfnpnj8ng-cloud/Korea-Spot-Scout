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

TikTok-fanen viser som standard kun kort, hvor stedet er matchet til en konkret lokation og krydstjekket mod en officiel eller primær kilde. Uverificerede TikTok-leads ligger bag det eksplicitte filter `Afventer lokationskontrol`; en udtrukket adresse eller et genereret Maps-søgelink er ikke i sig selv en verifikation.

Den første kontrollerede TikTok-bunke indeholder 8 steder: Inwangsan, Igidae Coastal Walk, Gwangjang Market, Sewoon Plaza, MUSINSA EMPTY Seongsu, The Hyundai Seoul, Spa Land Centum City og Haeundae Sky Capsule. Kontrollen bekræfter stedet og placeringen; tidsfølsomt TikTok-indhold skal fortsat re-tjekkes.

TikTok-data er opdelt i mindre bidder, så en ustabil forbindelse ikke efterlader fanen med en tom bunke. Hvis en bid mangler, vises en tydelig advarsel i stedet for misvisende nuller.

Det aktuelle TikTok-kort henter sit previewbillede via TikToks offentlige oEmbed-data. Billeder indlæses ét ad gangen og caches kun under besøget; private eller fjernede opslag viser en neutral fallback.

Kilder og discovery-mentions vises separat på hvert kort. Kandidater, dubletter og frasorterede fund fra seneste gennemgang ligger i `data/tiktok-candidates-2026-09-27.json`.

Research-masteren ligger i Google Sheet'et "Korea Spot Database" under Rejser → Sydkorea 2027.

## Hosting
Sitet er lavet som en statisk GitHub Pages-app uden betalt backend.
