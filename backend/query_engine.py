"""
Data Query Engine — runs pandas queries server-side so the LLM only
receives a small, pre-computed result instead of the full dataset.
"""
import re
import pandas as pd


def query_data(question: str, rfm_df: pd.DataFrame) -> str:
    """
    Analyses the user question, runs the appropriate pandas query,
    and returns a compact text summary the LLM can rephrase.
    All logic is driven entirely by the live rfm_df passed in —
    no hard-coded data anywhere.
    """
    q   = question.lower().strip()
    df  = rfm_df.copy()

    # Normalise column types (guard against strings from JSON round-trips)
    for col in ['Recency', 'Frequency', 'Monetary', 'RFM_Score', 'R', 'F', 'M']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

    # ── helpers ──────────────────────────────────────────────────────────

    def _fmt_row(r):
        return (
            f"  {r['CustomerID']} — "
            f"Recency:{int(r['Recency'])}d, "
            f"Frequency:{int(r['Frequency'])}, "
            f"Monetary:${r['Monetary']:.2f}, "
            f"Score:{int(r['RFM_Score'])}, "
            f"Segment:{r['Segment']}"
        )

    def _top_n(col: str, ascending: bool, n: int, segment_filter=None):
        subset = df if segment_filter is None else df[df['Segment'].str.lower() == segment_filter.lower()]
        if subset.empty:
            return f"No customers found{(' in segment ' + segment_filter) if segment_filter else ''}."
        top = subset.sort_values(col, ascending=ascending).head(n)
        label = "Bottom" if ascending else "Top"
        lines = [f"{label} {len(top)} customers by {col} (from {len(subset)} total):"]
        lines += [_fmt_row(r) for _, r in top.iterrows()]
        return "\n".join(lines)

    def _segment_customers(segment_name: str, n: int):
        # Try exact match first, then case-insensitive contains
        exact   = df[df['Segment'].str.lower() == segment_name.lower()]
        partial = df[df['Segment'].str.lower().str.contains(segment_name.lower(), na=False)]
        matches = exact if not exact.empty else partial
        if matches.empty:
            # List available segments so the LLM can inform the user
            available = df['Segment'].unique().tolist()
            return f"No customers found for segment '{segment_name}'. Available segments: {available}"
        top   = matches.sort_values('RFM_Score', ascending=False).head(n)
        seg_n = matches['Segment'].iloc[0]          # use real capitalisation from data
        lines = [f"Top {len(top)} '{seg_n}' customers (total in segment: {len(matches)}):"]
        lines += [_fmt_row(r) for _, r in top.iterrows()]
        return "\n".join(lines)

    def _segment_summary():
        seg = df.groupby('Segment').agg(
            Count        =('CustomerID', 'count'),
            Avg_Recency  =('Recency',    'mean'),
            Avg_Frequency=('Frequency',  'mean'),
            Avg_Monetary =('Monetary',   'mean'),
            Avg_Score    =('RFM_Score',  'mean'),
            Total_Revenue=('Monetary',   'sum'),
        ).round(2).reset_index()

        lines = [f"Segment Summary ({len(df)} total customers, ${df['Monetary'].sum():.2f} total revenue):"]
        for _, row in seg.iterrows():
            lines.append(
                f"  {row['Segment']}: {int(row['Count'])} customers, "
                f"Avg Recency:{row['Avg_Recency']:.0f}d, "
                f"Avg Frequency:{row['Avg_Frequency']:.1f}, "
                f"Avg Monetary:${row['Avg_Monetary']:.2f}, "
                f"Total Revenue:${row['Total_Revenue']:.2f}, "
                f"Avg Score:{row['Avg_Score']:.1f}"
            )
        return "\n".join(lines)

    def _overall_stats():
        return (
            f"Dataset Overview:\n"
            f"  Total Customers : {len(df)}\n"
            f"  Total Revenue   : ${df['Monetary'].sum():.2f}\n"
            f"  Avg Recency     : {df['Recency'].mean():.0f} days\n"
            f"  Avg Frequency   : {df['Frequency'].mean():.1f}\n"
            f"  Avg Monetary    : ${df['Monetary'].mean():.2f}\n"
            f"  Avg RFM Score   : {df['RFM_Score'].mean():.1f}\n"
            f"  Segments        : { dict(df['Segment'].value_counts()) }"
        )

    def _customer_lookup(cust_id: str):
        # Try string match on CustomerID column (works for numeric IDs too)
        mask  = df['CustomerID'].astype(str).str.lower() == cust_id.lower()
        match = df[mask]
        if match.empty:
            return f"Customer '{cust_id}' not found. Available IDs (sample): {df['CustomerID'].head(5).tolist()}"
        r = match.iloc[0]
        return (
            f"Customer {r['CustomerID']}:\n"
            f"  Recency   : {int(r['Recency'])} days\n"
            f"  Frequency : {int(r['Frequency'])}\n"
            f"  Monetary  : ${r['Monetary']:.2f}\n"
            f"  RFM Score : {int(r['RFM_Score'])}\n"
            f"  Segment   : {r['Segment']}"
        )

    # ── extract requested number (default 10) ───────────────────────────
    num_match = re.search(r'\b(\d{1,3})\b', q)
    n = int(num_match.group(1)) if num_match else 10

    # ── detect a specific customer ID ───────────────────────────────────
    # Match any word that looks like an ID in the question
    cust_match = re.search(r'\b([A-Za-z0-9_-]{2,10})\b', q)
    if cust_match:
        candidate = cust_match.group(1)
        mask = df['CustomerID'].astype(str).str.lower() == candidate.lower()
        if mask.any():
            return _customer_lookup(candidate)

    # ── detect segment name from the LIVE dataset ────────────────────────
    live_segments = df['Segment'].unique().tolist()  # whatever segments are in THIS dataset
    detected_segment = None
    for seg in live_segments:
        if seg.lower() in q:
            detected_segment = seg
            break

    # ── route to the right query ─────────────────────────────────────────

    # Revenue / Monetary ranking
    if any(w in q for w in ['revenue', 'spending', 'spent', 'monetary', 'paid', 'amount']):
        if any(w in q for w in ['top', 'highest', 'most', 'best', 'loyal', 'vip']):
            return _top_n('Monetary', ascending=False, n=n, segment_filter=detected_segment)
        if any(w in q for w in ['lowest', 'bottom', 'least', 'worst']):
            return _top_n('Monetary', ascending=True,  n=n, segment_filter=detected_segment)

    # Frequency ranking
    if any(w in q for w in ['frequent', 'frequency', 'often', 'visit', 'purchase', 'transaction']):
        if any(w in q for w in ['top', 'highest', 'most', 'best']):
            return _top_n('Frequency', ascending=False, n=n, segment_filter=detected_segment)
        if any(w in q for w in ['lowest', 'bottom', 'least', 'worst']):
            return _top_n('Frequency', ascending=True,  n=n, segment_filter=detected_segment)

    # Recency ranking
    if any(w in q for w in ['recent', 'recency', 'latest', 'last', 'new', 'active']):
        if any(w in q for w in ['top', 'most', 'best', 'newest']):
            return _top_n('Recency', ascending=True,  n=n, segment_filter=detected_segment)
        if any(w in q for w in ['oldest', 'inactive', 'least', 'worst', 'dormant']):
            return _top_n('Recency', ascending=False, n=n, segment_filter=detected_segment)

    # Top / Best / Loyal / VIP (general) → sort by RFM_Score
    if any(w in q for w in ['top', 'best', 'loyal', 'vip', 'highest', 'most valuable', 'elite']):
        return _top_n('RFM_Score', ascending=False, n=n, segment_filter=detected_segment)

    # Bottom / Worst
    if any(w in q for w in ['worst', 'bottom', 'lowest', 'least', 'inactive', 'lost', 'weak']):
        return _top_n('RFM_Score', ascending=True, n=n, segment_filter=detected_segment)

    # Specific segment queries
    if any(w in q for w in ['at risk', 'risk', 'churn', 'leaving', 'losing']):
        return _segment_customers('At Risk', n=n)

    if 'hibernat' in q or 'dormant' in q or 'lapsed' in q:
        return _segment_customers('Hibernating', n=n)

    if 'champion' in q:
        return _segment_customers('Champions', n=n)

    if 'potential' in q or 'loyalist' in q:
        return _segment_customers('Potential Loyalist', n=n)

    if detected_segment:
        return _segment_customers(detected_segment, n=n)

    # Summary / overview queries
    if any(w in q for w in ['segment', 'overview', 'summary', 'breakdown', 'distribution', 'all segment']):
        return _segment_summary()

    if any(w in q for w in ['how many', 'total', 'count', 'stats', 'statistics', 'dataset', 'data']):
        return _overall_stats()

    # Marketing / strategy questions — give full context to the LLM
    if any(w in q for w in ['strateg', 'market', 'campaign', 'recommend', 'suggest', 'improve', 'retention', 'win back']):
        return _overall_stats() + "\n\n" + _segment_summary()

    # Fallback: return both overview + segment summary
    return _overall_stats() + "\n\n" + _segment_summary()
