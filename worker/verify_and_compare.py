import os
import psycopg2
import sys
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

def get_connection(dsn=None, is_local=True):
    if dsn:
        return psycopg2.connect(dsn)
    
    if is_local:
        # Defaults for local docker-compose setup
        return psycopg2.connect(
            host=os.getenv("DB_HOST", "localhost"),
            port=os.getenv("DB_PORT", "5432"),
            user=os.getenv("DB_USER", "travel"),
            password=os.getenv("DB_PASSWORD", "travel"),
            dbname=os.getenv("DB_NAME", "travel")
        )
    return None

def query_stats(conn, name):
    print(f"\n--- {name} Statistics ---")
    try:
        cur = conn.cursor()
        
        # 1. Count Cities
        cur.execute("SELECT count(*) FROM cities;")
        cities_count = cur.fetchone()[0]
        print(f"Total Cities: {cities_count}")
        
        # 2. Count Cost Indices
        cur.execute("SELECT count(*) FROM cost_indices;")
        costs_count = cur.fetchone()[0]
        print(f"Total Cost Indices: {costs_count}")
        
        # 3. Check specific problematic cities
        cities_to_check = ['Seoul', 'Paris', 'New York', 'Kinshasa', 'Yangon', 'Rangoon']
        print("\nSpot Checks (Cost Data Presence):")
        for city_name in cities_to_check:
            # Flexible matching for checking
            cur.execute("""
                SELECT c.name, c.country, ci.food_daily 
                FROM cities c
                LEFT JOIN cost_indices ci ON c.id = ci.city_id
                WHERE c.name ILIKE %s
                ORDER BY c.id ASC LIMIT 1;
            """, (city_name,))
            res = cur.fetchone()
            if res:
                c_name, c_country, food = res
                status = "✅ Has Cost Data" if food else "❌ No Cost Data"
                print(f"{c_name} ({c_country}): {status}")
            else:
                print(f"{city_name}: ❌ Not found in Cities table")
                
    except Exception as e:
        print(f"Error querying {name}: {e}")
    finally:
        conn.close()

def main():
    print("Connecting to Local DB...")
    try:
        local_conn = get_connection(is_local=True)
        query_stats(local_conn, "LOCAL DB")
    except Exception as e:
        print(f"Failed to connect to Local DB: {e}")

    print("\n------------------------------------------------")
    
    supabase_url = os.getenv("SUPABASE_URL")
    # Alternately verify via standard Libpq env vars if set
    supabase_host = os.getenv("SUPABASE_HOST") # e.g. aws-0-eu-central-1.pooler.supabase.com
    
    remote_conn = None
    if supabase_url:
        print(f"Connecting to Remote DB (URL found)...")
        try:
            remote_conn = get_connection(dsn=supabase_url)
        except Exception as e:
            print(f"Failed to connect to Remote DB: {e}")
    
    elif supabase_host:
         print(f"Connecting to Remote DB (Host found)...")
         try:
            remote_conn = psycopg2.connect(
                host=supabase_host,
                port=6543,
                user=os.getenv("SUPABASE_USER"), # postgres.ref
                password=os.getenv("SUPABASE_PASSWORD"),
                dbname="postgres"
            )
         except Exception as e:
            print(f"Failed to connect to Remote DB: {e}")
    else:
        print("Skipping Remote DB Check.")
        print("To run remote check, export SUPABASE_URL='postresql://user:pass@host:port/db'")
        print("Or set SUPABASE_HOST, SUPABASE_USER, SUPABASE_PASSWORD.")

    if remote_conn:
        query_stats(remote_conn, "REMOTE SUPABASE DB")

if __name__ == "__main__":
    main()
