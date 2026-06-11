import pandas as pd
import numpy as np
from datetime import datetime, timedelta

def generate_mock_data(filename='supermarket_sales.csv', num_records=1000, num_customers=200):
    np.random.seed(42)
    customer_ids = [f'CUST_{str(i).zfill(4)}' for i in range(1, num_customers + 1)]
    
    end_date = datetime.now()
    start_date = end_date - timedelta(days=365)
    
    dates = [start_date + timedelta(days=np.random.randint(0, 365)) for _ in range(num_records)]
    
    # Generate transactions
    data = {
        'CustomerID': np.random.choice(customer_ids, num_records),
        'Date': dates,
        'Amount': np.round(np.random.uniform(5.0, 500.0, num_records), 2),
    }
    
    df = pd.DataFrame(data)
    df.to_csv(filename, index=False)
    print(f"Generated {filename} with {num_records} records.")

if __name__ == "__main__":
    generate_mock_data()
