"""
seed_costs.py

Seeds the cost_indices table by matching cities from the Kaggle 'cost-of-living_v2.csv'
to our cities table and computing derived cost metrics.

Mapping from CSV columns to our schema:
- x1  = Meal, Inexpensive Restaurant    -> Component for food_daily
- x2  = Meal for 2 People, Mid-range    -> Not directly used
- x28 = One-way Ticket (Local Transport)-> local_transit_daily (x2-3 trips)
- x48 = Apt 1BR City Centre (Monthly)   -> accommodation_mid (/ 30 = daily)
- x49 = Apt 1BR Outside Centre (Monthly)-> accommodation_low (/ 30)

Derived values:
- food_daily          = x1 * 3 (3 meals/day)
- local_transit_daily = x28 * 2.5 (round trips)
- accommodation_mid   = x48 / 30
- accommodation_low   = x49 / 30
"""
import os
import psycopg2
import psycopg2.extras
import pandas as pd
from dotenv import load_dotenv

load_dotenv('../.env')


def get_connection():
    host = os.getenv("DB_HOST", "localhost")
    if host == "db":
        host = "localhost"
    return psycopg2.connect(
        host=host,
        port=os.getenv("DB_PORT", "5432"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        dbname=os.getenv("DB_NAME")
    )


def seed_costs():
    print("Loading cost-of-living CSV...")
    df = pd.read_csv('data/cost-of-living_v2.csv')
    
    # Drop rows with missing key columns
    key_cols = ['city', 'country', 'x1', 'x28', 'x48', 'x49']
    df = df.dropna(subset=key_cols)
    print(f"Rows with complete data: {len(df)}")
    
    conn = get_connection()
    try:
        cur = conn.cursor()
        
        # Load all cities from DB for matching
        cur.execute("SELECT id, name, country FROM cities;")
        db_cities = cur.fetchall()
        
        # Build a lookup: (name_lower, country_lower) -> city_id
        city_lookup = {}
        for city_id, name, country in db_cities:
            key = (name.lower(), country.lower())
            city_lookup[key] = city_id
        
        print(f"Cities in DB: {len(db_cities)}")
        
        # Match and compute cost indices
        cost_data = []
        matched = 0
        for _, row in df.iterrows():
            key = (row['city'].strip().lower(), row['country'].strip().lower())
            city_id = city_lookup.get(key)
            
            if city_id:
                matched += 1
                food_daily = row['x1'] * 3
                transit_daily = row['x28'] * 2.5
                acc_mid = row['x48'] / 30
                acc_low = row['x49'] / 30
                
                cost_data.append((
                    city_id,
                    round(acc_low, 2),
                    round(acc_mid, 2),
                    round(food_daily, 2),
                    round(transit_daily, 2)
                ))
        
        print(f"Matched cities: {matched}")
        
        if cost_data:
            insert_query = """
                INSERT INTO cost_indices (city_id, accommodation_low, accommodation_mid, food_daily, local_transit_daily)
                VALUES %s
                ON CONFLICT (city_id) DO UPDATE SET
                    accommodation_low = EXCLUDED.accommodation_low,
                    accommodation_mid = EXCLUDED.accommodation_mid,
                    food_daily = EXCLUDED.food_daily,
                    local_transit_daily = EXCLUDED.local_transit_daily;
            """
            psycopg2.extras.execute_values(cur, insert_query, cost_data)
            conn.commit()
            print(f"Success! Inserted/updated {len(cost_data)} cost records.")
        else:
            print("No matches found. Check city name formats.")
        
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    seed_costs()
