# Texturile usilor

Cele 12 imagini principale sunt:

- `ianuarie.png`
- `februarie.png`
- `martie.png`
- `aprilie.png`
- `mai.png`
- `iunie.png`
- `iulie.png`
- `august.png`
- `septembrie.png`
- `octombrie.png`
- `noiembrie.png`
- `decembrie.png`

Aceeasi imagine este folosita pentru luna calendaristica respectiva in fiecare
an. De exemplu, toate usile pentru luna martie folosesc `martie.png`.

Daca imaginea unei luni lipseste, site-ul incearca automat o textura specifica
anului: mai intai `AAAA-LL.png`, apoi `AAAA-LL.jpg`.

Imaginile lunilor reprezinta doar fata usii si pot avea fundal transparent.
Site-ul pastreaza proportiile lor si le imparte intre cele doua jumatati.

Fisierul `background.png` este fundalul comun din interiorul tuturor usilor.
Desenele create in atelier sunt pastrate separat pentru fiecare luna si sunt
afisate transparent deasupra acestui fundal; ele nu modifica textura usii.
