import os
import pandas as pd
import unicodedata
import sys
import math
from dotenv import load_dotenv
from supabase import create_client
from thefuzz import process, fuzz

load_dotenv()

def normalize_text(text):
    if not isinstance(text, str):
        return ""
    text = unicodedata.normalize('NFKD', text).encode('ASCII', 'ignore').decode('utf-8')
    return text.lower().strip()

def safe_float(val):
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    except:
        return None

def get_supabase_client():
    url = os.getenv("SUPABASE_API_URL")
    key = os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        print("Error: keys missing.")
        return None
    return create_client(url, key)

def seed_costs():
    supabase = get_supabase_client()
    if not supabase: return

    print("Fetching ALL cities from DB for matching...")
    # Map: normalized_country -> { normalized_city -> id }
    db_map = {} 
    
    start = 0
    chunk = 5000 
    LIMIT_PER_REQ = 1000
    
    total_fetched = 0
    while True:
        res = supabase.table('cities').select('id,name,country').range(start, start + LIMIT_PER_REQ - 1).execute()
        rows = res.data
        if not rows: break
        
        for r in rows:
            c_norm = normalize_text(r['country'])
            n_norm = normalize_text(r['name'])
            cid = r['id']
            
            if c_norm not in db_map:
                db_map[c_norm] = {}
            
            db_map[c_norm][n_norm] = cid
            
        total_fetched += len(rows)
        # Check against limit for loop break
        if len(rows) < LIMIT_PER_REQ:
            break
        start += LIMIT_PER_REQ
        sys.stdout.write(f"\rFetched {total_fetched} cities...")
        sys.stdout.flush()
        
    print(f"\nDB Cities Loaded. Countries found: {len(db_map)}")

    print("Loading Cost Data CSV...")
    base_dir = os.path.dirname(os.path.abspath(__file__))
    df = pd.read_csv(os.path.join(base_dir, 'data', 'cost-of-living_v2.csv'))
    
    cost_payload = []
    matched_count = 0
    fuzzy_matches = 0
    country_fuzzy_cache = {} 
    
    print("Matching cities...")
    row_count = 0
    total_rows = len(df)
    
    for _, row in df.iterrows():
        row_count += 1
        if row_count % 500 == 0:
            sys.stdout.write(f"\rProcessed {row_count}/{total_rows} CSV rows...")
            sys.stdout.flush()
            
        raw_city = row.get('city') or row.get('City')
        raw_country = row.get('country') or row.get('Country')
        
        if pd.isna(raw_city) or pd.isna(raw_country): continue
        
        target_country = normalize_text(str(raw_country))
        target_city = normalize_text(str(raw_city))
        
        # 1. Match Country
        candidate_cities = db_map.get(target_country)
        
        if not candidate_cities:
            # Fuzzy match country
            if target_country in country_fuzzy_cache:
                matched_country_key = country_fuzzy_cache[target_country]
            else:
                best, score = process.extractOne(target_country, list(db_map.keys()), scorer=fuzz.ratio)
                if score >= 85:
                    matched_country_key = best
                    country_fuzzy_cache[target_country] = best
                else:
                    matched_country_key = None
                    country_fuzzy_cache[target_country] = None
            
            if matched_country_key:
                candidate_cities = db_map[matched_country_key]
        
        if not candidate_cities:
            continue
            
        # 2. Match City
        city_id = candidate_cities.get(target_city)
        if not city_id:
            # Fuzzy match city
            best, score = process.extractOne(target_city, list(candidate_cities.keys()), scorer=fuzz.ratio)
            if score >= 85:
                city_id = candidate_cities[best]
                fuzzy_matches += 1
        
        if city_id:
            matched_count += 1
            try:
                x1 = safe_float(row.get('x1'))
                x28 = safe_float(row.get('x28'))
                x48 = safe_float(row.get('x48'))
                x49 = safe_float(row.get('x49'))
                
                food_daily = None
                if x1 is not None: food_daily = round(x1 * 3, 2)
                    
                transit_daily = None
                if x28 is not None: transit_daily = round(x28 * 2.5, 2)
                    
                acc_mid = None
                if x48 is not None: acc_mid = round(x48 / 30, 2)
                    
                acc_low = None
                if x49 is not None: acc_low = round(x49 / 30, 2)
                
                if all(v is None for v in [food_daily, transit_daily, acc_mid, acc_low]):
                    continue
                
                cost_payload.append({
                    "city_id": city_id,
                    "food_daily": food_daily,
                    "local_transit_daily": transit_daily,
                    "accommodation_mid": acc_mid,
                    "accommodation_low": acc_low
                })
            except Exception as e:
                pass

    print(f"\nFinal Match Result: {matched_count} / {total_rows} cost rows matched.")
    print(f"  Direct Matches: {matched_count - fuzzy_matches}")
    print(f"  Fuzzy Matches: {fuzzy_matches}")
    
    # Upsert
    if cost_payload:
        BATCH_SIZE = 1000
        total_batches = (len(cost_payload) + BATCH_SIZE - 1) // BATCH_SIZE
        print(f"Upserting {len(cost_payload)} cost records...")
        
        for i in range(0, len(cost_payload), BATCH_SIZE):
            batch = cost_payload[i : i + BATCH_SIZE]
            try:
                supabase.table('cost_indices').upsert(batch).execute()
                sys.stdout.write(f"\rBatch {i//BATCH_SIZE + 1}/{total_batches}")
                sys.stdout.flush()
            except Exception as e:
                print(f"\nError batch {i}: {e}")
                
        print("\nCost seeding complete.")

if __name__ == "__main__":
    seed_costs()
