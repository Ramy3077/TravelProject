from seed_cities import seed_cities
from seed_costs import seed_costs

if __name__ == "__main__":
    print("Starting Worker Seeding Process...")
    seed_cities()
    seed_costs()
    print("Worker Seeding Complete!")