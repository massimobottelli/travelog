#!/usr/bin/env bash
# Travelog MVP1 — Quick scan demo script
# Usage: ./scripts/demo-scan.sh [photo_folder]

GEOCOAPIFY_API_KEY="${GEOCOAPIFY_API_KEY:-9f1b3729ec244a4e962131929daee414}"
GEOCOAPIFY_URL="https://api.geoapify.com/v1/geocode/reverse"

print_header() {
  echo ""
  echo "========================================"
  echo "$1"
  echo "========================================"
  echo ""
}

parse_decimal() {
  local raw="$1" ref="$2"
  python3 -c "
import sys
raw_str = sys.argv[1].replace('deg', '').replace(chr(39), '').replace(chr(34), '').strip().split()
ref = sys.argv[2]
try:
    parts = []
    for p in raw_str:
        try:
            parts.append(float(p))
        except Exception:
            pass
    if len(parts) >= 3:
        val = abs(parts[0]) + abs(parts[1])/60 + abs(parts[2])/3600
        if ref == 'S':
            val = -val
        print(round(val, 6))
    else:
        print(0)
except Exception:
    print(0)
" "$raw" "$ref"
}

geocode() {
  local lat="$1" lon="$2"
  curl -s --max-time 15 \
    "${GEOCOAPIFY_URL}?lat=${lat}&lon=${lon}&apiKey=${GEOCOAPIFY_API_KEY}&format=json" \
    | jq -r '.results[0] // empty | "\(.city // .town // "")|\(.state // .region // "")|\(.county // "")|\(.country_code // "")|\(.postcode // "")"' 2>/dev/null || echo "ERROR"
}

PHOTO_ROOT="${1:-test}"

if [[ ! -d "$PHOTO_ROOT" ]]; then
  echo "Directory not found: $PHOTO_ROOT"
  exit 1
fi

echo "Scanning: ${PHOTO_ROOT}"
echo "Geoapify API configured"

TMPFILE=$(mktemp)
find "$PHOTO_ROOT" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.heic" -o -iname "*.heif" \) 2>/dev/null | sort > "$TMPFILE"
PHOTOS=()
while IFS= read -r line; do
  PHOTOS+=("$line")
done < "$TMPFILE"
rm -f "$TMPFILE"

total=${#PHOTOS[@]}
has_gps=0
no_gps=0
errors=0

echo ""
echo "Found $total photo(s):"
echo "-------------------"
echo ""

for photo in "${PHOTOS[@]}"; do
  filename=$(basename "$photo")
  filesize=$(stat -f%z "$photo" 2>/dev/null || stat -c%s "$photo" 2>/dev/null || echo "?")
  echo "[*] ${filename} (${filesize} bytes)"

  dto=$(exiftool -s3 -DateTimeOriginal "$photo" 2>/dev/null | head -1 || echo "")
  gps_lat_raw=$(exiftool -s3 -GPSLatitude "$photo" 2>/dev/null | head -1 || echo "")
  gps_lon_raw=$(exiftool -s3 -GPSLongitude "$photo" 2>/dev/null | head -1 || echo "")
  lat_ref=$(exiftool -s3 -GPSLatitudeRef "$photo" 2>/dev/null | head -1 || echo "N")
  lon_ref=$(exiftool -s3 -GPSLongitudeRef "$photo" 2>/dev/null | head -1 || echo "E")

  if [[ -z "$gps_lat_raw" || -z "$gps_lon_raw" ]]; then
    echo "     SKIPPED - no GPS"
    ((no_gps++)) || true
    echo ""
    continue
  fi

  lat_dec=$(parse_decimal "$gps_lat_raw" "$lat_ref")
  lon_dec=$(parse_decimal "$gps_lon_raw" "$lon_ref")

  if [[ -z "$lat_dec" || -z "$lon_dec" || "$lat_dec" == "0" ]]; then
    echo "     Could not parse GPS"
    ((no_gps++)) || true
    echo ""
    continue
  fi

  ((has_gps++)) || true
  echo "     GPS: ${lat_dec}, ${lon_dec}"
  [[ -n "$dto" ]] && echo "     Date: ${dto}"

  result=$(geocode "$lat_dec" "$lon_dec")
  IFS='|' read -r city state county country postcode <<< "$result"

  echo -n "     Location -> "
  if [[ "$city" != "null" && -n "$city" ]]; then
    echo "${YELLOW}${city}"
    [[ -n "$county" && "$county" != "null" ]] && echo "       Province: ${county}"
    [[ -n "$state" && "$state" != "null" ]] && echo "       Region: ${state}"
    [[ -n "$country" && "$country" != "null" ]] && echo "       Country: ${country}"
  else
    echo "NOT FOUND"
    ((errors++)) || true
  fi
  echo ""
done

print_header "Summary"
echo "Total: $total | With GPS: $has_gps | No GPS: $no_gps | Errors: $errors"
echo ""
