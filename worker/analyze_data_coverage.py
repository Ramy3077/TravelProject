import pandas as pd
import os

def load_data():
    base_dir = 'worker/data'
    wc = pd.read_csv(os.path.join(base_dir, 'worldcities.csv'))
    col = pd.read_csv(os.path.join(base_dir, 'cost-of-living_v2.csv'))
    # Load airports with low_memory=False to avoid warnings mixed types
    air = pd.read_csv(os.path.join(base_dir, 'airports.csv'), low_memory=False)
    return wc, col, air

def analyze():
    print("Loading datasets...")
    wc, col, air = load_data()
    
    print(f"Loaded: WorldCities({len(wc)}), CostOfLiving({len(col)}), Airports({len(air)})")

    # 1. Prepare World Cities (Base)
    # Normalize
    wc['city_norm'] = wc['city'].astype(str).str.lower().str.strip()
    wc['country_norm'] = wc['country'].astype(str).str.lower().str.strip()
    total_cities = len(wc)
    
    # 2. Prepare Cost of Living
    col['city_norm'] = col['city'].astype(str).str.lower().str.strip()
    col['country_norm'] = col['country'].astype(str).str.lower().str.strip()
    
    # Deduplicate cost data (take first)
    col_unique = col.drop_duplicates(subset=['city_norm', 'country_norm'])
    
    # 3. Prepare Airports (IATA source)
    # Airports uses ISO2 country codes (e.g. 'AU', 'US')
    air['city_norm'] = air['city'].astype(str).str.lower().str.strip()
    air['country_iso2'] = air['country'].astype(str).str.lower().str.strip()
    
    # Filter for valid city_code (IATA)
    air_valid = air[air['city_code'].notna() & (air['city_code'].str.len() == 3)].copy()
    
    # We need to map Airport ISO2 to WorldCities ISO2
    # Ensure WorldCities has normalized ISO2
    wc['iso2_norm'] = wc['iso2'].astype(str).str.lower().str.strip()
    
    air_unique = air_valid.drop_duplicates(subset=['city_norm', 'country_iso2'])
    
    # Merge
    # WC + COL (Join on Name + Full Country Name)
    merged_col = pd.merge(wc, col_unique, on=['city_norm', 'country_norm'], how='inner')
    
    # WC + Air (Join on Name + ISO2)
    # Note: left_on matches right_on
    merged_iata = pd.merge(wc, air_unique, 
                          left_on=['city_norm', 'iso2_norm'], 
                          right_on=['city_norm', 'country_iso2'], 
                          how='inner')
    
    # WC + COL + Air (Intersection)
    # Start with Cost Data matches, then add Air matches
    merged_all = pd.merge(merged_col, air_unique,
                         left_on=['city_norm', 'iso2_norm'],
                         right_on=['city_norm', 'country_iso2'],
                         how='inner')
    
    print("\n--- Estimated Database Coverage (Based on Source CSVs) ---")
    print(f"Total Base Cities: {total_cities}")
    print(f"Cities with Cost Data: {len(merged_col)} ({len(merged_col)/total_cities*100:.1f}%)")
    print(f"Cities with IATA Code: {len(merged_iata)} ({len(merged_iata)/total_cities*100:.1f}%)")
    print(f"Cities with BOTH (Ready for App): {len(merged_all)}")
    
    if len(merged_all) > 0:
        print("\nSample coverage matches:")
        # Show Name, Country, IATA (city_code), Cost (x1 price as proxy)
        print(merged_all[['city', 'country', 'city_code', 'x1']].head(10).to_string(index=False))

if __name__ == "__main__":
    analyze()
