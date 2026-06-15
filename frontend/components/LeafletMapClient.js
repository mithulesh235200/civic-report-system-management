import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import { useMemo, useState } from "react";

const containerStyle = {
  width: "100%",
  height: "520px",
  borderRadius: "24px",
};

const defaultCenter = [22.5726, 88.3639];

const severityColors = {
  critical: "#e11d48",
  medium: "#f59e0b",
  low: "#10b981",
};

const createClusterBuckets = (issues) => {
  const clusters = new Map();

  issues.forEach((issue) => {
    const [lng, lat] = issue.location.coordinates;
    const key = `${lat.toFixed(2)}:${lng.toFixed(2)}`;

    if (!clusters.has(key)) {
      clusters.set(key, {
        key,
        lat,
        lng,
        count: 0,
        issues: [],
      });
    }

    const entry = clusters.get(key);
    entry.count += 1;
    entry.issues.push(issue);
  });

  return Array.from(clusters.values()).sort((a, b) => b.count - a.count);
};

const LeafletMapClient = ({ issues, onIssueSelect, activeIssueId, renderIssueDetails }) => {
  const [internalActiveIssue, setInternalActiveIssue] = useState(null);

  const points = useMemo(
    () =>
      issues
        .filter((issue) => issue.location?.coordinates?.length === 2)
        .map((issue) => ({
          ...issue,
          lat: issue.location.coordinates[1],
          lng: issue.location.coordinates[0],
        })),
    [issues]
  );

  const clusters = useMemo(() => createClusterBuckets(points), [points]);
  const activeIssue = points.find((issue) => issue._id === activeIssueId) || internalActiveIssue;
  const center = activeIssue ? [activeIssue.lat, activeIssue.lng] : points[0] ? [points[0].lat, points[0].lng] : defaultCenter;

  return (
    <MapContainer center={center} zoom={12} scrollWheelZoom style={containerStyle} className="z-0">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {points.map((issue) => (
        <CircleMarker
          key={issue._id}
          center={[issue.lat, issue.lng]}
          radius={activeIssue?._id === issue._id ? 12 : 8}
          pathOptions={{
            color: severityColors[issue.severity] || "#0891b2",
            fillColor: severityColors[issue.severity] || "#0891b2",
            fillOpacity: activeIssue?._id === issue._id ? 0.9 : 0.65,
          }}
          eventHandlers={{
            click: () => {
              setInternalActiveIssue(issue);
              onIssueSelect?.(issue);
            },
          }}
        >
          <Popup>
            {renderIssueDetails ? (
              renderIssueDetails(issue)
            ) : (
              <div className="max-w-56">
                <p className="font-bold text-slate-900">{issue.title}</p>
                <p className="mt-1 text-sm capitalize text-slate-600">
                  {issue.category} | {issue.severity} | {issue.status}
                </p>
                <p className="mt-2 text-sm text-slate-600">{issue.address || "No address provided"}</p>
              </div>
            )}
          </Popup>
        </CircleMarker>
      ))}

      {clusters
        .filter((cluster) => cluster.count > 1)
        .map((cluster) => (
          <CircleMarker
            key={`cluster-${cluster.key}`}
            center={[cluster.lat, cluster.lng]}
            radius={Math.min(12 + cluster.count * 2, 28)}
            pathOptions={{ color: "#0f172a", fillColor: "#0f172a", fillOpacity: 0.55 }}
          >
            <Popup>
              <div className="max-w-72">
                <p className="font-bold text-slate-900">Area Cluster</p>
                <p className="mt-1 text-sm text-slate-600">{cluster.count} nearby reports in this zone</p>
                <div className="mt-3 grid gap-2">
                  {cluster.issues.slice(0, 4).map((issue) => (
                    <button
                      key={issue._id}
                      type="button"
                      onClick={() => {
                        setInternalActiveIssue(issue);
                        onIssueSelect?.(issue);
                      }}
                      className="rounded-xl bg-slate-50 p-2 text-left"
                    >
                      <p className="text-sm font-semibold text-slate-900">{issue.title}</p>
                      <p className="text-xs capitalize text-slate-600">
                        {issue.category} | {issue.severity} | {issue.status}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}

      {!points.length && (
        <CircleMarker center={defaultCenter} radius={8} pathOptions={{ color: "#94a3b8", fillColor: "#94a3b8" }}>
          <Popup>No mapped issues available yet.</Popup>
        </CircleMarker>
      )}
    </MapContainer>
  );
};

export default LeafletMapClient;
