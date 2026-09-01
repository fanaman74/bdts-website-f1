#!/usr/bin/env python3
"""Generate the checked-in EN/NL browser dictionaries from rendered French pages.

Run a production build first. The translation engine is intentionally external to
the application: production never calls a translation service and the generated
JSON remains reviewable in git.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from argostranslate import translate
from bs4 import BeautifulSoup, Comment


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src" / "i18n" / "generated"
ATTRIBUTES = ("aria-label", "content", "placeholder", "title")
SKIP_PATHS = {"epso/index.html", "epso-numerical-reasoning/index.html"}
HAS_LETTER = re.compile(r"[A-Za-zÀ-ÿ]")
PRESERVE = {
    "BDT Sironval", "MyBroker", "AG Insurance", "AXA", "Baloise", "Allianz",
    "DKV", "NN", "Vivium", "Ethias", "ARAG", "Europ Assistance",
    "Rue de Wand 29", "1020 Bruxelles", "bdts@bdts.be", "+32 2 463 19 25",
    "FR", "NL", "EN", "PDF", "IPID", "FSMA", "PLCI", "EIP",
}
EXTRA_STRINGS = {
    "Que couvre ce contrat ?",
    "Quelles sont les exclusions ?",
    "Quelles démarches sont prévues en cas de sinistre ?",
    "La requête a échoué",
    "L’assistant n’a renvoyé aucune réponse.",
    "L’assistant n’a pas renvoyé de réponse. Réessayez dans un instant.",
    "Une erreur inattendue est survenue.",
    "Fermer l’assistant",
    "Assistant documents BDTS",
    "Posez une question précise. L’assistant lit ce document et répond uniquement à partir de son contenu.",
    "Lecture du document…",
    "Votre question sur le document",
    "Posez une question sur ce document…",
    "Envoyer la question",
    "Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne",
    "Document sur demande",
    "Demander le document",
    "Portail sécurisé",
    "Accéder au portail",
    "Page BDTS",
    "Voir la page",
    "PDF direct",
    "Télécharger",
    "Ouvrir le PDF",
    "Page partenaire",
    "Voir le document",
    "Essentiels",
    "Ces cookies sont nécessaires au bon fonctionnement du site et ne peuvent pas être désactivés. Ils servent par exemple à la connexion et à l’enregistrement de vos préférences de confidentialité.",
    "Statistiques",
    "Ces cookies nous aident à améliorer le site en mesurant les pages les plus consultées et la manière dont les visiteurs naviguent.",
    "Marketing",
    "Ces cookies sont utilisés par nous et nos partenaires publicitaires pour vous proposer des publicités pertinentes, ici et ailleurs, et pour mesurer la performance de ces campagnes.",
    "Nous utilisons des cookies pour améliorer votre expérience, personnaliser le contenu et analyser notre trafic.",
    "Tout accepter",
    "Accepter tous les cookies",
    "Refuser les non essentiels",
    "Refuser tous les cookies non essentiels",
    "Préférences",
    "Ouvrir les préférences",
    "Personnalisez vos préférences en matière de cookies",
    "Nous respectons votre droit à la vie privée. Vous pouvez refuser certains types de cookies. Vos préférences s’appliqueront à l’ensemble du site.",
    "Enregistrer et fermer",
    "Enregistrer vos préférences de cookies",
    "Corps de requête trop volumineux.",
    "Corps de requête invalide.",
    "Champs invalides.",
    "Trop de demandes en peu de temps. Merci de réessayer dans quelques minutes.",
    "Trop de demandes en peu de temps. Merci de patienter un instant avant de recommencer.",
    "Le service est temporairement indisponible.",
    "Votre demande n'a pas pu être enregistrée. Merci de réessayer.",
}


def useful(value: str) -> bool:
    value = value.strip()
    if len(value) < 2 or len(value) > 900:
        return False
    if value in PRESERVE or not HAS_LETTER.search(value):
        return False
    if "{" in value or "}" in value or value.startswith(("http://", "https://")):
        return False
    return True


def collect() -> list[str]:
    strings: set[str] = set(EXTRA_STRINGS)
    html_root = ROOT / "dist" / "client"
    for path in html_root.rglob("*.html"):
        relative = path.relative_to(html_root).as_posix()
        if relative in SKIP_PATHS:
            continue
        soup = BeautifulSoup(path.read_text(encoding="utf-8"), "html.parser")
        if relative == "documents/index.html":
            # Product names are official document metadata, not interface copy.
            for row in soup.select(".document-browser article"):
                row.decompose()
        for node in soup.find_all(string=True):
            if isinstance(node, Comment) or node.parent.name in {"script", "style"}:
                continue
            value = " ".join(node.split())
            if useful(value):
                strings.add(value)
        for element in soup.find_all(True):
            for attribute in ATTRIBUTES:
                value = element.get(attribute)
                if isinstance(value, str) and useful(value):
                    strings.add(" ".join(value.split()))
    return sorted(strings, key=lambda item: (len(item), item.casefold()))


def main() -> None:
    source = collect()
    english: dict[str, str] = {}
    dutch: dict[str, str] = {}
    for index, value in enumerate(source, 1):
        en = translate.translate(value, "fr", "en")
        nl = translate.translate(en, "en", "nl")
        english[value] = en
        dutch[value] = nl
        if index % 25 == 0:
            print(f"translated {index}/{len(source)}")

    OUTPUT.mkdir(parents=True, exist_ok=True)
    for locale, entries in (("en", english), ("nl", dutch)):
        (OUTPUT / f"{locale}.json").write_text(
            json.dumps(entries, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
    print(f"wrote {len(source)} strings per locale")


if __name__ == "__main__":
    main()
