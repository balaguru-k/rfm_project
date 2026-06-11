import React, { useMemo, useState, useEffect } from 'react';
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement, Title, PointElement, LineElement,
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Users, Crown, AlertTriangle, TrendingUp,
  ArrowUpRight, ArrowDownRight, DollarSign, Clock, Repeat, Star,
} from 'lucide-react';

ChartJS.register(
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement, Title,
  PointElement, LineElement
);

// ── Segment colour palette ─────────────────────────────────────────────────
const PALETTE = [
  { bg: '#dcfce7', text: '#15803d', dot: '#22c55e' },
  { bg: '#dbeafe', text: '#1d4ed8', dot: '#3b82f6' },
  { bg: '#ede9fe', text: '#6d28d9', dot: '#8b5cf6' },
  { bg: '#fef9c3', text: '#854d0e', dot: '#eab308' },
  { bg: '#fee2e2', text: '#dc2626', dot: '#ef4444' },
  { bg: '#f3f4f6', text: '#374151', dot: '#6b7280' },
  { bg: '#f0fdf4', text: '#166534', dot: '#4ade80' },
  { bg: '#fdf4ff', text: '#86198f', dot: '#d946ef' },
];

// Map well-known segment names to a consistent colour
const KNOWN_SEG_COLORS = {
  'Champions':          PALETTE[0],
  'Loyal Customers':    PALETTE[1],
  'Potential Loyalist': PALETTE[2],
  'Recent Customers':   PALETTE[3],
  'At Risk':            PALETTE[4],
  'Hibernating':        PALETTE[5],
  'Other':              PALETTE[6],
};

function getSegColor(segName, idx) {
  return KNOWN_SEG_COLORS[segName] ?? PALETTE[idx % PALETTE.length];
}

// ── Dashboard ──────────────────────────────────────────────────────────────
export default function Dashboard({ data, profile }) {
  const [scopeFilter,   setScopeFilter]   = useState('All');
  const [segmentFilter, setSegmentFilter] = useState('All');

  // Reset filters whenever a new dataset comes in
  useEffect(() => {
    setScopeFilter('All');
    setSegmentFilter('All');
  }, [data]);

  // ── Derived values from profile ──────────────────────────────────
  const rfm = profile?.rfm ?? {};
  const segCounts   = rfm.segment_counts   ?? {};
  const segRevenue  = rfm.segment_revenue  ?? {};
  const segScore    = rfm.segment_avg_score ?? {};
  const segFreq     = rfm.segment_avg_frequency ?? {};
  const segRecency  = rfm.segment_avg_recency ?? {};
  const segments    = Object.keys(segCounts);
  const segColors   = segments.map((s, i) => getSegColor(s, i));

  // ── Filtered customer table ──────────────────────────────────────
  const displayCustomers = useMemo(() => {
    if (!data) return [];
    let filtered = segmentFilter === 'All'
      ? data
      : data.filter(r => r.Segment === segmentFilter);
    if (scopeFilter === 'Top10') {
      filtered = [...filtered].sort((a, b) => Number(b.RFM_Score) - Number(a.RFM_Score)).slice(0, 10);
    }
    return filtered;
  }, [data, segmentFilter, scopeFilter]);

  // Guard
  if (!profile || !data) {
    return <div style={{ padding: 40, color: '#9ca3af' }}>Loading dashboard…</div>;
  }

  // ── KPI Cards config (fully from profile) ────────────────────────
  const totalRevenue    = profile.total_revenue    ?? 0;
  const totalCustomers  = rfm.total_customers      ?? data.length;
  const avgOrderValue   = profile.avg_order_value  ?? 0;
  const avgRfmScore     = rfm.avg_rfm_score        ?? 0;
  const totalRecords    = profile.total_records    ?? 0;

  // Find best and worst segments by count
  const bestSeg  = segments.reduce((a, b) => (segCounts[a] ?? 0) >= (segCounts[b] ?? 0) ? a : b, segments[0] ?? '—');
  const atRisk   = segCounts['At Risk'] ?? 0;

  // ── Doughnut chart ────────────────────────────────────────────────
  const doughnutData = {
    labels: segments,
    datasets: [{
      data: segments.map(s => segCounts[s]),
      backgroundColor: segColors.map(c => c.dot),
      borderWidth: 0,
      hoverOffset: 8,
    }],
  };
  const doughnutOptions = {
    cutout: '70%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a1a2e',
        titleFont: { family: 'Inter', size: 12, weight: '600' },
        bodyFont:  { family: 'Inter', size: 11 },
        cornerRadius: 8, padding: 10,
      },
    },
    maintainAspectRatio: false,
  };

  // ── Revenue bar chart ──────────────────────────────────────────────
  const barData = {
    labels: segments,
    datasets: [{
      label: 'Revenue ($)',
      data: segments.map(s => segRevenue[s] ?? 0),
      backgroundColor: segColors.map(c => c.dot + '33'),
      borderColor:     segColors.map(c => c.dot),
      borderWidth: 1.5,
      borderRadius: 8,
      barPercentage: 0.6,
    }],
  };
  const barOptions = {
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 10 } } },
      y: {
        grid: { color: '#f0f0f5' },
        ticks: {
          font: { family: 'Inter', size: 10 },
          callback: v => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`,
        },
      },
    },
    maintainAspectRatio: false,
  };

  // ── Avg Score horizontal bar ───────────────────────────────────────
  const scoreBarData = {
    labels: segments,
    datasets: [{
      label: 'Avg RFM Score',
      data: segments.map(s => segScore[s] ?? 0),
      backgroundColor: segColors.map(c => c.dot + 'bb'),
      borderColor:     segColors.map(c => c.dot),
      borderWidth: 1,
      borderRadius: 6,
      barPercentage: 0.55,
    }],
  };
  const scoreBarOptions = {
    indexAxis: 'y',
    plugins: { legend: { display: false } },
    scales: {
      x: {
        max: 15,
        grid: { color: '#f0f0f5' },
        ticks: { font: { family: 'Inter', size: 10 } },
      },
      y: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 10 } } },
    },
    maintainAspectRatio: false,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 32 }}>

      {/* ── Dataset Overview Strip ─────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
        borderRadius: 16, padding: '16px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ color: 'white' }}>
          <div style={{ fontSize: 13, color: '#a5b4fc', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Dataset Overview
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>
            {totalCustomers.toLocaleString()} Customers · {totalRecords.toLocaleString()} Transactions
          </div>
        </div>
        <div style={{ display: 'flex', gap: 32 }}>
          <StatChip label="Date Range" value={`${profile.date_range?.min ?? '—'} → ${profile.date_range?.max ?? '—'}`} />
          <StatChip label="Total Revenue" value={`$${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
          <StatChip label="Avg Order Value" value={`$${avgOrderValue.toFixed(2)}`} />
          <StatChip label="Avg RFM Score" value={`${avgRfmScore.toFixed(1)} / 15`} />
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        <MetricCard
          icon={<Users size={18}/>} iconBg="#eef2ff" iconColor="#6366f1"
          label="Total Customers" value={totalCustomers.toLocaleString()}
          badge={<><ArrowUpRight size={12}/> {segments.length} segments</>} badgeType="up"
        />
        <MetricCard
          icon={<DollarSign size={18}/>} iconBg="#dcfce7" iconColor="#16a34a"
          label="Total Revenue" value={`$${(totalRevenue / 1000).toFixed(1)}k`}
          badge={<><ArrowUpRight size={12}/> All time</>} badgeType="up"
        />
        <MetricCard
          icon={<Crown size={18}/>} iconBg="#fef9c3" iconColor="#ca8a04"
          label={bestSeg} value={segCounts[bestSeg] ?? 0}
          badge={<><Star size={11}/> Top segment</>} badgeType="up"
        />
        <MetricCard
          icon={<AlertTriangle size={18}/>} iconBg="#fee2e2" iconColor="#dc2626"
          label="At Risk" value={atRisk}
          badge={<><ArrowDownRight size={12}/> Needs attention</>} badgeType="down"
        />
      </div>

      {/* ── Charts Row ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr', gap: 16 }}>

        {/* Doughnut */}
        <div className="card">
          <div className="card-header"><div className="card-title">Customer Segments</div></div>
          <div className="card-body" style={{ display:'flex', gap:16, alignItems:'center', flexDirection:'column' }}>
            <div style={{ width:140, height:140, position:'relative' }}>
              <Doughnut data={doughnutData} options={doughnutOptions}/>
              <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center' }}>
                <div style={{ fontSize:20, fontWeight:800, color:'#1a1a2e' }}>{totalCustomers.toLocaleString()}</div>
                <div style={{ fontSize:10, color:'#9ca3af' }}>Total</div>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:5, width:'100%' }}>
              {segments.map((seg, i) => {
                const col = segColors[i];
                const pct = ((segCounts[seg] / totalCustomers) * 100).toFixed(1);
                return (
                  <div key={seg} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:11 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <span style={{ width:7, height:7, borderRadius:'50%', background:col.dot, display:'block', flexShrink:0 }}/>
                      <span style={{ color:'#374151', fontWeight:500 }}>{seg}</span>
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <span style={{ fontWeight:700, color:'#1a1a2e' }}>{segCounts[seg]}</span>
                      <span style={{ color:'#9ca3af' }}>{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Revenue by segment */}
        <div className="card">
          <div className="card-header"><div className="card-title">Revenue by Segment</div></div>
          <div className="card-body">
            <div style={{ height:240 }}>
              <Bar data={barData} options={barOptions}/>
            </div>
          </div>
        </div>

        {/* Avg RFM Score */}
        <div className="card">
          <div className="card-header"><div className="card-title">Avg RFM Score / Segment</div></div>
          <div className="card-body">
            <div style={{ height:240 }}>
              <Bar data={scoreBarData} options={scoreBarOptions}/>
            </div>
          </div>
        </div>
      </div>

      {/* ── Segment Detail Cards ───────────────────────────────────── */}
      <div className="card">
        <div className="card-header"><div className="card-title">Segment Breakdown</div></div>
        <div className="card-body">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:12 }}>
            {segments.map((seg, i) => {
              const col = segColors[i];
              return (
                <div key={seg} style={{
                  background: col.bg, borderRadius:12, padding:'14px 16px',
                  border: `1px solid ${col.dot}33`,
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:8 }}>
                    <span style={{ width:9, height:9, borderRadius:'50%', background:col.dot, display:'block' }}/>
                    <span style={{ fontSize:12, fontWeight:700, color:col.text }}>{seg}</span>
                  </div>
                  <div style={{ fontSize:24, fontWeight:800, color:col.text, marginBottom:4 }}>
                    {segCounts[seg]}
                  </div>
                  <div style={{ fontSize:11, color:col.text, opacity:0.8, display:'flex', flexDirection:'column', gap:1 }}>
                    <span>Revenue: ${(segRevenue[seg] ?? 0).toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                    <span>Avg Score: {segScore[seg] ?? 0}</span>
                    <span>Avg Recency: {Math.round(segRecency[seg] ?? 0)}d</span>
                    <span>Avg Frequency: {segFreq[seg] ?? 0}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Customer Table ─────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div className="card-title">Customer Details</div>
            <div style={{ fontSize:12, color:'#9ca3af' }}>{displayCustomers.length} of {totalCustomers.toLocaleString()} customers shown</div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <select
              value={scopeFilter}
              onChange={e => setScopeFilter(e.target.value)}
              style={{ padding:'6px 12px', fontSize:13, fontWeight:500, borderRadius:8, border:'1px solid #e5e7eb', background:'#f9fafb', color:'#374151', cursor:'pointer', outline:'none' }}
            >
              <option value="All">All Customers</option>
              <option value="Top10">Top 10 Customers</option>
            </select>
            <select
              value={segmentFilter}
              onChange={e => setSegmentFilter(e.target.value)}
              style={{ padding:'6px 12px', fontSize:13, fontWeight:500, borderRadius:8, border:'1px solid #e5e7eb', background:'#f9fafb', color:'#374151', cursor:'pointer', outline:'none' }}
            >
              <option value="All">All Segments</option>
              {segments.map(seg => <option key={seg} value={seg}>{seg}</option>)}
            </select>
          </div>
        </div>

        <div className="card-body" style={{ padding:0 }}>
          <div style={{ overflowX:'auto', maxHeight:420, overflowY:'auto' }}>
            <table className="rfm-table">
              <thead style={{ position:'sticky', top:0, background:'#ffffff', zIndex:10 }}>
                <tr>
                  <th style={{ paddingTop:16 }}>Customer ID</th>
                  <th style={{ paddingTop:16 }}>Recency</th>
                  <th style={{ paddingTop:16 }}>Frequency</th>
                  <th style={{ paddingTop:16 }}>Monetary</th>
                  <th style={{ paddingTop:16 }}>RFM Score</th>
                  <th style={{ paddingTop:16 }}>Segment</th>
                </tr>
              </thead>
              <tbody>
                {displayCustomers.map((row, idx) => {
                  const segIdx   = segments.indexOf(row.Segment);
                  const segStyle = segIdx >= 0 ? segColors[segIdx] : PALETTE[6];
                  const pct      = Math.min((Number(row.RFM_Score) / 15) * 100, 100);
                  return (
                    <tr key={`${row.CustomerID}-${idx}`}>
                      <td className="cust-id">{row.CustomerID}</td>
                      <td><div style={{ display:'flex', alignItems:'center', gap:4 }}><Clock size={13} color="#9ca3af"/> {row.Recency}d</div></td>
                      <td><div style={{ display:'flex', alignItems:'center', gap:4 }}><Repeat size={13} color="#9ca3af"/> {row.Frequency}</div></td>
                      <td style={{ fontWeight:600 }}>${Number(row.Monetary).toFixed(2)}</td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:100 }}>
                          <span style={{ fontWeight:700, fontSize:13, color:'#6366f1', minWidth:20 }}>{row.RFM_Score}</span>
                          <div className="score-bar-bg" style={{ flex:1 }}>
                            <div className="score-bar-fill" style={{ width:`${pct}%` }}/>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="seg-pill" style={{ background:segStyle.bg, color:segStyle.text }}>
                          {row.Segment}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────
function StatChip({ label, value }) {
  return (
    <div style={{ textAlign:'center' }}>
      <div style={{ fontSize:10, color:'#a5b4fc', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
      <div style={{ fontSize:14, fontWeight:700, color:'white', marginTop:2 }}>{value}</div>
    </div>
  );
}

function MetricCard({ icon, iconBg, iconColor, label, value, badge, badgeType }) {
  return (
    <div className="metric-card">
      <div className="metric-label">
        <div style={{ width:30, height:30, borderRadius:8, background:iconBg, display:'flex', alignItems:'center', justifyContent:'center', color:iconColor }}>
          {icon}
        </div>
      </div>
      <div className="metric-value">{value}</div>
      <div className={`metric-badge ${badgeType === 'up' ? 'badge-up' : 'badge-down'}`}>{badge}</div>
    </div>
  );
}
