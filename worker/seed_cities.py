import os
import psycopg2
import psycopg2.extras
import pandas as pd
from dotenv import load_dotenv

load_dotenv('../.env')

def get_connection():
    # Helper to resolve host (use localhost if running outside Docker)
    host = os.getenv("DB_HOST", "localhost")
    # if host == "db": ... removed incorrect override logic, trusting env var
        
    return psycopg2.connect(
        host=host,
        port=os.getenv("DB_PORT", "5432"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        dbname=os.getenv("DB_NAME")
    )

def seed_cities():
    print("Reading CSV data...")
    print("Reading World Cities data...")
    df_cities = pd.read_csv('data/worldcities.csv', dtype={'id': str})
    
    print("Reading Airports data for IATA codes...")
    # Load airports data to build a lookup map: (City Safe Name, Country Code) -> IATA City Code
    # Using 'city_code' from airports.csv which represents the city IATA code (e.g. LON for Heathrow)
    try:
        df_airports = pd.read_csv('data/airports.csv')
        # Filter out rows with missing city or city_code. Note: 'country' column holds ISO2 code in airports.csv
        df_airports = df_airports.dropna(subset=['city', 'city_code', 'country'])
    
        iata_lookup = {}
        for _, row in df_airports.iterrows():
            key = (str(row['city']).strip().lower(), str(row['country']).strip().upper())
            if key not in iata_lookup:
                iata_lookup[key] = row['city_code']
                
        print(f"Created IATA lookup with {len(iata_lookup)} entries.")
    except Exception as e:
        print(f"Warning: Could not load airports.csv: {e}")
        iata_lookup = {}

    # Cleaning/Filtering for our schema
    # We want: id, city_ascii (name), country, lat, lng, iata_code
    
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
    }

    # Prepare data list with IATA codes
    cities_data = []
    matched_count = 0
    used_iata_codes = set()
    
    for index, row in df_cities.iterrows():
        id_val = row['id']
        city_name = str(row['city_ascii']).strip().lower()
        country_iso2 = str(row['iso2']).strip().upper()


        iata = OVERRIDE_IATA.get((city_name, country_iso2))
        
        if not iata:
            iata = iata_lookup.get((city_name, country_iso2))
        
        if iata in used_iata_codes:
            iata = None
        
        if iata:
            used_iata_codes.add(iata)
            matched_count += 1
            
        cities_data.append([id_val, row['city_ascii'], row['country'], row['lat'], row['lng'], iata])
        
    print(f"Matched IATA codes for {matched_count} cities out of {len(cities_data)}.")
    
    conn = get_connection()
    try:
        cur = conn.cursor()
        

        print("Clearing existing IATA codes...")
        cur.execute("UPDATE cities SET iata_code = NULL;")
        conn.commit()
        
        insert_query = """
            INSERT INTO cities (id, name, country, latitude, longitude, iata_code)
            VALUES %s
            ON CONFLICT (id) DO UPDATE SET
                iata_code = EXCLUDED.iata_code;
        """
        
        print(f"Seeding {len(cities_data)} cities...")
        psycopg2.extras.execute_values(cur, insert_query, cities_data)
        
        conn.commit()
        print("Success! Cities seeded.")
        
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    seed_cities()