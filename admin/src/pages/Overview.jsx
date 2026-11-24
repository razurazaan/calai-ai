import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { HBars, Legend, LineChart, SeriesTable, StackedBars, fmt } from "./charts.jsx";
import { Loading, OutdatedBackend, PLATFORM_LABEL, RangePicker, StatusBadge, Tile, money, pct, useApi } from "./shared.jsx";

const AI_SERIES = [
  { key: "aiPhoto", label: "Photo scans", color: "var(--s1)" },
  { key: "aiText", label: "Text analyses", color: "var(--s2)" },
];
const LOG_SERIES = [
  { key: "logsPhoto", label: "From photo", color: "var(--s1)" },
  { key: "logsText", label: "From text", color: "var(--s2)" },
  { key: "logsManual", label: "Manual", color: "var(--s3)" },
];
const PLATFORM_SERIES = [
  { key: "activeAndroid", label: "Android", color: "var(--s3)" },
  { key: "activeIos", label: "iOS", color: "var(--s1)" },
  { key: "activeWeb", label: "Website", color: "var(--s2)" },
];

// Sum of amounts across currencies, shown as "₹1,200 + $40"
const moneyList = (obj) => {
  const parts = Object.entries(obj || {}).map(([cur, v]) => money(v.amount, cur));
  return parts.length ? parts.join(" + ") : money(0, "INR");
};

export default function Overview() {
  const [days, setDays] = useState(30);
  const { data, error, loading } = useApi(`/admin/overview?days=${days}`);
  const navigate = useNavigate();

  if (error) return <div className="error">{error}</div>;
  if (!data) return <Loading />;
  if (!data.subscriptions || !data.platforms) return <OutdatedBackend />;
  const { users, ai, logs, series, subscriptions: subs, platforms } = data;
  const failed = ai.calls - (ai.byStatus.success || 0);
  const cur = subs.currency;
  const revenueRange = subs.revenue.inRange[cur]?.amount || 0;
  const refunds = subs.revenue.refundedInRange[cur];
  const mrr = subs.revenue.mrr[cur];

  return (
    <div className="stack" style={{ gap: 16, opacity: loading ? 0.6 : 1 }}>
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <RangePicker days={days} setDays={setDays} />
        <span className="small muted">Since {data.since} (UTC)</span>
      </div>

      <div className="section-title">Users</div>
      <div className="admin-grid tiles">
        <Tile label="Total users" value={fmt(users.total)} sub={`${fmt(users.onboarded)} finished onboarding`} />
        <Tile label="New sign-ups" value={fmt(users.new)} sub={`in the last ${days} days`} />
        <Tile label="Daily active (DAU)" value={fmt(users.active1)} sub="used the app in the last 24 h" />
        <Tile label="Weekly active (WAU)" value={fmt(users.active7)} sub="last 7 days" />
        <Tile label="Monthly active (MAU)" value={fmt(users.active30)} sub="last 30 days" />
        <Tile label="Stickiness" value={pct(users.stickiness)} sub="DAU ÷ MAU" />
      </div>

      <div className="section-title">Pro &amp; revenue</div>
      <div className="admin-grid tiles">
        <Tile label="Paying Pro users" value={fmt(subs.active)} sub={`${fmt(subs.free)} free · ${fmt(subs.trial?.active || 0)} on trial · ${fmt(subs.comp || 0)} given Pro free`} />
        <Tile label="On free trial" value={fmt(subs.trial?.active || 0)} sub={`${fmt(subs.trial?.startedInRange || 0)} started in ${days}d · ${pct(subs.trial?.conversionRate)} of trials paid`} />
        <Tile label="Conversion to Pro" value={pct(subs.conversionRate)} sub="of all users are Pro now" />
        <Tile label="New Pro users" value={fmt(subs.newInRange)} sub={`first payment in the last ${days} days`} />
        <Tile label={`Revenue (${days}d)`} value={money(revenueRange, cur)} sub={refunds ? `${money(refunds.amount, cur)} refunded` : `${fmt(subs.revenue.inRange[cur]?.count || 0)} payments`} />
        <Tile label="MRR" value={money(mrr?.amount || 0, cur)} sub="monthly recurring revenue (yearly ÷ 12)" />
        <Tile label="Lifetime revenue" value={moneyList(subs.revenue.lifetime)} sub={`${fmt(subs.lapsed)} lapsed · ${fmt(subs.expiringIn7d)} expiring in 7 days`} />
      </div>

      <div className="admin-grid two-col">
        <div className="card stack">
          <h2>Active users per day</h2>
          <LineChart data={series} valueKey="activeUsers" label="Active users" />
          <SeriesTable data={series} columns={[{ key: "activeUsers", label: "Active users" }, { key: "signups", label: "Sign-ups" }]} />
        </div>
        <div className="card stack">
          <h2>New sign-ups per day</h2>
          <StackedBars data={series} series={[{ key: "signups", label: "Sign-ups", color: "var(--s1)" }]} />
          <SeriesTable data={series} columns={[{ key: "signups", label: "Sign-ups" }]} />
        </div>
        <div className="card stack">
          <h2>New Pro users and trials per day</h2>
          <StackedBars data={series} series={[{ key: "newPro", label: "New Pro", color: "var(--carbs)" }, { key: "trials", label: "Trials started", color: "var(--s1)" }]} />
          <SeriesTable data={series} columns={[{ key: "newPro", label: "New Pro users" }, { key: "trials", label: "Trials started" }]} />
        </div>
        <div className="card stack">
          <div className="row between">
            <h2>Revenue per day ({cur})</h2>
            <Link className="small muted" to="/subscriptions">All payments →</Link>
          </div>
          <StackedBars data={series} series={[{ key: "revenue", label: `Revenue (${cur})`, color: "var(--good)" }]} />
          <SeriesTable data={series} columns={[{ key: "revenue", label: `Revenue (${cur})` }]} />
        </div>
      </div>

      <div className="section-title">Platforms: app vs website</div>
      <div className="admin-grid two-col">
        <div className="card stack">
          <div className="row between"><h2>Active users per day by platform</h2><Legend series={PLATFORM_SERIES} /></div>
          <StackedBars data={series} series={PLATFORM_SERIES} />
          {platforms.trackingSince
            ? <div className="small muted">Platform tracking started {platforms.trackingSince}. A user active on two platforms counts on both.</div>
            : <div className="small muted">No platform data yet. It appears as people use the updated app and website.</div>}
        </div>
        <div className="card stack">
          <h2>Users active in the last {days} days</h2>
          <HBars rows={platformRows(platforms.activeInRange)} empty="No platform data yet" />
          <h2 style={{ marginTop: 8 }}>Where people signed up</h2>
          <HBars rows={platformRows(platforms.signups)} color="var(--s3)" empty="No users yet" />
        </div>
        <div className="card stack">
          <h2>Pro users by plan</h2>
          <HBars rows={Object.entries(subs.byPeriod).map(([k, v]) => ({ label: k, value: v }))} color="var(--carbs)" empty="No Pro users yet" />
          <h2 style={{ marginTop: 8 }}>Pro users by payment source</h2>
          <HBars rows={Object.entries(subs.bySource).map(([k, v]) => ({ label: k.replace("_", " "), value: v }))} color="var(--carbs)" empty="No Pro users yet" />
        </div>
      </div>

      <div className="section-title">AI &amp; food logging</div>
      <div className="admin-grid tiles">
        <Tile label="AI requests" value={fmt(ai.calls)} sub={`${fmt(ai.byKind.photo || 0)} photo · ${fmt(ai.byKind.text || 0)} text · ${fmt(ai.users)} users`} />
        <Tile label="AI success rate" value={pct(ai.successRate)} sub={`${fmt(failed)} failed or refused`} />
        <Tile label="Avg AI response" value={ai.avgLatencyMs ? `${(ai.avgLatencyMs / 1000).toFixed(1)}s` : "–"} sub="successful requests" />
        <Tile label="Gemini tokens" value={fmt(ai.tokens.total)} sub={`${fmt(ai.tokens.prompt)} in · ${fmt(ai.tokens.output)} out`} />
        <Tile label="Food logs" value={fmt(logs.total)} sub={`${fmt(logs.bySource.manual || 0)} manual · ${fmt((logs.bySource["ai-photo"] || 0) + (logs.bySource["ai-text"] || 0))} via AI`} />
        <Tile label="Images analysed" value={`${ai.imageMB} MB`} sub={`AI scans a day: ${ai.freeDailyLimit} free · ${ai.proDailyLimit} Pro`} />
      </div>

      <div className="admin-grid two-col">
        <div className="card stack">
          <div className="row between"><h2>AI usage per day</h2><Legend series={AI_SERIES} /></div>
          <StackedBars data={series} series={AI_SERIES} />
          <SeriesTable data={series} columns={AI_SERIES} />
        </div>
        <div className="card stack">
          <div className="row between"><h2>Food logged per day</h2><Legend series={LOG_SERIES} /></div>
          <StackedBars data={series} series={LOG_SERIES} />
          <SeriesTable data={series} columns={LOG_SERIES} />
        </div>
      </div>

      <div className="admin-grid two-col">
        <div className="card stack">
          <div className="row between">
            <h2>Top AI users</h2>
            <Link className="small muted" to="/users?sort=aiCalls">All users →</Link>
          </div>
          {data.topUsers.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>User</th><th className="num">Photo</th><th className="num">Text</th><th className="num">Tokens</th></tr></thead>
                <tbody>
                  {data.topUsers.map((u) => (
                    <tr key={u.id} className="click" onClick={() => navigate(`/users/${u.id}`)}>
                      <td><div style={{ fontWeight: 600 }}>{u.name || "Deleted user"}</div><div className="small muted">{u.email}</div></td>
                      <td className="num">{fmt(u.photo)}</td>
                      <td className="num">{fmt(u.text)}</td>
                      <td className="num">{fmt(u.tokens)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="small muted">No AI usage in this period</div>}
        </div>

        <div className="card stack">
          <h2>Most detected foods</h2>
          <HBars rows={data.topFoods.map((f) => ({ label: f.name, value: f.count, sub: `~${fmt(f.avgCalories)} kcal` }))} empty="No successful scans in this period" />
        </div>

        <div className="card stack">
          <h2>Request outcomes</h2>
          <HBars
            rows={Object.entries(ai.byStatus).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, value: v, sub: pct(v / ai.calls) }))}
            empty="No AI requests in this period"
          />
          <h2 style={{ marginTop: 8 }}>Models answering</h2>
          <HBars rows={Object.entries(ai.byModel).map(([k, v]) => ({ label: k, value: v }))} color="var(--s3)" empty="–" />
        </div>

        <div className="card stack">
          <div className="row between">
            <h2>Top failure reasons</h2>
            <Link className="small muted" to="/ai?status=failed">See failures →</Link>
          </div>
          {data.errors.length ? (
            data.errors.map((e, i) => (
              <div key={i} className="row between small" style={{ alignItems: "flex-start" }}>
                <div className="row" style={{ alignItems: "flex-start", gap: 8 }}>
                  <StatusBadge status={e.status} />
                  <span>{e.message || "–"}</span>
                </div>
                <b style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(e.count)}</b>
              </div>
            ))
          ) : <div className="small muted">No failures 🎉</div>}
        </div>
      </div>
    </div>
  );
}

const platformRows = (counts) =>
  Object.entries(counts || {})
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ label: PLATFORM_LABEL[k] || k, value: v }));
