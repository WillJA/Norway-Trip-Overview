#!/bin/bash
mkdir -p images_web

echo "Starting compression..."

for file in images/*.{jpg,jpeg,png,JPG,JPEG,PNG}; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        if [ ! -f "images_web/$filename" ]; then
            echo "Compressing image: $filename"
            sips -Z 1920 -s formatOptions 60 "$file" --out "images_web/$filename" >/dev/null 2>&1
        fi
    fi
done

for file in images/*.{mp4,MP4}; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        if [ ! -f "images_web/$filename" ]; then
            echo "Compressing video: $filename"
            # Try Preset1280x720 first
            avconvert -p Preset1280x720 -s "$file" -o "images_web/$filename" >/dev/null 2>&1
        fi
    fi
done
echo "Compression complete."
