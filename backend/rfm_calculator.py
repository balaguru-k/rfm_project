import pandas as pd
import datetime as dt

def calculate_rfm(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calculates RFM scores and segments customers.
    Expects df to have ['CustomerID', 'Date', 'Amount']
    """
    df['Date'] = pd.to_datetime(df['Date'])
    
    # Create a snapshot date (the day after the last transaction in the dataset)
    snapshot_date = df['Date'].max() + dt.timedelta(days=1)
    
    # Calculate R, F, M using named aggregation to avoid column conflicts
    rfm = df.groupby('CustomerID').agg(
        Recency=('Date', lambda x: (snapshot_date - x.max()).days),
        Frequency=('Amount', 'count'),
        Monetary=('Amount', 'sum')
    )
    
    # Create scores 1-5 (5 is best)
    # Recency: lower is better, so labels are reversed
    r_labels = range(5, 0, -1)
    # Frequency & Monetary: higher is better
    f_labels = range(1, 6)
    m_labels = range(1, 6)
    
    # We use qcut for quintiles. Use rank(method='first') to handle duplicate edges
    r_groups = pd.qcut(rfm['Recency'].rank(method='first'), q=5, labels=r_labels)
    f_groups = pd.qcut(rfm['Frequency'].rank(method='first'), q=5, labels=f_labels)
    m_groups = pd.qcut(rfm['Monetary'].rank(method='first'), q=5, labels=m_labels)
    
    # Create columns for R, F, and M
    rfm = rfm.assign(R=r_groups.values, F=f_groups.values, M=m_groups.values)
    
    # Convert R, F, M to int for reliable comparison
    rfm['R'] = rfm['R'].astype(int)
    rfm['F'] = rfm['F'].astype(int)
    rfm['M'] = rfm['M'].astype(int)
    
    # Create RFM Segment and Score
    rfm['RFM_Segment_Concat'] = rfm['R'].astype(str) + rfm['F'].astype(str) + rfm['M'].astype(str)
    rfm['RFM_Score'] = rfm['R'] + rfm['F'] + rfm['M']
    
    # Segmentation based on R and F scores
    def segment_customer(row):
        if row['R'] >= 4 and row['F'] >= 4:
            return 'Champions'
        elif row['R'] >= 3 and row['F'] >= 3:
            return 'Loyal Customers'
        elif row['R'] >= 3 and row['F'] <= 2:
            return 'Potential Loyalist'
        elif row['R'] == 5 and row['F'] == 1:
            return 'Recent Customers'
        elif row['R'] <= 2 and row['F'] >= 3:
            return 'At Risk'
        elif row['R'] <= 2 and row['F'] <= 2:
            return 'Hibernating'
        else:
            return 'Other'
            
    rfm['Segment'] = rfm.apply(segment_customer, axis=1)
    
    return rfm.reset_index()
