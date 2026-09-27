# Korea Spot Swipe · TikTok discovery

Åbn `index.html` i en moderne browser. Appen indeholder:

- 10.015 lokaliserbare TikTok-stedkort plus 10 kuraterede referencekort.
- Kun TikTok-fund med en præcis adresse eller et konkret, søgbart stedsnavn.
- Ét sted pr. kort; flere TikToks om samme sted samles som kilder.
- Direkte søgelinks til Naver Map og Google Maps.
- Samlede filtre for region, otte enkle kategorier, datakvalitet og fritekst.
- Valgene **Ja**, **Måske** og **Nej** med tastaturgenveje.
- Lokal lagring i browseren og CSV-eksport af alle valg.

Standardvisningen viser kun TikTok-leads og prioriterer brugerens interesser (natur/hikes, shopping/markeder, fashion/pop-ups, mad og kultur) sammen med evidensniveau og antal kilder. Prioriteringen er en gennemgangsrækkefølge, ikke en kvalitetsscore.

TikTok-kort er stadig discovery-leads. Appen har fjernet de kort, der ikke kunne lokaliseres ud fra caption eller et specifikt navn. Et **Ja** eller **Måske** bør stadig verificeres med Naver Map, officielle kilder, aktuelle åbningstider og transportdata, før det promoveres til et færdigt `Spot`. De fjernede poster ligger i `removed-unlocatable.json`, så oprydningen kan gøres om.
