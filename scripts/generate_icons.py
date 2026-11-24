import zlib
import struct
import os

def create_png(width: int, height: int, output_path: str):
    """Generate a clean PNG icon for Recare."""
    # RGBA image
    raw_data = bytearray()
    
    # Recare Green: #16a34a (22, 163, 74)
    # White Eye: #ffffff
    cx, cy = width / 2.0, height / 2.0
    r_outer = width * 0.45
    r_eye = width * 0.22
    r_pupil = width * 0.10

    for y in range(height):
        raw_data.append(0)  # Filter type 0 (None)
        for x in range(width):
            dx = x - cx
            dy = y - cy
            dist = (dx * dx + dy * dy) ** 0.5

            if dist <= r_outer:
                # Inside green circle / badge
                # Check if inside white eye
                eye_dist_y = abs(dy) * 1.6
                eye_val = (dx * dx + eye_dist_y * eye_dist_y) ** 0.5
                if eye_val <= r_eye:
                    # Inside eye
                    if dist <= r_pupil:
                        # Pupil (Dark green)
                        raw_data.extend([20, 83, 45, 255])
                    else:
                        # Eye white
                        raw_data.extend([255, 255, 255, 255])
                else:
                    # Outer badge green
                    raw_data.extend([22, 163, 74, 255])
            else:
                # Transparent
                raw_data.extend([0, 0, 0, 0])

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data))

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw_data), level=9)

    png_bytes = header + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'wb') as f:
        f.write(png_bytes)

for size in [16, 32, 48, 128]:
    create_png(size, size, f"/home/ai-apostle/Projects/recare/apps/extension/public/icon-{size}.png")

print("Generated Recare extension icons (16, 32, 48, 128).")
