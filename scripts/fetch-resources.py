"""Fetch genuine NASA observations and self-hosted Leaflet assets. No credentials needed."""
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.parse import urlencode
from datetime import datetime, timezone
import json
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'dist' / 'data'
VENDOR = ROOT / 'dist' / 'vendor'
DATA.mkdir(parents=True, exist_ok=True)
VENDOR.mkdir(parents=True, exist_ok=True)

def get(url):
    with urlopen(Request(url, headers={'User-Agent': 'FieldShift-Hackathon/1.0'}), timeout=180) as response:
        return response.read()

params = dict(parameters='PRECTOTCORR,T2M,T2M_MAX,T2M_MIN,GWETROOT', community='AG', latitude=12.97,
              longitude=77.6, start='20060101', end='20251231', format='JSON', **{'time-standard':'LST'})
url = 'https://power.larc.nasa.gov/api/temporal/daily/point?' + urlencode(params)
target = DATA / 'bengaluru-power.json'
if not target.exists():
    raw = json.loads(get(url))
    assert len(raw['properties']['parameter']['PRECTOTCORR']) >= 7300
    raw['_fieldShift'] = dict(sourceUrl=url, retrievedAt=datetime.now(timezone.utc).isoformat(),
                              location='Bengaluru, Karnataka', latitude=12.97, longitude=77.6,
                              start='2006-01-01', end='2025-12-31', kind='NASA POWER archived response')
    target.write_text(json.dumps(raw, separators=(',', ':')), encoding='utf-8')
print('NASA POWER snapshot ready:', target.stat().st_size, 'bytes', flush=True)

for name in ['leaflet.js','leaflet.css','images/layers.png','images/layers-2x.png','images/marker-icon.png','images/marker-icon-2x.png','images/marker-shadow.png']:
    target = VENDOR / name
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists(): target.write_bytes(get('https://unpkg.com/leaflet@1.9.4/dist/' + name))
print('Leaflet assets ready', flush=True)
(VENDOR / 'LEAFLET-LICENSE.txt').write_bytes(get('https://unpkg.com/leaflet@1.9.4/LICENSE'))

caps = get('https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.1.1')
(ROOT / 'qa').mkdir(exist_ok=True)
(ROOT / 'qa' / 'gibs-capabilities.xml').write_bytes(caps)
root = ET.fromstring(caps)
names = [e.text for e in root.iter('Name') if e.text]
print('Available candidate layers:', json.dumps([n for n in names if any(x in n for x in ['NDVI','IMERG','SMAP_L4'])][:35]), flush=True)
layer = 'MODIS_Terra_CorrectedReflectance_TrueColor'
assert layer in names
params = dict(SERVICE='WMS',VERSION='1.1.1',REQUEST='GetMap',LAYERS=layer,STYLES='',SRS='EPSG:4326',
              BBOX='73,9,82,18',WIDTH=1000,HEIGHT=1000,FORMAT='image/jpeg',TIME='2025-01-15')
url = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?' + urlencode(params)
img = get(url)
assert img[:2] == b'\xff\xd8', img[:200]
(DATA / 'karnataka-modis.jpg').write_bytes(img)
(DATA / 'imagery-source.json').write_text(json.dumps(dict(sourceUrl=url,layer=layer,date='2025-01-15',bbox=[73,9,82,18],attribution='NASA GIBS / MODIS Terra'),indent=2))
print('NASA MODIS archived image ready:', len(img), 'bytes', flush=True)
