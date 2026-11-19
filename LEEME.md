# Código de Mueblux CET115

La aplicación contiene diez modelos, catálogo configurable, carrito, pedidos de prueba,
seguimiento, cotizaciones, contacto, galería y Gestión del taller.

## Abrir desde el código en Windows

Extrae la carpeta e inicia con Iniciar_Mueblux.bat. Requiere Python 3.9 o posterior.
También puedes abrir una terminal en la carpeta y ejecutar `python servidor.py`.
La consola muestra la dirección local y la clave de Gestión del taller. Mantén
la consola abierta mientras usas la aplicación.

El código guarda los registros en `datos/tienda.sqlite`. El ejecutable distribuido
por separado incluye Python y usa `%LOCALAPPDATA%\Mueblux\datos\tienda.sqlite`.
Para trasladar datos entre ambas versiones, cierra las dos, guarda una copia de
respaldo y copia el archivo SQLite a la carpeta de datos que corresponda.

Los pedidos y medios de pago son de demostración. Usa datos ficticios.
