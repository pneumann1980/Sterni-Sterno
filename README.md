# 🌊 Seestern Fighters — Prototype

Ein schnelles Unterwasser-Actionspiel im Browser. Seesterne kämpfen durch Sprungangriffe.

---

## Neu in v0.15 — Sterni, Credits & Ruhm

Alle Balance-Werte liegen zentral in **`src/economy.js`**:

| Wert | Konstante | Standard |
|------|-----------|----------|
| Credits (Unterseetaler) pro Sieg | `WIN_CREDITS` | 100 |
| Seesternbox-Auszahlung pro Feld | `LOOTBOX_COIN_REWARD` | 50 (vorher 1000) |
| Preis des „Sterni“-Skins | `STERNI_PRICE` | 5000 |
| Ruhm-Stufen | `GLORY_TIERS` | Kupfer-Ruhm ab 100.000 |
| Anzeigedauer Gegner-Info | `OPPONENT_INFO_DURATION_MS` | 4000 ms |

- **Credits**: genau einmal pro regulär gewonnenem Match; abgebrochene
  Matches (z. B. Verbindungsabbruch) vergeben keine Credits. Doppelte
  Match-End-Events werden über `GameState.endGame()` verworfen.
- **Ruhm**: basiert auf den **insgesamt verdienten** Credits
  (`lifetimeCoins`) — Ausgaben im Shop reduzieren erreichten Ruhm nie.
  Fortschrittsanzeige im Hauptmenü-Profil.
- **Sterni-Skin**: im Shop kaufbar; Körper vertikal geteilt (links hellblau,
  rechts dunkelblau), beide Augen auf der hellen linken Hälfte.
- **Gegner-Info**: nach Match-Ende werden Name, Trophäen und Ruhm des
  Gegners kurz eingeblendet (online: server-validierte Werte).
- **Migration**: bestehende Profile erhalten automatisch sichere
  Standardwerte (`lifetimeCoins` = aktueller Kontostand, keine Ruhm-Stufen).

### Tests

```bash
npm test   # node --test tests/*.test.js (keine Abhängigkeiten nötig)
```

---

## Startanleitung

1. Einen lokalen HTTP-Server starten (ein einfaches `file://` reicht wegen ES-Module nicht):

```bash
# Python 3
python3 -m http.server 8080

# Node.js (npx)
npx serve .

# VS Code: Live Server Extension
```

2. Browser öffnen → `http://localhost:8080`
3. Spielmodus wählen → los!

---

## Technologie

| Bereich | Technologie |
|---------|-------------|
| 3D-Rendering | [Three.js](https://threejs.org/) v0.160 (via CDN importmap) |
| Sprache | JavaScript ES2022 (native Module, kein Build-Tool nötig) |
| Plattform | Browser (Chrome / Firefox / Edge empfohlen) |

Kein Build-Schritt, kein npm install — einfach starten.

---

## Steuerung

### Spieler 1
| Taste | Aktion |
|-------|--------|
| Pfeiltasten | Bewegen |
| Leertaste | Springen / Angriff |
| E | Interaktion (Platzhalter) |
| Q | Emote (Platzhalter) |
| TAB | Debug-Info ein/aus |
| ESC | Pause / Fortsetzen |

### Spieler 2 (Lokal-Versus)
| Taste | Aktion |
|-------|--------|
| W A S D | Bewegen |
| F | Springen / Angriff |
| R | Interaktion (Platzhalter) |
| T | Emote (Platzhalter) |

---

## Spielmechanik

- **Sprungangriff**: Auf einen Gegner springen → alle Waffen-Slots feuern gleichzeitig
- **Cooldown**: 5 Sekunden nach jedem Sprung (auch bei Fehlangriff)
- **Farbe**: Lebensanzeige, startet bei 100 – wer zuerst 0 erreicht, verliert
- **Schadensberechnung**: Summe aller belegten Slots (Slot 1: Pistole 15 + Slot 2: Säge 5 + Slot 3: Pistole 15 + Slot 4: Säge 5 = **40 Schaden pro Treffer**)

---

## Projektstruktur

```
index.html          Einstiegspunkt, CSS, HTML-Overlays
src/
  main.js           Spielschleife, orchestriert alle Module
  gamestate.js      Spielstatus (Menü / Spielen / Pause / Ende)
  world.js          Three.js Scene, Renderer, Kamera, Umgebung
  character.js      Charakterklasse: Physik, Gesundheit, Mesh
  weapons.js        Waffenklassen + WeaponSlots-System
  combat.js         Trefferprüfung und Schadensberechnung
  ai.js             Einfache KI: verfolgt Spieler, springt bei Reichweite
  input.js          Tastatureingaben (beide Spieler)
  hud.js            DOM-Overlay: Lebensbalken, Cooldown, Slots
```

---

## Was ist implementiert ✅

- Spielbarer Core-Loop (Start → Kampf → Sieg/Niederlage → Neustart)
- 3D-Unterwasserumgebung mit Bodentextur, Algen, Korallen, Nebeleffekt
- Seestern-Charaktere als 3D-Meshes (flacher Körper + 5 Arme + Augen)
- Sprungangriff mit 5-Sekunden-Cooldown
- 4 Waffen-Slots, alle feuern gleichzeitig bei Treffer
- Schadensberechnung über alle Slots (erweiterbar auf 5/6 Slots)
- KI-Gegner: verfolgt Spieler, springt bei Angriffsreichweite
- Lokaler 2-Spieler-Modus (geteilte Tastatur)
- Lebenssystem „Farbe" mit farbigen HUD-Balken
- Cooldown-Anzeige im HUD
- Hit-Flash-Feedback (Charakter blinkt weiß bei Treffer)
- Sanfter Kamera-Follow (framt beide Charaktere)
- Pause-Menü (ESC)
- Debug-Overlay (TAB)

---

## Platzhalter / noch nicht implementiert 🚧

| Feature | Status |
|---------|--------|
| Mini-Kanone Spezialeffekt | Platzhalter (Schaden vorhanden, kein Knockback) |
| Waffen-Interaktion / Shop | Nicht implementiert |
| Animationen (Walk-Cycle, Jump-Squash) | Nur Rotation/Spin als Platzhalter |
| Sound / Musik | Nicht implementiert |
| Mehrere KI-Gegner gleichzeitig | Architektur vorbereitet, UI nicht |
| Online-Multiplayer | Nicht implementiert |
| Charakterprofile / Progression | Nicht implementiert |
| Mobile-Touch-Steuerung | Nicht implementiert |

---

## Erweiterungshinweise

**Mehr Slots**: In `weapons.js` → `new WeaponSlots(6)` und in `main.js` → `equipDefault()` erweitern.

**Neue Waffe**: In `weapons.js` → `WEAPONS`-Objekt ergänzen:
```js
hammerhai: new Weapon('Hammerhai', 25, 'stun_effect'),
```

**Mehrere KI-Gegner**: `Character` + `AIController` instanziieren, in `characters`-Array übergeben, `CombatSystem.processCombat()` verarbeitet sie automatisch.

**Shop / Loadout**: `character.weaponSlots.equip(slotIndex, WEAPONS.xxx)` vor Spielstart aufrufen.
