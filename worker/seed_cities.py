import os
import pandas as pd
import unicodedata
import sys
import math
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

def normalize_text(text):
    if not isinstance(text, str):
        return ""
    text = unicodedata.normalize('NFKD', text).encode('ASCII', 'ignore').decode('utf-8')
    return text.lower().strip()

def get_supabase_client():
    url = os.getenv("SUPABASE_API_URL")
    key = os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        print("Error: SUPABASE_API_URL or SUPABASE_ANON_KEY not set.")
        return None
    return create_client(url, key)

def seed_cities():
    print("Reading CSV data...")
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    cities_path = os.path.join(base_dir, 'data', 'worldcities.csv')
    # Read cities, forcing ID to string
    df_cities = pd.read_csv(cities_path, dtype={'id': str})
    
    airports_path = os.path.join(base_dir, 'data', 'airports.csv')
    try:
        df_airports = pd.read_csv(airports_path)
        df_airports = df_airports.dropna(subset=['city', 'city_code', 'country'])
        
        iata_lookup = {}
        for _, row in df_airports.iterrows():
            c_name = normalize_text(row['city'])
            c_iso2 = str(row['country']).strip().upper()
            key = (c_name, c_iso2)
            if key not in iata_lookup:
                iata_lookup[key] = row['city_code']
        print(f"IATA Lookup Size: {len(iata_lookup)}")
    except Exception as e:
        print(f"Warning skipping airports: {e}")
        iata_lookup = {}

    OVERRIDE_IATA = {
        ('london', 'GB'): 'LON',
        ('new york', 'US'): 'NYC',
        ('tokyo', 'JP'): 'TYO',
        ('paris', 'FR'): 'PAR',
        ('rome', 'IT'): 'ROM',
        ('moscow', 'RU'): 'MOW',
        ('beijing', 'CN'): 'BJS',
        ('bangkok', 'TH'): 'BKK',
        ('dubai', 'AE'): 'DXB',
        ('sao paulo', 'BR'): 'SAO',
        ('rio de janeiro', 'BR'): 'RIO',
    }

    cities_payload = []
    matched_count = 0
    used_iata_codes = set()
    
    print("Processing cities...")
    for index, row in df_cities.iterrows():
        id_val = str(row['id'])
        city_norm = normalize_text(row['city_ascii'])
        country_iso2 = str(row['iso2']).strip().upper()

        iata = OVERRIDE_IATA.get((city_norm, country_iso2))
        if not iata:
            iata = iata_lookup.get((city_norm, country_iso2))
        
        # Uniqueness check (greedy: first city gets code)
        if iata and iata in used_iata_codes:
            iata = None
        
        if iata:
            used_iata_codes.add(iata)
            matched_count += 1
            
        # Handle NaN for Lat/Lng
        lat = row['lat']
        lng = row['lng']
        if pd.isna(lat) or math.isnan(lat): lat = None
        if pd.isna(lng) or math.isnan(lng): lng = None
        
        cities_payload.append({
            "id": id_val,
            "name": row['city_ascii'] if pd.notna(row['city_ascii']) else row['city'],
            "country": row['country'], 
            "latitude": lat,
            "longitude": lng,
            "iata_code": iata
        })
        
    print(f"Prepared {len(cities_payload)} cities. Matches: {matched_count}.")
    
    supabase = get_supabase_client()
    if not supabase: return

    # --- Conflict Resolution ---
    print("Fetching DB IATA assignments...")
    params = {'select': 'id,iata_code', 'iata_code': 'neq.null'} 
    # Can't easily select !null without filter helper or loop.
    # Rest client: table.select(...).not_.is_('iata_code', 'null')
    
    existing_map = {} # Code -> ID
    
    # Paginating fetch
    start = 0
    chunk = 1000
    while True:
        res = supabase.table('cities').select('id,iata_code').not_.is_('iata_code', 'null').range(start, start+chunk-1).execute()
        rows = res.data
        for r in rows:
            existing_map[r['iata_code']] = r['id']
            
        if len(rows) < chunk:
            break
        start += chunk
        print(f"Fetched {len(existing_map)} existing assignments...")
        
    print(f"Total existing IATA assignments: {len(existing_map)}")
    
    ids_to_clear = set()
    for item in cities_payload:
        new_id = item['id']
        new_code = item['iata_code']
        if new_code:
            old_id = existing_map.get(new_code)
            if old_id and old_id != new_id:
                # Conflict found
                ids_to_clear.add(old_id)
                # print(f"Conflict: {new_code} on {old_id} -> wants {new_id}")

    if ids_to_clear:
        print(f"Clearing IATA for {len(ids_to_clear)} conflict cities...")
        clear_list = list(ids_to_clear)
        # Clear in batches
        for i in range(0, len(clear_list), 500):
            batch = clear_list[i:i+500]
            supabase.table('cities').update({'iata_code': None}).in_('id', batch).execute()
        print("Conflicts cleared.")

    # --- Upsert ---
    BATCH_SIZE = 1000
    total = len(cities_payload)
    print(f"Upserting {total} cities...")
    
    for i in range(0, total, BATCH_SIZE):
        batch = cities_payload[i : i + BATCH_SIZE]
        try:
            supabase.table('cities').upsert(batch).execute()
            sys.stdout.write(f"\rBatch {(i//BATCH_SIZE)+1}/{(total//BATCH_SIZE)+1}")
            sys.stdout.flush()
        except Exception as e:
            print(f"\nError batch {i}: {e}")
            
    print("\nDone.")

if __name__ == "__main__":
    seed_cities()
