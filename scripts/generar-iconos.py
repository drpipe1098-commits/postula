import struct, zlib

# Glifo "P" en una rejilla de 5x7.
P = ["11111","10001","10001","11111","10000","10000","10000"]
FONDO = (79, 70, 229)   # indigo
TINTA = (255, 255, 255)

def png(size, path):
    esquina = max(2, size // 6)
    escala = max(1, size // 9)
    ancho_glifo, alto_glifo = 5 * escala, 7 * escala
    ox, oy = (size - ancho_glifo) // 2, (size - alto_glifo) // 2

    filas = []
    for y in range(size):
        fila = bytearray([0])  # filtro None
        for x in range(size):
            # esquinas redondeadas: transparente fuera del radio
            cx = min(x, size - 1 - x)
            cy = min(y, size - 1 - y)
            if cx < esquina and cy < esquina:
                dx, dy = esquina - cx, esquina - cy
                if dx * dx + dy * dy > esquina * esquina:
                    fila += bytes([0, 0, 0, 0]); continue
            gx, gy = (x - ox) // escala, (y - oy) // escala
            dentro = 0 <= gx < 5 and 0 <= gy < 7 and P[gy][gx] == "1"
            r, g, b = TINTA if dentro else FONDO
            fila += bytes([r, g, b, 255])
        filas.append(bytes(fila))

    datos = zlib.compress(b"".join(filas), 9)
    def bloque(tipo, cuerpo):
        return (struct.pack(">I", len(cuerpo)) + tipo + cuerpo
                + struct.pack(">I", zlib.crc32(tipo + cuerpo) & 0xFFFFFFFF))
    cabecera = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + bloque(b"IHDR", cabecera)
                + bloque(b"IDAT", datos) + bloque(b"IEND", b""))

for s in (16, 32, 48, 128):
    png(s, f"extension/iconos/icono-{s}.png")
print("iconos generados")
