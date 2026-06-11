from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import io
import requests

from rfm_calculator import calculate_rfm
from query_engine import query_data

app = FastAPI(title="RFM Calculator & Sales Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory store ────────────────────────────────────────────────────────
rfm_store:      pd.DataFrame | None = None   # RFM-computed table
raw_store:      pd.DataFrame | None = None   # Cleaned transaction table
dataset_profile: dict | None = None          # Pre-computed dashboard profile


# ── Models ─────────────────────────────────────────────────────────────────
class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: list[Message] = []


# ── Dataset profiler ───────────────────────────────────────────────────────
def build_profile(df_clean: pd.DataFrame, rfm_df: pd.DataFrame) -> dict:
    """
    Converts the raw cleaned transactions + computed RFM table into a
    rich, serialisable profile that drives the entire dynamic dashboard.
    Nothing in here is hard-coded — it all flows from the actual data.
    """
    # ── Transaction-level stats ──────────────────────────────────────
    date_series = pd.to_datetime(df_clean['Date'], errors='coerce')
    profile = {
        "total_records":       int(len(df_clean)),
        "unique_customers":    int(df_clean['CustomerID'].nunique()),
        "total_revenue":       float(df_clean['Amount'].sum()),
        "avg_order_value":     float(df_clean['Amount'].mean()),
        "date_range": {
            "min": str(date_series.min().date()) if date_series.notna().any() else "N/A",
            "max": str(date_series.max().date()) if date_series.notna().any() else "N/A",
        },
    }

    # ── RFM-level stats ──────────────────────────────────────────────
    seg_counts   = rfm_df['Segment'].value_counts().to_dict()
    seg_revenue  = rfm_df.groupby('Segment')['Monetary'].sum().round(2).to_dict()
    seg_freq     = rfm_df.groupby('Segment')['Frequency'].mean().round(1).to_dict()
    seg_recency  = rfm_df.groupby('Segment')['Recency'].mean().round(0).to_dict()
    seg_score    = rfm_df.groupby('Segment')['RFM_Score'].mean().round(1).to_dict()

    profile["rfm"] = {
        "total_customers": int(len(rfm_df)),
        "avg_recency":     float(rfm_df['Recency'].mean()),
        "avg_frequency":   float(rfm_df['Frequency'].mean()),
        "avg_monetary":    float(rfm_df['Monetary'].mean()),
        "avg_rfm_score":   float(rfm_df['RFM_Score'].mean()),
        "segment_counts":  {k: int(v) for k, v in seg_counts.items()},
        "segment_revenue": {k: float(v) for k, v in seg_revenue.items()},
        "segment_avg_frequency": {k: float(v) for k, v in seg_freq.items()},
        "segment_avg_recency":   {k: float(v) for k, v in seg_recency.items()},
        "segment_avg_score":     {k: float(v) for k, v in seg_score.items()},
    }

    # ── Top customers (for quick KPI cards) ──────────────────────────
    top5 = rfm_df.sort_values('RFM_Score', ascending=False).head(5)
    profile["top_customers"] = top5[['CustomerID', 'Recency', 'Frequency',
                                      'Monetary', 'RFM_Score', 'Segment']].to_dict(orient='records')

    return profile


def profile_to_text(profile: dict) -> str:
    """Convert the profile into a compact text block the LLM can consume."""
    p   = profile
    rfm = p.get("rfm", {})
    lines = [
        f"=== DATASET PROFILE ===",
        f"Total Transactions : {p['total_records']}",
        f"Unique Customers   : {p['unique_customers']}",
        f"Date Range         : {p['date_range']['min']} → {p['date_range']['max']}",
        f"Total Revenue      : ${p['total_revenue']:.2f}",
        f"Avg Order Value    : ${p['avg_order_value']:.2f}",
        f"",
        f"--- RFM Summary ---",
        f"Customers Analysed : {rfm.get('total_customers', 0)}",
        f"Avg Recency        : {rfm.get('avg_recency', 0):.0f} days",
        f"Avg Frequency      : {rfm.get('avg_frequency', 0):.1f} purchases",
        f"Avg Monetary       : ${rfm.get('avg_monetary', 0):.2f}",
        f"Avg RFM Score      : {rfm.get('avg_rfm_score', 0):.1f} / 15",
        f"",
        f"--- Segments ---",
    ]
    for seg, count in rfm.get("segment_counts", {}).items():
        rev = rfm.get("segment_revenue", {}).get(seg, 0)
        score = rfm.get("segment_avg_score", {}).get(seg, 0)
        lines.append(f"  {seg}: {count} customers, ${rev:.2f} revenue, avg score {score:.1f}")
    return "\n".join(lines)


# ── Upload endpoint ────────────────────────────────────────────────────────
@app.post("/api/upload")
async def upload_csv(file: UploadFile = File(...)):
    global rfm_store, raw_store, dataset_profile

    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = await file.read()
    try:
        # Step 1 — decode with multi-encoding fallback
        df = None
        for encoding in ('utf-8-sig', 'utf-8', 'latin-1', 'cp1252', 'iso-8859-1'):
            try:
                df = pd.read_csv(io.StringIO(content.decode(encoding)))
                break
            except (UnicodeDecodeError, ValueError):
                continue
        if df is None:
            raise HTTPException(status_code=400, detail="Could not decode CSV. Save as UTF-8 and retry.")

        df.columns = df.columns.str.strip()
        cols_lower = {c.lower(): c for c in df.columns}

        # Step 2 — CustomerID
        customer_candidates = [
            'customerid', 'customer_id', 'custid', 'cust_id', 'client_id',
            'clientid', 'memberid', 'member_id', 'userid', 'user_id',
            'accountid', 'account_id', 'id'
        ]
        customer_col = next((cols_lower[c] for c in customer_candidates if c in cols_lower), None)
        if not customer_col:
            raise HTTPException(status_code=400, detail=f"Cannot find CustomerID column. Found: {list(df.columns)}")
        if customer_col != 'CustomerID':
            df = df.rename(columns={customer_col: 'CustomerID'})
        df = df[df['CustomerID'].notna()]
        df['CustomerID'] = df['CustomerID'].astype(str).str.strip()
        # Remove obvious non-customer rows like headers or "nan"
        df = df[~df['CustomerID'].str.lower().isin(['nan', 'customerid', 'customer_id', 'id'])]

        # Step 3 — Date
        date_candidates = [
            'invoicedate', 'date', 'purchasedate', 'transactiondate', 'orderdate',
            'saledate', 'sale_date', 'order_date', 'transaction_date', 'purchase_date',
            'datetime', 'timestamp', 'created_at', 'createdat', 'time', 'invoice_date'
        ]
        date_col = next((cols_lower[c] for c in date_candidates if c in cols_lower), None)
        if date_col is None:
            # Auto-sniff: find first column whose values look like dates
            for col in df.columns:
                try:
                    parsed = pd.to_datetime(df[col].dropna().head(20), infer_datetime_format=True)
                    if len(parsed) > 5:
                        date_col = col
                        break
                except Exception:
                    continue
        if not date_col:
            raise HTTPException(status_code=400, detail=f"Cannot find a Date column. Found: {list(df.columns)}")
        if date_col != 'Date':
            df = df.rename(columns={date_col: 'Date'})

        # Step 4 — Amount (direct or computed)
        amount_candidates = [
            'amount', 'totalamount', 'total_amount', 'transactionamount', 'transaction_amount',
            'orderamount', 'order_amount', 'sales', 'revenue', 'total', 'grandtotal',
            'grand_total', 'subtotal', 'sub_total', 'value', 'totalvalue', 'total_value',
            'spend', 'spending', 'purchaseamount', 'purchase_amount', 'lineamount', 'linetotal'
        ]
        amount_col = next((cols_lower[c] for c in amount_candidates if c in cols_lower), None)

        if amount_col:
            if amount_col != 'Amount':
                df = df.rename(columns={amount_col: 'Amount'})
        else:
            qty_candidates   = ['quantity', 'qty', 'units', 'count', 'items', 'numberofitems', 'ordered_qty']
            price_candidates = ['unitprice', 'unit_price', 'price', 'rate', 'costprice',
                                'cost_price', 'saleprice', 'sale_price', 'sellingprice', 'listprice']
            qty_col   = next((cols_lower[c] for c in qty_candidates   if c in cols_lower), None)
            price_col = next((cols_lower[c] for c in price_candidates if c in cols_lower), None)
            if qty_col and price_col:
                df['Amount'] = (pd.to_numeric(df[qty_col],   errors='coerce').fillna(0) *
                                pd.to_numeric(df[price_col], errors='coerce').fillna(0))
                df = df[df['Amount'] > 0]
            else:
                raise HTTPException(status_code=400, detail=(
                    f"Cannot find or compute an Amount column. Found: {list(df.columns)}. "
                    f"Provide Amount/Total/Sales, or both Quantity+Price columns."
                ))

        # Step 5 — Final clean-up
        df['Amount'] = pd.to_numeric(df['Amount'], errors='coerce')
        df = df[df['Amount'].notna() & (df['Amount'] > 0)]
        if len(df) == 0:
            raise HTTPException(status_code=400, detail="No valid transaction rows found after cleaning.")

        # Step 6 — Compute RFM
        rfm_results  = calculate_rfm(df[['CustomerID', 'Date', 'Amount']])
        profile      = build_profile(df[['CustomerID', 'Date', 'Amount']], rfm_results)

        # Persist in memory
        rfm_store       = rfm_results
        raw_store       = df[['CustomerID', 'Date', 'Amount']].copy()
        dataset_profile = profile

        return {
            "customers": rfm_results.to_dict(orient='records'),
            "profile":   profile,
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


# ── Chat endpoint ──────────────────────────────────────────────────────────
@app.post("/api/chat")
async def chat_with_agent(request: ChatRequest):
    global rfm_store, dataset_profile

    if rfm_store is None or dataset_profile is None:
        raise HTTPException(status_code=400, detail="No data uploaded yet. Please upload a CSV file first.")

    # Step 1 — Run pandas query for precise facts
    data_result = query_data(request.message, rfm_store)

    # Step 2 — Build system prompt from the LIVE profile
    dataset_context = profile_to_text(dataset_profile)
    system_prompt = f"""You are a professional retail sales analyst AI assistant.

{dataset_context}

You are given a PRE-COMPUTED data analysis result that directly answers the user's question.
Your task is to present this result in a clear, well-formatted response.

CRITICAL RULES:
1. Only use the numbers from the Data Analysis Result below. Do NOT invent any figures.
2. If a list of customers is provided, list ALL of them without truncating.
3. Use bullet points, numbered lists, and bold headings to make the answer readable.
4. Keep responses concise but complete.
5. Always ground your answers in the actual dataset described above."""

    messages = [{"role": "system", "content": system_prompt}]
    for msg in request.history:
        messages.append({"role": msg.role, "content": msg.content})

    current_prompt = (
        f"Data Analysis Result:\n{data_result}\n\n"
        f"Please answer the user's question based ONLY on the above result.\n\n"
        f"User Question: {request.message}"
    )
    messages.append({"role": "user", "content": current_prompt})

    try:
        response = requests.post(
            "http://localhost:11434/api/chat",
            json={
                "model": "phi4-mini",
                "messages": messages,
                "stream": False,
                "options": {"temperature": 0.2, "num_predict": 1500},
            },
            timeout=120,
        )
        response.raise_for_status()
        data = response.json()
        return {"response": data.get("message", {}).get("content", "")}
    except requests.exceptions.Timeout:
        return {"response": f"*(AI timeout — showing raw analysis)*\n\n{data_result}"}
    except requests.exceptions.ConnectionError as e:
        raise HTTPException(status_code=503, detail="Cannot connect to Ollama. Make sure Ollama is running (ollama serve).")
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=503, detail=f"Ollama error: {str(e)}")
