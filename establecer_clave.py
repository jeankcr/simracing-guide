"""Establece (o cambia) la contraseña del editor.

Uso: python establecer_clave.py

Guarda solo una huella (hash con sal) en site/editor-config.json; la contraseña
en sí no se guarda en ningún archivo. Suba ese archivo al repositorio para que
la contraseña también aplique en la versión publicada.
"""
import getpass
import hashlib
import json
import secrets
import sys
from pathlib import Path

ARCHIVO = Path(__file__).resolve().parent / "site" / "editor-config.json"
ITERACIONES = 200_000


def main():
    clave = getpass.getpass("Nueva contraseña del editor: ")
    if len(clave) < 8:
        sys.exit("Use al menos 8 caracteres.")
    if clave != getpass.getpass("Repita la contraseña: "):
        sys.exit("Las contraseñas no coinciden.")
    sal = secrets.token_bytes(16)
    huella = hashlib.pbkdf2_hmac("sha256", clave.encode("utf-8"), sal, ITERACIONES)
    ARCHIVO.write_text(json.dumps({"iteraciones": ITERACIONES, "sal": sal.hex(), "hash": huella.hex()}, indent=2) + "\n", encoding="utf-8")
    print(f"Contraseña guardada en {ARCHIVO}")


if __name__ == "__main__":
    main()
