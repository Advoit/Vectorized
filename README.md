# Kontur

Kontur ist ein vollständig statisches Web-Tool, das PNG-, JPEG- und WebP-Bilder
im Browser in echte SVG-Pfade umwandelt. Es gibt keinen Server, keine Uploads,
keine API-Schlüssel und keine Telemetrie. Das Bild verlässt das Gerät nicht.

Die Oberfläche ist deutsch, die Anwendung läuft als statische Seite auf GitHub
Pages – sowohl unter einer Domain-Wurzel als auch unter einem
Repository-Unterpfad.

## Funktionen

- **Echte Vektorisierung:** Farb- und Schwarzweiß-Modus erzeugen Pfadgeometrie
  über VTracer/visioncortex (WebAssembly), kein eingebettetes Rasterbild im SVG.
- **Transparenz:** Durchsichtige Bereiche werden über eine unbenutzte
  Schlüsselfarbe getraced und anschließend aus den Pfaden entfernt.
- **Hintergrundentfernung:** Optionales Flood-Fill von den Bildrändern mit
  einstellbarer Toleranz.
- **Vergleichsvorschau:** Original, Vektor und teilbarer Vergleichsregler,
  synchrones Zoomen und Verschieben, Einpassen/100 %, heller/dunkler
  Hintergrund oder Transparenz-Schachbrett, optionale Pfadkonturen.
- **Nachvollziehbare Einstellungen:** Presets für Logo, Illustration und
  Schwarzweiß, gruppenweise und vollständige Zurücksetzung, Undo/Redo,
  persistierte Einstellungen (nur Einstellungen, nie Bilddaten).
- **Export:** Eigenständiges SVG mit korrektem `viewBox` sowie PNG in wählbarer
  Zielbreite und optionaler Transparenz. SVG kann zusätzlich kopiert werden.
- **Langlebige Läufe:** Tracing im Web Worker, Abbrechen durch Beenden des
  Workers, Debouncing, Schutz vor veralteten Ergebnissen und ein
  Stale-Hinweis, wenn Parameter nach einem Ergebnis geändert wurden.
- **Zweisprachig:** Deutsch und Englisch, umschaltbar im Kopfbereich und in
  `localStorage` gemerkt. Die Sprachdateien sind typisiert, eine fehlende
  Übersetzung bricht den Build statt leer zu rendern.
- **Barrierefreiheit:** Beschriftete Regler und Dialoge, Fokusführung,
  Tastaturkürzel, sichtbare Fokuszustände und `prefers-reduced-motion`.

## Voraussetzungen

- Node.js **22.12 oder neuer**
- npm **10 oder neuer**
- Ein aktueller Browser mit WebAssembly, Modul-Workern und Canvas

## Lokale Entwicklung

```bash
npm ci
npm run dev
```

Vite zeigt die lokale Adresse an (standardmäßig `http://localhost:5173`).

Weitere Befehle:

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver mit Hot Reload |
| `npm run typecheck` | TypeScript ohne Ausgabe prüfen |
| `npm run build` | Typecheck und Produktionsbuild nach `dist/` |
| `npm run preview` | Produktionsbuild lokal ausliefern |
| `npm test` | Unit- und Engine-Tests (Vitest) |
| `npm run test:e2e` | Browser-Smoke-Tests (Playwright) |
| `npm run fixtures` | Testbilder reproduzierbar neu erzeugen |

### Tests ausführen

Die Playwright-Suite baut die Anwendung selbst und startet `vite preview` auf
`127.0.0.1:4173`. Lokal unter Windows wird Microsoft Edge verwendet; in CI und
auf anderen Plattformen der von Playwright installierte Chromium.

```bash
npx playwright install chromium
npm run test:e2e
```

Für den Unterpfad-Test wird derselbe Produktionsbuild unter einem
Repository-Pfad ausgeliefert:

```powershell
# PowerShell
$env:BASE_PATH='/kontur/'
npx playwright test
```

```bash
# macOS / Linux
BASE_PATH=/kontur/ npx playwright test
```

`E2E_BASE_PATH` kann den Pfad für die Browser-Aufrufe separat setzen; ohne
Angabe fällt die Konfiguration auf `BASE_PATH` zurück.

## Deployment auf GitHub Pages

1. Repository nach GitHub pushen; der Standardbranch heißt `main`.
2. Unter **Settings → Pages → Build and deployment** als Quelle
   **GitHub Actions** wählen.
3. Der Workflow `.github/workflows/deploy.yml` startet bei jedem Push auf
   `main` oder manuell über **Actions → Deploy to GitHub Pages**.
4. Nach erfolgreichem Lauf steht die Seite unter
   `https://<konto>.github.io/<repository>/` bereit.

Der Workflow führt Unit-Tests, Typecheck, Produktionsbuild und die
Playwright-Smoke-Tests aus. Der Basis-Pfad wird aus dem Repository-Namen
abgeleitet:

- Projektseite: `/<repository>/`
- Benutzer-/Organisationsseite (`<konto>.github.io`): `/`
- Eigene Domain: `BASE_PATH=/` beim Build setzen

Manuell bauen:

```powershell
$env:BASE_PATH='/mein-repository/'
npm run build
```

```bash
BASE_PATH=/mein-repository/ npm run build
```

Der Build enthält eine Content-Security-Policy ohne externe Quellen. Alle
Skripte, Worker, Schriften und Bilder werden von derselben Origin geladen.

## Bedienung und Tastenkürzel

| Kürzel | Aktion |
| --- | --- |
| `Strg/Cmd + O` | Bild öffnen |
| `Strg/Cmd + E` | Exportdialog öffnen |
| `Strg/Cmd + Enter` | Vektorisieren bzw. aktualisieren |
| `Strg/Cmd + Z` | Rückgängig |
| `Strg/Cmd + Umschalt + Z` oder `Strg/Cmd + Y` | Wiederholen |
| `0` | Einpassen |
| `1` | 100 % |
| `+` / `-` | Zoomen |
| Pfeiltasten auf dem Vergleichsregler | Vergleichslinie verschieben |

Bilder können außerdem per Drag-and-drop oder mit `Strg/Cmd + V` aus der
Zwischenablage geladen werden. Der Tastaturweg liest die Zwischenablage über
die asynchrone Clipboard-API und fällt auf das `paste`-Ereignis zurück, wenn
der Browser keine Leseberechtigung vergibt.

Ein schließbarer Hinweis erklärt beim ersten Besuch, dass die Seite keine
Cookies setzt und ausschließlich Einstellungen und Sprache im `localStorage`
speichert. Er blockiert nichts und verlangt keine Einwilligung, weil keine
einwilligungspflichtige Verarbeitung stattfindet.

### Arbeitsauflösung

Große Bilder werden für das Tracing standardmäßig auf maximal 2400 px
Kantenlänge verkleinert. Das reduziert Laufzeit und Speicherbedarf, ohne das
Original zu verändern. Optional sind 1200, 1600, 2400, 3200 px oder die
Originalauflösung wählbar. Die Ausgabe übernimmt die Abmessungen des
Arbeitsbildes; das SVG lässt sich verlustfrei skalieren.

### Parameter

| Parameter | Bereich | Wirkung |
| --- | --- | --- |
| Farbmodus | Farbe / Schwarzweiß | Farbflächen oder binäres Schwarzweiß |
| Farbpräzision | 1–4 | Signifikante Farbbits; höher = mehr Farbstufen |
| Ebenendifferenz | 0–64 | Mindestunterschied zwischen Farbschichten |
| Kleine Flächen entfernen | 0–128 px | Speckle-Filter für Rauschflächen |
| Kurvenlänge | 0,5–10 | Minimale Länge für Kurvensegmente |
| Eckenwinkel | 0–180° | Empfindlichkeit der Eckenerkennung |
| Splice-Winkel | 0–90° | Zusammenführen benachbarter Segmente |
| Kurvenmodus | Polygon | Gerade Kanten; Spline ist im gebündelten Build deaktiviert |
| Max. Iterationen | 1–20 | Aufwand der Kurvenanpassung |
| Hintergrund entfernen | an/aus | Randflut mit Toleranz 0–100 |

Zwei Grenzen des gebündelten WASM-Builds von VTracer 0.1.0 sind gemessen und
bestimmen die Defaults:

- **Farbpräzision ≤ 4.** Mit steigender Bit-Tiefe verschmelzen die
  Farbschichten: Ein Testbild mit acht Farbstreifen ergibt bei 4 Bits acht
  Pfade, bei 5 nur noch einen mit Flächenmittelwert; ein Logo mit vier Farben
  bleibt bis 5 Bits intakt und kollabiert bei 6 auf zwei Pfade. 4 ist der
  höchste Wert, der in allen Messungen die Farbstruktur erhielt. Gespeicherte
  oder manipulierte Werte werden beim Laden und im Worker auf 4 begrenzt.
- **Nur Polygon.** Die Spline-Anpassung verschiebt die Geometrie unabhängig
  von der Farbpräzision um bis zu mehrere Dutzend Pixel: Ein Rechteck von
  160 × 60 px wird als 23 × 75 px große Linse ausgegeben (68 px Abweichung),
  während Polygon pixelgenau ist (0 px). Die Spline-Option ist daher deaktiviert
  und gespeicherte Werte werden auf Polygon abgebildet.

Beides sind Fehler des Vendors, keine Einstellungssache; die Parameter bleiben
unverändert, bis ein korrigierter Build eingebunden wird.

## Architektur

```text
Bilddatei
  └─ image/load.ts          Größen-/Formatprüfung, Dekodierung, Arbeitskopie
      └─ trace/preprocess.ts  Transparenz-Keying, Graustufen, Hintergrund-Flood-Fill
          └─ trace/engine.ts  eigener Modul-Worker pro Lauf
              └─ trace.worker.ts → vtracer.wasm (visioncortex)
                  └─ trace/postprocess.ts  SVG parsen, Schlüsselfarbe filtern,
                                          Pfade sanitisieren, Statistiken
                      └─ state/useVectorizer.ts  Abgleich mit Signatur/Request-ID
                          └─ Viewer (inline SVG) / Export (eigenständiges SVG)
```

Wichtige Entscheidungen:

- **Gebündelter Engine-Build statt CDN.** `src/vendor/vtracer/` enthält
  `vtracer-wasm@0.1.0` unverändert inklusive Lizenz. Das Build-System liefert
  die WASM-Datei als lokales Asset aus; es gibt keine Laufzeit-Abhängigkeit
  von fremden Servern.
- **Ein Worker pro Tracing-Lauf.** Der WASM-Aufruf ist synchron und lässt sich
  nicht kooperativ abbrechen. Das Beenden des Workers ist der einzige
  zuverlässige Abbruch. Zusätzlich verhindern Request-IDs, dass ein alter Lauf
  ein neueres Ergebnis überschreibt.
- **Transparenz über Schlüsselfarbe.** VTracer erwartet opake Pixel. Statt
  Alpha zu ignorieren, wird ein im Bild nicht vorkommender Key-Farbwert
  eingesetzt. Nach dem Tracing werden Pfade mit exakt dieser Füllfarbe
  entfernt. Das erhält Aussparungen und transparente Ränder.
- **Schwarzweiß als Graustufe.** Der binäre VTracer-Modus schwellwertet den
  Rotkanal. Kontur rechnet daher vorher echte Luminanz und legt transparente
  Pixel als weißes Papier an, damit das Ergebnis der erwarteten
  Helligkeitsschwelle entspricht.
- **Hintergrund ist Darstellung, keine Geometrie.** Die
  Hintergrundentfernung verändert das Tracing-Eingabebild; die gewählte
  Export-Hintergrundfarbe wird separat als Rechteck in das SVG geschrieben und
  verändert keine Pfade.
- **Zwei SVG-Pfade.** Die Vorschau rendert die sanitisierten Pfade inline im
  DOM, damit sie beim Zoomen scharf bleibt. Der Export erzeugt daraus ein
  eigenständiges Dokument mit `xmlns`, `viewBox`, optionalem Hintergrund und
  kontrollierter Dateigröße.
- **Persistenz ohne Bilddaten.** Nur Parameter und Voreinstellungen landen in
  `localStorage` (`kontur.params.v1`, `kontur.prefs.v1`). Das Bild bleibt im
  Speicher der laufenden Sitzung und wird nie gespeichert.
- **Statische Auslieferung.** Vite berechnet den Basis-Pfad aus
  `GITHUB_REPOSITORY` oder `BASE_PATH`. Asset-, Worker- und WASM-URLs werden
  dadurch auch unter einem Repository-Unterpfad korrekt aufgelöst.

### Relevante Dateien

| Pfad | Inhalt |
| --- | --- |
| `src/App.tsx` | Verdrahtung, Import, Auto-Tracing, Dialoge, Zurücksetzungen |
| `src/trace/settings.ts` | Defaults, Presets, Validierung, Signaturen |
| `src/trace/preprocess.ts` | Alpha-Keying, Graustufen, Hintergrundentfernung |
| `src/trace/trace.worker.ts` | Worker-Einstieg und WASM-Konfiguration |
| `src/trace/postprocess.ts` | SVG-Parsing, Pfadfilter, Exportdokument, Statistiken |
| `src/state/useVectorizer.ts` | Laufzeitsteuerung, Abbruch, Stale-Schutz |
| `src/components/Viewer.tsx` | Vergleich, Zoom/Pan, Statusleiste |
| `src/components/Sidebar.tsx` | Parameter, Presets, Fortschritt |
| `src/components/ExportDialog.tsx` | SVG-/PNG-Export |

## Tests

**Unit- und Engine-Tests (Vitest):** 46 Tests in 5 Dateien.

| Datei | Abdeckung |
| --- | --- |
| `tests/settings.test.ts` | Bereiche, Sanitisierung, Presets, Signaturen, Arbeitsgrößen |
| `tests/preprocess.test.ts` | Alpha-Keying, Schwarzweiß-Luminanz, Hintergrund-Flood-Fill |
| `tests/postprocess.test.ts` | SVG-Parsing, Sanitisierung, Key-Filter, Export-SVG |
| `tests/export.test.ts` | Dateinamen, PNG-Grenzen, Export-Hintergründe |
| `tests/engine.test.ts` | echter WASM-Lauf, Farb-/BW-/Transparenzpfade |

**Browser-Smoke-Tests (Playwright):** 4 Szenarien gegen den
Produktionsbuild.

1. Beispielbild laden, Vergleichsregler, Vektoransicht, Undo/Redo,
   Stale-Hinweis sowie SVG- und PNG-Download.
2. Transparentes, schwarzweißes und farbiges Testbild vektorisieren.
3. Beschädigte und nicht unterstützte Dateien ablehnen, ohne die Sitzung zu
   verlieren.
4. Auto-Tracing debouncen, großen Lauftyp abbrechen und lange Läufe beenden.

Die Suite wird zusätzlich unter einem Repository-Unterpfad ausgeführt, damit
WASM, Worker und Assets auch auf GitHub Pages-Projektseiten geprüft sind.

## Grenzen

Kontur ist bewusst ehrlich:

- **Kein KI-Vektorisierer.** Das Werkzeug erkennt Farbflächen und Kanten. Es
  zeichnet keine Objekte semantisch nach und rekonstruiert keine
  Fotodetails. Für Fotos, weiche Verläufe und feine Rasterstrukturen ist es
  ungeeignet; Logos, Icons, Piktogramme und flächige Illustrationen sind der
  Zielbereich.
- **Füllungen statt Striche.** Die Ausgabe besteht aus gefüllten Pfaden. Eine
  vorhandene Strichlogik des Originals wird nicht als editierbarer
  SVG-`stroke` wiederhergestellt.
- **Farbpräzision max. 4, keine Splines.** Beides ist im gebündelten
  Engine-Build fehlerhaft (siehe oben). Ohne Spline besteht die Ausgabe aus
  vielen kurzen geraden Segmenten; sie ist geometrisch exakt, wirkt bei sehr
  starkem Zoom aber leicht kantig.
- **Harte Transparenzschwelle.** Alpha unter 128 wird als transparent
  behandelt, darüber opak. Weiche, halbtransparente Kanten werden nicht als
  Alphagradient exportiert.
- **Schlüsselfarbe statt echtem Alpha.** Bei Bildern mit sehr wenigen
  Farben wird eine unbenutzte Ersatzfarbe gewählt. Theoretisch kann ein
  Farbmanagement- oder Antialiasing-Artefakt dieser Farbe ähneln; das
  Postprocessing filtert exakte Füllwerte.
- **Hintergrundentfernung ist randverbunden.** Eingeschlossene einfarbige
  Flächen werden nicht entfernt. Die Toleranz ist ein einfacher
  Farbabstand, keine Kanten- oder Schattenmodellierung.
- **Arbeitsauflösung begrenzt Details.** Originalauflösung ist verfügbar,
  kann aber bei großen Bildern lange dauern und viel Speicher belegen.
  Dateien über 25 MB oder 60 Megapixel werden abgelehnt.
- **PNG ist eine Rasterisierung.** Der PNG-Export rendert das SVG über Canvas
  und ist auf 8192 px Kantenlänge bzw. 60 Megapixel begrenzt. PDF und EPS
  werden nicht angeboten, weil dafür kein echter Vektorexport implementiert
  ist.
- **Ein Bild pro Sitzung, kein Speichern von Bildern.** Ein Neuladen der Seite
  verwirft das geöffnete Bild und das Ergebnis; nur Einstellungen bleiben
  erhalten.
- **Browser-Abdeckung.** Getestet werden Chromium und Microsoft Edge. Andere
  aktuelle Browser sollten funktionieren, sind aber nicht Teil der
  automatisierten Smoke-Tests.
- **Kein Fortschrittsprozent.** Der WASM-Lauf meldet Phasen, nicht den
  internen Fortschritt. Die Anzeige nennt daher Phase und Laufzeit.

## Datenschutz und Sicherheit

- Keine Netzwerkaufrufe zur Laufzeit außer dem Laden der eigenen statischen
  Assets.
- Keine Analyse, keine Cookies, keine Fehlertelemetrie.
- Bilder werden ausschließlich im Arbeitsspeicher und im Web Worker
  verarbeitet.
- Strenge CSP im Produktionsbuild: eigene Skripte, `wasm-unsafe-eval`,
  Blob-/Data-Bilder, eigene Worker; keine externen Origins.
- Dateinamen werden vor dem Download bereinigt; erzeugte SVGs werden geparst
  und auf erlaubte Elemente/Attribute beschränkt.

## Lizenz

Der Anwendungscode steht unter der MIT-Lizenz, siehe [LICENSE](LICENSE).
Lizenzhinweise der gebündelten Bibliotheken und der Engine stehen in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); die Original-Lizenz von
`vtracer-wasm` liegt zusätzlich unter `src/vendor/vtracer/LICENSE`.
