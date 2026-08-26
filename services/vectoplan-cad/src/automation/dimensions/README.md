# Automatische Bemaßung

Dieses Modul berechnet reproduzierbare Bemaßungsketten aus Millimeter-Geometrie.

- Außenbemaßung: jede Außenkante, Öffnungsunterteilungen, Gesamtmaß und Hilfslinien.
- Innenbemaßung: Innenwände, Tür-/Fensterbreiten und verbleibende Wandabschnitte.
- Änderungen an Geometrie oder Optionen erzeugen unmittelbar ein neues JSON-Ergebnis mit neuem Fingerprint.

API: `POST /api/v1/cad/automation/dimensions/calculate`

Die Berechnung ist zustandslos. Das Ergebnis kann deshalb später sowohl von der CAD-Oberfläche als auch von VECTOPLAN Core verwendet werden.

