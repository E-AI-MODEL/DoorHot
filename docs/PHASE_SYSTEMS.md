# Door010 3.0 v0.6 — wisselbare fasesystemen

## Definitieve 4-fasenvariant

1. **Verkennen**
   Bundelt Interesse en Oriëntatie.
   Exit: sector en gewenste rol zijn bekend.

2. **Kiezen**
   Bundelt Beslissen en Matchen.
   Entry: Verkennen afgerond en bevoegdheidsdoel bekend.
   Exit: route en regio zijn gekozen.

3. **Realiseren**
   Bundelt Voorbereiden, Starten en Opleiden.
   Entry: route gekozen.
   Exit: gestart en opleiding actief.

4. **Verduurzamen**
   Bundelt Inductie en Behoud.
   Entry: gebruiker is gestart.
   Exit: duurzame plaatsing of expliciete afronding.

## Overgang

Een overgang is alleen toegestaan wanneer:

```text
exit huidige fase voldaan
EN entry volgende fase voldaan
EN volgende fase is expliciet toegestaan
```

## Ondersteunde systemen

- `phase-4`
- `phase-5`
- `phase-9`

Wisselen gebruikt een `canonicalPosition`, zodat voortgang en bekende data
behouden blijven.
