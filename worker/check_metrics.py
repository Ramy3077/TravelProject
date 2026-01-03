import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

def check_metrics():
    url = os.getenv("SUPABASE_API_URL")
    key = os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        print("Error: SUPABASE keys missing.")
        return
        
    client = create_client(url, key)
    
    print("\n--- Supabase Database Metrics (via REST) ---")
    
    # 1. Total Cities
    res = client.table('cities').select('id', count='exact', head=True).execute()
    print(f"Total Cities: {res.count}")
    
    # 2. Cities with IATA
    # Fetch IDs to calculate intersection
    iata_ids = set()
    start = 0
    while True:
        res = client.table('cities').select('id').not_.is_('iata_code', 'null').neq('iata_code', '').range(start, start+999).execute()
        rows = res.data
        if not rows: break
        for r in rows: iata_ids.add(r['id'])
        if len(rows) < 1000: break
        start += 1000
        
    print(f"Cities with IATA: {len(iata_ids)}")
    
    # 3. Cities with Cost Data
    cost_ids = set()
    start = 0
    while True:
        res = client.table('cost_indices').select('city_id').range(start, start+999).execute()
        rows = res.data
        if not rows: break
        # cost_indices probably has 1 row per city_id, but key is city_id
        for r in rows: cost_ids.add(r['city_id'])
        if len(rows) < 1000: break
        start += 1000
        
    print(f"Cities with Cost Data: {len(cost_ids)}")
    
    # 4. Intersection
    ready = iata_ids.intersection(cost_ids)
    print(f"Cities with BOTH (Ready for App): {len(ready)}")

if __name__ == "__main__":
    check_metrics()
