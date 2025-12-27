import os
import psycopg2
import psycopg2.extras
import pandas as pd
from dotenv import load_dotenv

# 1. Load environment variables from the root .env
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
    # 3. Step 3: Data Loading with Pandas
    df = pd.read_csv('data/worldcities.csv')
    
    # Cleaning/Filtering for our schema
    # We want: id, city_ascii (name), country, lat, lng
    cities_data = df[['id', 'city_ascii', 'country', 'lat', 'lng']].values.tolist()
    
    conn = get_connection()
    try:
        cur = conn.cursor()
        
        # 4. Bulk Insertion
        insert_query = """
            INSERT INTO cities (id, name, country, latitude, longitude)
            VALUES %s
            ON CONFLICT (id) DO NOTHING;
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