"""Genere le classeur fictif « Suivi des demandes » des tests.

Aucune donnee reelle : noms, dossiers et textes sont inventes, les domaines sont en `.test`.
Le format reproduit celui du classeur tenu par le manager : un titre, une ligne de compteurs,
une ligne vide, puis l'en-tete en ligne 4 et les donnees a partir de la ligne 5.
"""
from datetime import date, time
from openpyxl import Workbook

EN_TETE = [
    "Date", "Heure", "Priorite", "Statut", "Type", "Sujet / dossier",
    "Demande ou reclamation de la donneuse d'ordre", "Action attendue",
    "Responsable AZMG", "Commentaire de suivi", "Ref. mail (id Gmail)", "Lien mail",
]

ASSISTANTE = [
    (date(2026, 3, 2), time(9, 25), "P1", "A traiter", "Demande",
     "Cotation fret aerien Alger (dossier fictif)",
     "Le client attend la cotation depuis deux jours",
     "Relancer le transitaire et transmettre la cotation",
     "Elysa (appui Jaona)", "", "fil1fictif", "https://exemple-fictif.test/mail/1"),
    (date(2026, 3, 2), time(11, 0), "P2", "A verifier", "Reclamation",
     "Proforma a corriger (dossier fictif)",
     "La proforma comporte une erreur de devise",
     "Refaire la proforma en dollars et la faire valider",
     "Elysa (appui Jaona)", "vu avec le client", "", "https://exemple-fictif.test/mail/2"),
    (date(2026, 3, 3), None, "P3", "Traite", "Information",
     "Documents d'expedition recus (dossier fictif)",
     "Les originaux sont arrives",
     "Classer le dossier sous le numero de BL",
     "Elysa (appui Jaona)", "", "", ""),
    (date(2026, 3, 3), time(14, 30), "P2", "En cours", "Procedure",
     "Classement des expeditions (dossier fictif)",
     "Un dossier par expedition, nomme au numero de BL",
     "Appliquer et inscrire dans les procedures",
     "Elysa (appui Jaona)", "", "", ""),
]

DESIGNER = [
    (date(2026, 3, 2), time(10, 0), "P1", "A traiter", "Reclamation",
     "Visuels de la semaine (dossier fictif)",
     "Les visuels ne respectent pas la charte",
     "Reprendre les visuels selon la charte et les faire valider",
     "Miangaly (appui Aina)", "", "", ""),
    (date(2026, 3, 4), None, "P2", "A traiter", "Demande",
     "Planning editorial LinkedIn (dossier fictif)",
     "Trois publications par semaine sont attendues",
     "Proposer un planning editorial couvrant le mois",
     "Miangaly (appui Aina)", "", "", ""),
]

def remplir(feuille, titre, lignes):
    feuille["A1"] = titre
    feuille["A2"] = "Total demandes"
    feuille["B2"] = len(lignes)
    feuille["C2"] = "P1 non traitees"
    feuille["D2"] = sum(1 for l in lignes if l[2] == "P1" and l[3] != "Traite")
    for colonne, valeur in enumerate(EN_TETE, start=1):
        feuille.cell(row=4, column=colonne, value=valeur)
    for index, ligne in enumerate(lignes, start=5):
        for colonne, valeur in enumerate(ligne, start=1):
            if valeur not in (None, ""):
                feuille.cell(row=index, column=colonne, value=valeur)

classeur = Workbook()
premiere = classeur.active
premiere.title = "Elysa"
remplir(premiere, "Suivi des demandes de la donneuse d'ordre a l'assistante export (fictif)", ASSISTANTE)
remplir(classeur.create_sheet("Miangaly"), "Suivi des demandes de la donneuse d'ordre a la designer (fictif)", DESIGNER)
classeur.save("tests/fixtures/SUIVI_DEMANDES_FICTIF.xlsx")
print("ecrit : tests/fixtures/SUIVI_DEMANDES_FICTIF.xlsx")
