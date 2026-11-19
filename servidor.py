"""Tienda académica Mueblux. Ejecutar con Python 3.9 o posterior."""
import datetime
import hmac
import json
import os
import re
import secrets
import sqlite3
import webbrowser
from contextlib import closing
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, unquote
import mimetypes

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"
DATA = Path(os.environ.get("MUEBLUX_DATA", ROOT / "datos"))
DATA.mkdir(exist_ok=True)
DB = DATA / "tienda.sqlite"
PIN = os.environ.get("MUEBLUX_PIN") or secrets.token_urlsafe(12)
TEAM = [("HN21006","Stefany Lisseth Hernández Nunfio"),("AG19101","Cristian Rodolfo Aguirre Gonzales"),("QM18004","Javier Agustín Quijada Monterroza"),("VC18049","Jaime Eduardo Vigil Cardona")]
# Precios en centavos. La variante amplia tiene un suplemento fijo por modelo.
ITEMS = [
 dict(id="escritorio",name="Escritorio Alba",category="Escritorios",size=["100 × 50 × 75 cm","120 × 55 × 75 cm"],kit=3500,assembled=4500,extra=1000,install=1000,material="Melamina",img="desk",desc="Una superficie amplia y ligera para trabajar en casa."),
 dict(id="librera",name="Librera Nido",category="Estanterías",size=["70 × 30 × 150 cm","90 × 35 × 170 cm"],kit=4000,assembled=5000,extra=1500,install=1500,material="Melamina",img="shelf",desc="Estantes abiertos para libros, plantas y objetos favoritos."),
 dict(id="consola",name="Consola Loma",category="Muebles para TV",size=["120 × 40 × 48 cm","150 × 40 × 48 cm"],kit=6500,assembled=8000,extra=2000,install=2000,material="Madera y melamina",img="console",desc="Un mueble bajo que ordena tu sala y tus equipos."),
 dict(id="ropero",name="Ropero Bosque",category="Organizadores",size=["85 × 50 × 180 cm","110 × 55 × 190 cm"],kit=9000,assembled=11000,extra=3000,install=3500,material="Melamina",img="wardrobe",desc="Almacenamiento vertical con espacio para prendas y accesorios.")]
ITEMS.extend(json.loads((ROOT / "catalogo-extra.json").read_text(encoding="utf8")))
ZONES = {"Local":500,"Zona central":900,"Zona occidental":1400,"Zona oriental":1600}
FINISH = ["Roble natural","Nogal","Blanco mate"]
METHODS = ["Efectivo contra entrega","Transferencia","Tarjeta","Billetera digital"]
STATES = ["Recibido","En preparación","En ruta","Entregado"]

def init():
    with closing(sqlite3.connect(DB)) as c, c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS stock(id TEXT PRIMARY KEY, qty INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS records(code TEXT PRIMARY KEY, kind TEXT, stamp TEXT, status TEXT, body TEXT);
        CREATE TABLE IF NOT EXISTS attempts(token TEXT PRIMARY KEY, code TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS team(id TEXT PRIMARY KEY, name TEXT, role TEXT, photo TEXT);
        """)
        c.executemany("INSERT OR IGNORE INTO stock VALUES(?,20)",[(p["id"],) for p in ITEMS])
        c.executemany("INSERT OR IGNORE INTO team VALUES(?,?,'','')",TEAM)

def field(d,k,limit=200,optional=False):
    value=d.get(k,"")
    if not isinstance(value,str) or len(value)>limit or (not optional and not value.strip()):
        raise ValueError("Revisa el campo "+k+".")
    return value.strip()

def choice(value,options):
    if value not in options: raise ValueError("Selecciona una opción válida.")
    return value

def number(value,low,high):
    if type(value) is not int or not low<=value<=high: raise ValueError("Cantidad o variante inválida.")
    return value

def contact(d):
    email=field(d,"correo")
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+",email): raise ValueError("Revisa el correo.")
    return {"nombre":field(d,"nombre",100),"correo":email}

def order(c,d):
    data=contact(d)
    data.update(direccion=field(d,"direccion",300),telefono=field(d,"telefono",35))
    zone=choice(d.get("zona"),ZONES)
    method=choice(d.get("pago"),METHODS)
    periods=choice(d.get("cuotas"),[1,3,6] if method=="Tarjeta" else [1])
    lines=d.get("items")
    if not isinstance(lines,list) or not 1<=len(lines)<=60: raise ValueError("Revisa tu carrito.")
    result=[]
    total=ZONES[zone]
    for line in lines:
        if not isinstance(line,dict): raise ValueError("Producto inválido.")
        p=next((p for p in ITEMS if p["id"]==line.get("id")),None)
        if not p: raise ValueError("Producto desconocido.")
        qty=number(line.get("qty"),1,20)
        variant=number(line.get("variant"),0,1)
        mode=choice(line.get("mode"),["kit","assembled"])
        finish=choice(line.get("finish"),FINISH)
        installation=choice(line.get("install"),[True,False])
        price=p[mode]+p["extra"]*variant
        service=p["install"] if installation else 0
        if not c.execute("UPDATE stock SET qty=qty-? WHERE id=? AND qty>=?",(qty,p["id"],qty)).rowcount: raise ValueError("Existencias insuficientes para "+p["name"]+".")
        total+=(price+service)*qty
        result.append(dict(producto=p["name"],cantidad=qty,medidas=p["size"][variant],acabado=finish,modalidad="Kit" if mode=="kit" else "Ensamblado",precio=price,instalacion=service))
    return dict(**data,items=result,zona=zone,flete=ZONES[zone],total=total,pago=method,cuotas=periods,comprobante="Pendiente" if method=="Efectivo contra entrega" else "Operación simulada")

class App(BaseHTTPRequestHandler):
    def log_message(self,*args): pass
    def send(self,status,body,typ):
        self.send_response(status)
        self.send_header("Content-Type",typ)
        self.send_header("Content-Length",str(len(body)))
        self.send_header("Cache-Control","no-store")
        self.send_header("X-Content-Type-Options","nosniff")
        self.end_headers()
        self.wfile.write(body)
    def reply(self,data,status=200):
        self.send(status,json.dumps(data,ensure_ascii=False).encode(),"application/json; charset=utf-8")
    def admin(self):
        if not hmac.compare_digest(self.headers.get("X-Mueblux-Key","").encode(),PIN.encode()): raise PermissionError()
    def do_GET(self):
        path=unquote(urlsplit(self.path).path)
        with closing(sqlite3.connect(DB)) as c:
            try:
                if path=="/api/shop":
                    stock=dict(c.execute("SELECT id,qty FROM stock"))
                    return self.reply(dict(products=[dict(p,stock=stock[p["id"]]) for p in ITEMS],zones=ZONES,finishes=FINISH,methods=METHODS,team=[dict(zip(["id","name","role","photo"],r)) for r in c.execute("SELECT * FROM team ORDER BY rowid")]))
                if path=="/api/admin":
                    self.admin()
                    rows=c.execute("SELECT code,kind,stamp,status,body FROM records ORDER BY rowid DESC")
                    return self.reply([dict(code=a,kind=b,stamp=t,status=s,data=json.loads(j)) for a,b,t,s,j in rows])
                if path.startswith("/api/seguimiento/"):
                    r=c.execute("SELECT status,body FROM records WHERE code=? AND kind='Pedido'",(path.split("/")[-1],)).fetchone()
                    if not r: return self.reply({"error":"Pedido no encontrado. Revisa la referencia."},404)
                    data=json.loads(r[1])
                    return self.reply(dict(estado=r[0],entrega=data.get("despacho","Por programar"),total=data["total"],items=data["items"],pago=data["pago"],comprobante=data["comprobante"]))
                f=(PUBLIC/(path.lstrip("/") or "index.html")).resolve()
                if PUBLIC not in f.parents or not f.is_file(): return self.reply({"error":"Página no encontrada"},404)
                self.send(200,f.read_bytes(),mimetypes.guess_type(f)[0] or "application/octet-stream")
            except PermissionError: self.reply({"error":"Clave de gestión incorrecta."},403)
    def do_POST(self):
        try:
            if self.headers.get("Content-Type","").split(";")[0]!="application/json": raise ValueError("Formato incorrecto.")
            size=int(self.headers.get("Content-Length",0))
            if not 0<size<=450000: raise ValueError("Datos demasiado grandes.")
            d=json.loads(self.rfile.read(size))
            if not isinstance(d,dict): raise ValueError("Datos inválidos.")
            with closing(sqlite3.connect(DB)) as c, c:
                path=self.path
                if path.startswith("/api/admin/"):
                    self.admin()
                    if path=="/api/admin/team":
                        ident=choice(d.get("id"),dict(TEAM))
                        photo=field(d,"photo",420000,True)
                        if photo and not re.fullmatch(r"data:image/jpeg;base64,[A-Za-z0-9+/=]+",photo): raise ValueError("Usa una fotografía JPEG.")
                        c.execute("UPDATE team SET role=?,photo=COALESCE(NULLIF(?,''),photo) WHERE id=?",(field(d,"role",100),photo,ident))
                    elif path=="/api/admin/stock":
                        c.execute("UPDATE stock SET qty=? WHERE id=?",(number(d.get("qty"),0,9999),choice(d.get("id"),[p["id"] for p in ITEMS])))
                    elif path=="/api/admin/record":
                        code=field(d,"code")
                        r=c.execute("SELECT kind,body FROM records WHERE code=?",(code,)).fetchone()
                        if not r: raise ValueError("Registro desconocido.")
                        data=json.loads(r[1])
                        if r[0]=="Pedido":
                            state=choice(d.get("status"),STATES)
                            data["despacho"]=field(d,"despacho",160,True)
                            data["comprobante"]=field(d,"comprobante",160)
                        else: state=choice(d.get("status"),["Recibido","Atendido"])
                        c.execute("UPDATE records SET status=?,body=? WHERE code=?",(state,json.dumps(data),code))
                    else: raise ValueError("Acción desconocida.")
                    out={"ok":True}
                else:
                    if path=="/api/pedido":
                        token=field(d,"intento",64,True)
                        c.execute("BEGIN IMMEDIATE")
                        if token:
                            prior=c.execute("SELECT r.code,r.body FROM attempts a JOIN records r ON a.code=r.code WHERE a.token=?",(token,)).fetchone()
                            if prior: return self.reply(dict(code=prior[0],kind="Pedido",total=json.loads(prior[1])["total"]))
                        kind="Pedido"
                        data=order(c,d)
                    elif path in ["/api/contacto","/api/cotizacion"]:
                        kind="Consulta" if path.endswith("contacto") else "Cotización"
                        data=dict(**contact(d),mensaje=field(d,"mensaje",2400))
                        if kind=="Cotización":
                            data.update(tipo=choice(d.get("tipo"),["A medida","Empresa / volumen"]),medidas=field(d,"medidas",160),cantidad=number(d.get("cantidad"),1,999),empresa=field(d,"empresa",160,True),credito_fiscal=bool(d.get("credito_fiscal")))
                    else: raise ValueError("Ruta desconocida.")
                    code="MX-"+secrets.token_hex(8).upper()
                    stamp=datetime.datetime.now().isoformat(timespec="minutes")
                    c.execute("INSERT INTO records VALUES(?,?,?,'Recibido',?)",(code,kind,stamp,json.dumps(data)))
                    if kind=="Pedido" and token: c.execute("INSERT INTO attempts VALUES(?,?)",(token,code))
                    out=dict(code=code,kind=kind,total=data.get("total"))
            self.reply(out)
        except PermissionError: self.reply({"error":"Clave de gestión incorrecta."},403)
        except (ValueError,TypeError,KeyError) as e: self.reply({"error":str(e)},400)
        except sqlite3.Error: self.reply({"error":"No se pudo guardar. Intenta de nuevo."},503)

if __name__=="__main__":
    init()
    is_cloud = bool(os.environ.get("PORT"))
    host = "0.0.0.0" if is_cloud else "127.0.0.1"
    port = int(os.environ.get("PORT") or os.environ.get("MUEBLUX_PORT", "8765"))
    
    httpd = ThreadingHTTPServer((host, port), App)
    url = f"http://{host}:{httpd.server_port}/"
    print(f"MUEBLUX | {url}\nClave de gestión: {PIN}", flush=True)
    
    if not is_cloud and not os.environ.get("MUEBLUX_TEST"):
        webbrowser.open(url)
        
    httpd.serve_forever()
    