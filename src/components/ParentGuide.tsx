export function ParentGuide() {
  return (
    <details className="panel parent-guide">
      <summary>Hoe werkt het?</summary>
      <ol>
        <li>Stel bij <strong>Planning</strong> de klas, periode, poetsdagen en het aantal ouders/verzorgers per poetsdag in.</li>
        <li>Kies <strong>Poetsdagen genereren</strong> om het lege rooster te maken.</li>
        <li>
          Maak bij <strong>Leerlingen</strong> de invulvelden en vul de leerlingnamen in. De naam is het unieke herkenningspunt voor de ouder(s)/verzorger(s) die poetsen.
          De verdeling probeert per leerling zo veel mogelijk dezelfde weekdag aan te houden.
          Een <strong>0 bij vorig jaar</strong> betekent nieuw in de klas en telt voor de verdeling als het gemiddelde van de andere tellingen.
        </li>
        <li>Voeg zo nodig bij <strong>Klasuitzonderingen</strong> een vrije dag voor alleen deze klas toe, bijvoorbeeld een schoolreisje.</li>
        <li>Kies in het lege rooster alvast leerlingnamen bij vaste poetsmomenten. Deze keuzes blijven vaststaan.</li>
        <li>
          Zet zo nodig <strong>Geavanceerd</strong> aan. Vink vóór de verdeling bij <strong>Kan niet op deze datum</strong> de verhinderde ouders/verzorgers aan.
        </li>
        <li>
          Kies <strong>Optimale verdeling</strong> om de overige momenten eerlijk te vullen. Automatisch ingeplande beurten liggen altijd minimaal vier weken uit elkaar.
          Voor handmatig vastgezette momenten geldt deze grens niet.
        </li>
        <li>
          Kan iemand pas later niet, zet dan <strong>Geavanceerd</strong> aan en klik bij diens toegewezen beurt op <strong>Kan niet</strong>. De app zoekt een zo klein mogelijke ruil die past bij alle voorkeuren en verhinderingen. Gewijzigde plekken tonen ook wie er eerder stond.
        </li>
        <li>Controleer het rooster en download, print of kopieer het. Gebruik <strong>Back-up &amp; import</strong> om later elders verder te werken.</li>
      </ol>
      <p className="guide-note">De schoolkalender onderaan is alleen voor beheerders; schoolbrede vrije dagen worden automatisch toegepast.</p>
    </details>
  );
}
