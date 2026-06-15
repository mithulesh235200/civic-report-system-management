import { useEffect, useState } from "react";

import LayoutShell from "../../components/LayoutShell";
import ProtectedRoute from "../../components/ProtectedRoute";
import StatCard from "../../components/StatCard";
import { completeWorkerTask, fetchWorkerTasks, updateWorkerPresence } from "../../services/worker";
import { useAuth } from "../../utils/AuthContext";
import { ROLES } from "../../utils/roles";

const formatDistance = (distanceMeters) => {
  if (distanceMeters === null || distanceMeters === undefined) {
    return "Unknown";
  }

  if (distanceMeters < 1000) {
    return `${distanceMeters} m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)} km`;
};

export default function WorkerTasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [proofs, setProofs] = useState({});
  const [locationError, setLocationError] = useState("");
  const [presenceMessage, setPresenceMessage] = useState("");
  const [presenceError, setPresenceError] = useState("");
  const [taskMessages, setTaskMessages] = useState({});
  const [taskErrors, setTaskErrors] = useState({});
  const [resolvingTaskId, setResolvingTaskId] = useState("");
  const [availability, setAvailability] = useState(user?.workerProfile?.availability || "offline");

  const loadTasks = async (coords) => {
    const params = coords
      ? {
          latitude: coords.latitude,
          longitude: coords.longitude,
        }
      : {};
    const response = await fetchWorkerTasks(params);
    setTasks(response.tasks);
    setStats(response.stats);
  };

  useEffect(() => {
    loadTasks().catch(() => {
      setTasks([]);
      setStats(null);
    });
  }, []);

  useEffect(() => {
    setAvailability(user?.workerProfile?.availability || "offline");
  }, [user]);

  const locateAndOptimize = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setLocationError("");
        setPresenceError("");
        setPresenceMessage("");
        await updateWorkerPresence({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setPresenceMessage("Location synced for smart dispatch.");
        await loadTasks({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        setLocationError("Unable to access your current location.");
      }
    );
  };

  const handleAvailabilityChange = async (event) => {
    const nextAvailability = event.target.value;
    setAvailability(nextAvailability);
    setPresenceError("");
    setPresenceMessage("");

    try {
      await updateWorkerPresence({ availability: nextAvailability });
      setPresenceMessage(`Status updated to ${nextAvailability}.`);
    } catch (requestError) {
      setPresenceError(requestError.response?.data?.message || "Unable to update worker status.");
    }
  };

  const handleFile = (issueId, file) => {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setProofs((current) => ({
        ...current,
        [issueId]: {
          ...(current[issueId] || {}),
          proofImage: reader.result,
        },
      }));
    };
    reader.readAsDataURL(file);
  };

  const completeTask = async (issueId) => {
    setTaskErrors((current) => ({ ...current, [issueId]: "" }));
    setTaskMessages((current) => ({ ...current, [issueId]: "" }));

    if (!proofs[issueId]?.proofImage) {
      setTaskErrors((current) => ({ ...current, [issueId]: "Upload a proof image before marking the task resolved." }));
      return;
    }

    try {
      setResolvingTaskId(issueId);
      const response = await completeWorkerTask({
        issueId,
        proofImage: proofs[issueId]?.proofImage,
        resolutionNotes: proofs[issueId]?.resolutionNotes || "",
      });
      setTaskMessages((current) => ({ ...current, [issueId]: response.message || "Task marked as resolved." }));
      await loadTasks();
    } catch (requestError) {
      setTaskErrors((current) => ({
        ...current,
        [issueId]: requestError.response?.data?.message || "Unable to complete the worker task.",
      }));
    } finally {
      setResolvingTaskId("");
    }
  };

  return (
    <ProtectedRoute roles={[ROLES.WORKER]}>
      <LayoutShell title="Field Worker Tasks">
        {stats && (
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Total Tasks" value={stats.totalTasks} />
            <StatCard label="Active" value={stats.activeTasks} accent="bg-amber-500" />
            <StatCard label="Completed" value={stats.completedTasks} accent="bg-emerald-500" />
            <StatCard
              label="Nearest Task"
              value={stats.nearestTaskDistanceMeters ? formatDistance(stats.nearestTaskDistanceMeters) : "N/A"}
              accent="bg-indigo-500"
            />
          </div>
        )}

        <div className="mt-8 rounded-3xl bg-white p-6 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xl font-black text-ink">Route Optimization</p>
              <p className="mt-1 text-sm text-slate-600">
                Use your live location to sort tasks by proximity and tackle the nearest issues first.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                className="rounded-full border border-slate-200 px-4 py-3 font-semibold text-slate-700"
                value={availability}
                onChange={handleAvailabilityChange}
              >
                <option value="available">Available</option>
                <option value="busy">Busy</option>
                <option value="offline">Offline</option>
              </select>
              <button
                type="button"
                onClick={locateAndOptimize}
                className="rounded-full bg-slate-900 px-5 py-3 font-bold text-white"
              >
                Use My Location
              </button>
            </div>
          </div>
          {locationError && <p className="mt-3 text-sm font-semibold text-rose-600">{locationError}</p>}
          {presenceError && <p className="mt-3 text-sm font-semibold text-rose-600">{presenceError}</p>}
          {presenceMessage && <p className="mt-3 text-sm font-semibold text-emerald-700">{presenceMessage}</p>}
        </div>

        <div className="mt-8 grid gap-4">
          {tasks.map((task, index) => {
            const issueId = task.issueId?._id;
            const isCompleted = task.status === "completed" || task.issueId?.status === "resolved";

            return (
            <div key={task._id} className="rounded-3xl bg-white p-6 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xl font-black text-ink">{task.issueId?.title}</p>
                  <p className="mt-2 text-sm text-slate-600">{task.issueId?.description}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-500">{task.issueId?.address}</p>
                </div>
                <div className="text-right">
                  <p className="rounded-full bg-cyan-50 px-3 py-1 text-sm font-bold text-cyan-800">
                    Stop #{index + 1}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-600">
                    Distance: {formatDistance(task.distanceMeters)}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-slate-600">
                <span className="rounded-full bg-slate-100 px-3 py-1 capitalize">{task.issueId?.category}</span>
                <span className="rounded-full bg-rose-50 px-3 py-1 capitalize text-rose-700">
                  {task.issueId?.severity}
                </span>
                <span className="rounded-full bg-amber-50 px-3 py-1 capitalize text-amber-700">{task.status}</span>
              </div>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">AI Task Brief</p>
                <p className="mt-2 text-sm text-slate-700">{task.aiBrief}</p>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-white p-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Priority</p>
                    <p className="mt-2 text-sm font-bold text-ink">
                      {task.issueId?.aiAnalysis?.priorityBand || "Routine"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white p-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Department</p>
                    <p className="mt-2 text-sm font-bold text-ink">
                      {task.issueId?.aiAnalysis?.likelyDepartment || "General Civic Operations"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white p-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">ETA Signal</p>
                    <p className="mt-2 text-sm font-bold text-ink">
                      {task.issueId?.aiAnalysis?.estimatedResolutionEta || "Under review"}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-slate-600">
                  {task.issueId?.aiAnalysis?.adminSummary || "No admin-side AI summary available for this task yet."}
                </p>
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${task.issueId?.location?.coordinates?.[1]},${task.issueId?.location?.coordinates?.[0]}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block font-bold text-civic"
              >
                Open in Maps
              </a>
              {isCompleted ? (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-800">Completed Task</p>
                  <p className="mt-2 text-sm text-emerald-900">
                    This assignment is locked because the issue has already been marked resolved.
                  </p>
                  {task.issueId?.proofImage && (
                    <img
                      src={task.issueId.proofImage}
                      alt="Resolution proof"
                      className="mt-4 h-48 w-full rounded-2xl object-cover"
                    />
                  )}
                  {task.issueId?.resolutionNotes && (
                    <p className="mt-3 text-sm text-emerald-900">{task.issueId.resolutionNotes}</p>
                  )}
                </div>
              ) : (
              <div className="mt-4 grid gap-3">
                <textarea
                  className="rounded-2xl border border-slate-200 px-4 py-3"
                  placeholder="Resolution notes"
                  onChange={(event) =>
                    setProofs((current) => ({
                      ...current,
                      [issueId]: {
                        ...(current[issueId] || {}),
                        resolutionNotes: event.target.value,
                      },
                    }))
                  }
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleFile(issueId, event.target.files?.[0])}
                />
                {taskErrors[issueId] && <p className="text-sm font-semibold text-rose-600">{taskErrors[issueId]}</p>}
                {taskMessages[issueId] && <p className="text-sm font-semibold text-emerald-700">{taskMessages[issueId]}</p>}
                <button
                  type="button"
                  onClick={() => completeTask(issueId)}
                  disabled={resolvingTaskId === issueId}
                  className="rounded-full bg-civic px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resolvingTaskId === issueId ? "Resolving..." : "Mark Resolved"}
                </button>
              </div>
              )}
            </div>
            );
          })}
          {!tasks.length && <div className="rounded-3xl bg-white p-6 shadow-card">No assigned tasks yet.</div>}
        </div>
      </LayoutShell>
    </ProtectedRoute>
  );
}
