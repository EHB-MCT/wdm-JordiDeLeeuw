# Reflectie

## Outcomes

Dit project resulteerde in een tool die informatie verzamelt uit screenshots die gebruikers uploaden. Wanneer een gebruiker afbeeldingen toevoegt, wordt eerst alle tekst uit die beelden gehaald via OCR. Deze tekst vormt de basis voor verdere verwerking in de backend.

Tijdens de analyse wordt de tekst onderzocht op verschillende signalen. Zo wordt er gekeken of er tijdstippen in voorkomen, zoals uren en minuten, en of er sociale context aanwezig is, zoals namen, e-mailadressen, telefoonnummers, handles of relatie-aanduidingen. Daarnaast probeert het systeem te detecteren of er professioneel risicovol gedrag zichtbaar is, zoals agressieve taal, scheldwoorden of overdreven gebruik van hoofdletters en uitroeptekens. Ook wordt onderzocht of de tekst woorden of context bevat die iets kunnen verraden over locaties of verplaatsingen van de gebruiker.

Naast deze detecties maakt het systeem ook een samenvatting met behulp van een AI-model. Deze samenvatting vormt de kern van het user-facing deel van het project. De gebruiker krijgt hiermee een duidelijk overzicht van wat zijn screenshots over hem kunnen prijsgeven. In sommige gevallen vermeldt de samenvatting ook dat er mogelijke risicosignalen aanwezig zijn, afhankelijk van hoe goed de analyse functioneert.

De invloed op het gebruikersprofiel zit vooral in deze samenvatting. Door de manier waarop de inhoud wordt herwerkt, wordt de gebruiker subtiel geconfronteerd met zijn eigen data en mogelijke privacy- of risicogevoelige informatie. Voor de administrator wordt alle verzamelde data samengebracht en visueel weergegeven in een dashboard met grafieken, waardoor trends en patronen zichtbaar worden over meerdere analyses heen.

## Shortcomings

Hoewel het project functioneel werkt, zijn er duidelijke beperkingen. Het admin-dashboard laat toe om data te bekijken, maar biedt weinig controle. Het is niet mogelijk om individuele gebruikers te selecteren, filters toe te passen of gerichte beslissingen te nemen op basis van specifieke profielen. Hierdoor blijft het dashboard vooral informatief in plaats van interactief.

Daarnaast werkt niet elk onderdeel van de analyse via AI. Bepaalde detecties, zoals scheldwoorden, agressie en sociale context, zijn gebaseerd op vaste woordenlijsten en eenvoudige regels. Dit maakt deze onderdelen beperkt en soms onnauwkeurig, vooral bij meertalige tekst of wanneer woorden in een andere betekenis worden gebruikt. Enkel de samenvatting zelf wordt volledig door een AI-model gegenereerd.

Ook had ik aan het begin van het project beter kunnen nadenken over welke data ik precies wilde verzamelen. Hoewel het analyseren van screenshots inhoudelijk interessant is, verzamel ik weinig interactiedata zoals klikken, navigatie of gedrag binnen de interface. Dit maakt het gebruikersprofiel minder volledig, al was dit deels een bewuste keuze door tijdsdruk en technische complexiteit.

## Why (oorzaken van de beperkingen)

Een belangrijke reden voor deze tekortkomingen is de technische moeilijkheid van het werken met AI. Het correct laten functioneren van de analysepipeline nam veel meer tijd in beslag dan verwacht. Het opzetten van OCR, databanklogica en AI-analyse die stabiel samenwerken, bleek complex en foutgevoelig.

Daarnaast heeft het gebruik van OpenCode het ontwikkelproces sterk vertraagd. Gedurende bijna een volledige dag gaf dit hulpmiddel foutieve of misleidende antwoorden. Hierdoor werd een volledige development branch onbruikbaar en heb ik die uiteindelijk moeten achterlaten. Vervolgens ben ik overgestapt naar Codex, wat opnieuw tijd kostte maar wel nodig was om verder te kunnen werken.

Ook de performantie van de AI zorgde voor problemen. Omdat alles lokaal draait, moest ik voortdurend kiezen tussen snelheid en stabiliteit. Snellere instellingen zorgden ervoor dat mijn laptop extreem warm werd, terwijl veiligere instellingen de analyse aanzienlijk vertraagden. Dit maakte experimenteren en uitbreiden moeilijk.

## What did I learn

Uit dit project heb ik vooral geleerd hoe snel een idee complex wordt wanneer AI, data-analyse en infrastructuur samenkomen. Ik heb inzicht gekregen in hoe OCR, databanken en AI-modellen elkaar beïnvloeden en hoe fouten in één onderdeel gevolgen hebben voor het hele systeem.

Daarnaast heb ik geleerd om kritischer om te gaan met hulpmiddelen zoals AI-codegeneratie. Blind vertrouwen op tools zoals OpenCode kan leiden tot grote tijdsverliezen en verkeerde keuzes. Het project leerde me ook om sneller knopen door te hakken en te durven stoppen met een fout spoor.

Tot slot heeft het project mijn kijk op data en privacy veranderd. Het werd duidelijk hoeveel gevoelige informatie mensen onbewust bewaren in screenshots. Zelfs zonder expliciete bedoeling kunnen tijdstippen, namen, locaties en taalgebruik samen al een profiel vormen. Dit inzicht sluit sterk aan bij het concept van een weapon of math destruction en vormt voor mij één van de belangrijkste lessen van dit vak.
