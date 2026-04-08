import json
import os
import sys
from PIL import Image


DEFAULT_FRAME_DELAY_MS = 30


def main():
    if len(sys.argv) != 4:
        raise SystemExit("usage: extract-blueprint-tutorial-frames.py <gif_path> <output_dir> <manifest_path>")

    gif_path = sys.argv[1]
    output_dir = sys.argv[2]
    manifest_path = sys.argv[3]

    os.makedirs(output_dir, exist_ok=True)

    gif = Image.open(gif_path)
    width, height = gif.size
    frames = []
    poster_file = ""

    for index in range(getattr(gif, "n_frames", 1)):
        gif.seek(index)
        duration_ms = max(DEFAULT_FRAME_DELAY_MS, int(gif.info.get("duration") or DEFAULT_FRAME_DELAY_MS))
        frame = gif.convert("RGBA")
        frame_file = f"frame-{index:04d}.png"
        frame_path = os.path.join(output_dir, frame_file)
        frame.save(frame_path, format="PNG", optimize=True)

        if index == 0:
            poster_file = "poster.jpg"
            frame.convert("RGB").save(
                os.path.join(output_dir, poster_file),
                format="JPEG",
                quality=84,
                optimize=True
            )

        frames.append({
            "file": frame_file,
            "durationMs": duration_ms
        })

    with open(manifest_path, "w", encoding="utf-8") as handle:
        json.dump({
            "width": width,
            "height": height,
            "posterFile": poster_file,
            "frames": frames
        }, handle)


if __name__ == "__main__":
    main()
