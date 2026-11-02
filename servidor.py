"""Servidor local para probar la guía y usar el editor con guardado directo.

Uso: python servidor.py   (luego abrir http://localhost:8000)

Solo escucha en esta computadora. El editor (/editor.html) usa /api/knowledge
para leer y guardar data/knowledge.json y regenerar site/data.json.
"""
import functools
import hashlib
import hmac
import http.server
import json
import subprocess
import sys
import time
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
SITIO = RAIZ / "site"
CONOCIMIENTO = RAIZ / "data" / "knowledge.json"
CONFIG_CLAVE = SITIO / "editor-config.json"
PUERTO = 8000
HOSTS_VALIDOS = {f"localhost:{PUERTO}", f"127.0.0.1:{PUERTO}"}


class Manejador(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass

    def _json(self, codigo, cuerpo):
        datos = json.dumps(cuerpo, ensure_ascii=False).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(datos)))
        self.end_headers()
        self.wfile.write(datos)

    def _origen_valido(self):
        # Evita que otra página web abierta en el navegador escriba en el archivo.
        if self.headers.get("Host") not in HOSTS_VALIDOS:
            return False
        origen = self.headers.get("Origin")
        return origen is None or origen.split("://", 1)[-1] in HOSTS_VALIDOS

    def _clave_valida(self):
        """Comprueba la cabecera X-Clave contra la huella de site/editor-config.json."""
        try:
            cfg = json.loads(CONFIG_CLAVE.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return False
        clave = self.headers.get("X-Clave", "").encode("utf-8")
        huella = hashlib.pbkdf2_hmac("sha256", clave, bytes.fromhex(cfg["sal"]), cfg["iteraciones"]).hex()
        if hmac.compare_digest(huella, cfg["hash"]):
            return True
        time.sleep(1)  # frena los intentos repetidos
        return False

    def _autorizado(self):
        if not self._origen_valido():
            self._json(403, {"ok": False, "mensaje": "Origen no permitido."})
        elif not self._clave_valida():
            self._json(401, {"ok": False, "mensaje": "Contraseña incorrecta o no configurada (ejecute establecer_clave.py)."})
        else:
            return True
        return False

    def do_GET(self):
        if self.path == "/api/ping":
            return self._json(200, {"ok": True})
        if self.path == "/api/knowledge":
            if not self._autorizado():
                return
            return self._json(200, json.loads(CONOCIMIENTO.read_text(encoding="utf-8")))
        super().do_GET()

    def do_POST(self):
        if self.path != "/api/knowledge":
            return self._json(404, {"ok": False, "mensaje": "No encontrado."})
        if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
            return self._json(403, {"ok": False, "mensaje": "Solicitud no permitida."})
        if not self._autorizado():
            return
        try:
            largo = int(self.headers.get("Content-Length", 0))
            texto = self.rfile.read(largo).decode("utf-8")
            nuevo = json.loads(texto)
            assert isinstance(nuevo.get("products"), dict) and isinstance(nuevo.get("rules"), list)
        except Exception:
            return self._json(400, {"ok": False, "mensaje": "El contenido no es un knowledge.json válido."})

        respaldo = CONOCIMIENTO.with_name("knowledge.respaldo.json")
        respaldo.write_text(CONOCIMIENTO.read_text(encoding="utf-8"), encoding="utf-8")
        CONOCIMIENTO.write_text(texto, encoding="utf-8")
        r = subprocess.run([sys.executable, "-X", "utf8", str(RAIZ / "crawler" / "build.py")],
                           capture_output=True, text=True, encoding="utf-8")
        if r.returncode != 0:
            return self._json(500, {"ok": False, "mensaje": "Se guardó, pero falló la reconstrucción: " + r.stderr[-400:]})
        self._json(200, {"ok": True, "mensaje": r.stdout.strip()})


if __name__ == "__main__":
    servidor = http.server.ThreadingHTTPServer(("127.0.0.1", PUERTO), functools.partial(Manejador, directory=str(SITIO)))
    print(f"Guía:   http://localhost:{PUERTO}\nEditor: http://localhost:{PUERTO}/editor.html\n(Ctrl+C para detener)")
    servidor.serve_forever()
