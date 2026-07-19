import os
import json
import math
import subprocess
import xml.etree.ElementTree as ET

try:
    import exifread
except ImportError:
    print("Please install exifread by running: pip install exifread")
    exit(1)

IMAGES_DIR = "images"
GPX_DIR = "gpx"
OUTPUT_JSON = "photos.json"

def get_decimal_from_dms(dms, ref):
    degrees = dms[0].num / dms[0].den
    minutes = dms[1].num / dms[1].den / 60.0
    seconds = dms[2].num / dms[2].den / 3600.0
    decimal = degrees + minutes + seconds
    if ref in ['S', 'W']:
        decimal = -decimal
    return decimal

def get_exif_data(filepath):
    if filepath.lower().endswith('.mp4'):
        lat, lon, date_str = None, None, None
        
        # Point mdls to the original .mov file if it exists (avconvert strips metadata)
        mdls_target = filepath
        base_name = os.path.splitext(filepath)[0]
        for ext in ['.MOV', '.mov']:
            if os.path.exists(base_name + ext):
                mdls_target = base_name + ext
                break
                
        try:
            out_dur = subprocess.check_output(['mdls', '-name', 'kMDItemDurationSeconds', mdls_target]).decode('utf-8')
            if '=' in out_dur:
                dur_str = out_dur.split('=')[1].strip()
                if dur_str == '(null)' or float(dur_str) < 3.0:
                    return None, None, None
                    
            out_date = subprocess.check_output(['mdls', '-name', 'kMDItemContentCreationDate', mdls_target]).decode('utf-8')
            if '=' in out_date:
                d_val = out_date.split('=')[1].strip()
                if d_val != '(null)':
                    date_str = d_val.split(' +')[0]
                    
            out_lat = subprocess.check_output(['mdls', '-name', 'kMDItemLatitude', mdls_target]).decode('utf-8')
            if '=' in out_lat:
                l_val = out_lat.split('=')[1].strip()
                if l_val != '(null)':
                    lat = float(l_val)
                    
            out_lon = subprocess.check_output(['mdls', '-name', 'kMDItemLongitude', mdls_target]).decode('utf-8')
            if '=' in out_lon:
                l_val = out_lon.split('=')[1].strip()
                if l_val != '(null)':
                    lon = float(l_val)
        except Exception:
            pass
        return lat, lon, date_str
        
    with open(filepath, 'rb') as f:
        tags = exifread.process_file(f, details=False)
        lat, lon, date_str = None, None, None
        
        if 'GPS GPSLatitude' in tags and 'GPS GPSLongitude' in tags:
            try:
                lat = get_decimal_from_dms(tags['GPS GPSLatitude'].values, tags['GPS GPSLatitudeRef'].values)
                lon = get_decimal_from_dms(tags['GPS GPSLongitude'].values, tags['GPS GPSLongitudeRef'].values)
            except:
                pass
                
        if 'EXIF DateTimeOriginal' in tags:
            date_str = str(tags['EXIF DateTimeOriginal'])
        elif 'Image DateTime' in tags:
            date_str = str(tags['Image DateTime'])
            
        return lat, lon, date_str

def haversine(lat1, lon1, lat2, lon2):
    R = 6371  # km
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat/2) * math.sin(dLat/2) + \
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
        math.sin(dLon/2) * math.sin(dLon/2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def load_gpx_data():
    activities = {}
    for filename in os.listdir(GPX_DIR):
        if not filename.endswith('.gpx'): continue
        activity_id = filename.replace('.gpx', '')
        
        tree = ET.parse(os.path.join(GPX_DIR, filename))
        root = tree.getroot()
        ns = {'gpx': root.tag.split('}')[0].strip('{')} if '}' in root.tag else {}
        query = './/gpx:trkpt' if ns else './/trkpt'
        
        pts = root.findall(query, ns)
        if not pts: continue
        
        coords = []
        for pt in pts:
            coords.append((float(pt.attrib['lat']), float(pt.attrib['lon'])))
            
        date_query = './/gpx:time' if ns else './/time'
        time_node = root.find(date_query, ns)
        act_date = None
        if time_node is not None and time_node.text:
            act_date = time_node.text.split('T')[0]
            
        activities[activity_id] = {
            'coords': coords,
            'date': act_date
        }
    return activities

def match_photo_to_activity(lat, lon, photo_date_str, activities):
    photo_date = None
    if photo_date_str:
        photo_date = photo_date_str.split(' ')[0].replace(':', '-')
        
    candidates = []
    if photo_date:
        for act_id, data in activities.items():
            if data['date'] == photo_date:
                candidates.append(act_id)
                
    if len(candidates) == 1:
        return candidates[0]
        
    if len(candidates) > 1 and lat is not None and lon is not None:
        best_act = None
        min_dist = float('inf')
        for act_id in candidates:
            for c_lat, c_lon in activities[act_id]['coords']:
                dist = haversine(lat, lon, c_lat, c_lon)
                if dist < min_dist:
                    min_dist = dist
                    best_act = act_id
        return best_act
        
    if lat is not None and lon is not None:
        best_act = None
        min_dist = float('inf')
        for act_id, data in activities.items():
            for c_lat, c_lon in data['coords']:
                dist = haversine(lat, lon, c_lat, c_lon)
                if dist < min_dist:
                    min_dist = dist
                    best_act = act_id
        if min_dist < 5.0:
            return best_act
            
    if len(candidates) > 0:
        return candidates[0]
        
    return None

def main():
    print("Loading GPX tracks...")
    activities = load_gpx_data()
    
    photos_db = {}
    
    if not os.path.exists(IMAGES_DIR):
        os.makedirs(IMAGES_DIR)
        
    for filename in sorted(os.listdir(IMAGES_DIR)):
        if filename.lower().endswith('.mov'):
            in_path = os.path.join(IMAGES_DIR, filename)
            out_path = os.path.join(IMAGES_DIR, os.path.splitext(filename)[0] + '.mp4')
            if not os.path.exists(out_path):
                print(f"Converting {filename} to MP4 using avconvert...")
                try:
                    subprocess.run(['avconvert', '-p', 'PresetHighestQuality', '-s', in_path, '-o', out_path], check=True)
                except Exception as e:
                    print(f"Failed to convert {filename}: {e}")
        
    for filename in sorted(os.listdir(IMAGES_DIR)):
        if not filename.lower().endswith(('.jpg', '.jpeg', '.png', '.mp4')):
            continue
            
        filepath = os.path.join(IMAGES_DIR, filename)
        lat, lon, date_str = get_exif_data(filepath)
        
        if date_str is None and lat is None and lon is None:
            continue
            
        act_id = match_photo_to_activity(lat, lon, date_str, activities)
        if act_id:
            if act_id not in photos_db:
                photos_db[act_id] = []
            if not any(p['filename'] == filename for p in photos_db[act_id]):
                photos_db[act_id].append({
                    "filename": filename,
                    "lat": lat,
                    "lon": lon,
                    "date": date_str
                })
            print(f"Matched {filename} to activity {act_id} (Date: {date_str})")
        else:
            print(f"File {filename} could not be matched. (Date: {date_str})")
            
    for act_id in photos_db:
        photos_db[act_id].sort(key=lambda x: x.get('date') or '')
            
    with open(OUTPUT_JSON, 'w') as f:
        json.dump(photos_db, f, indent=2)
        
    print(f"\nDone! Wrote mapped photos/videos to {OUTPUT_JSON}")

if __name__ == "__main__":
    main()
