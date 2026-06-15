import { useEffect, useMemo, useState } from "react";

const categoryTemplates = {
  pothole: "Large pothole affecting vehicles and causing unsafe movement.",
  garbage: "Garbage has accumulated in the public area and needs clearance.",
  "water-leakage": "Water is leaking continuously and spreading into the road or walkway.",
  streetlight: "Streetlight is not working and the area becomes dark at night.",
  "road-damage": "Road surface is damaged with cracks or broken patches affecting travel.",
  other: "A civic issue is affecting this area and needs inspection.",
};

const initialFormState = {
  title: "",
  description: "",
  category: "pothole",
  address: "",
  image: "",
  latitude: "",
  longitude: "",
};

const IssueForm = ({
  onSubmit,
  onAnalyze,
  onCompose,
  loading,
  analyzing,
  composing,
  analysis,
  onJoinDuplicate,
  initialData,
}) => {
  const [form, setForm] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const [locationMessage, setLocationMessage] = useState("");
  const [locationState, setLocationState] = useState("idle");
  const [voiceMessage, setVoiceMessage] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    if (!initialData) {
      return;
    }

    setForm((current) => ({
      ...current,
      ...Object.fromEntries(
        Object.entries(initialData).filter(([, value]) => value !== undefined && value !== null && value !== "")
      ),
    }));
  }, [initialData]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setVoiceSupported(Boolean(SpeechRecognition));
  }, []);

  const progress = useMemo(() => {
    const checkpoints = [
      Boolean(form.category),
      Boolean(form.address.trim()),
      Boolean(form.title.trim()),
      Boolean(form.description.trim()),
      Boolean(form.latitude && form.longitude),
      Boolean(form.image),
    ];

    return Math.round((checkpoints.filter(Boolean).length / checkpoints.length) * 100);
  }, [form]);

  const quickChecklist = useMemo(
    () => [
      { label: "Category selected", done: Boolean(form.category) },
      { label: "Location details added", done: Boolean(form.address.trim()) },
      { label: "Title and description ready", done: Boolean(form.title.trim() && form.description.trim()) },
      { label: "GPS captured", done: Boolean(form.latitude && form.longitude) },
      { label: "Photo attached", done: Boolean(form.image) },
    ],
    [form]
  );

  const validate = () => {
    const nextErrors = {};

    if (!form.title.trim()) {
      nextErrors.title = "Add a short issue title.";
    }

    if (!form.description.trim()) {
      nextErrors.description = "Describe what people are facing.";
    }

    if (!form.address.trim()) {
      nextErrors.address = "Add a landmark or address.";
    }

    if (!form.latitude || !form.longitude) {
      nextErrors.location = "Capture GPS or enter latitude and longitude.";
    } else if (!Number.isFinite(Number(form.latitude)) || !Number.isFinite(Number(form.longitude))) {
      nextErrors.location = "Latitude and longitude must be valid numbers.";
    }

    return nextErrors;
  };

  const updateField = (key, value) => {
    const nextValue = key === "latitude" || key === "longitude" ? String(value).trim() : value;
    setForm((current) => ({ ...current, [key]: nextValue }));
    setErrors((current) => ({ ...current, [key]: "", location: key === "latitude" || key === "longitude" ? "" : current.location }));
    if (key === "latitude" || key === "longitude") {
      setLocationState("manual");
      setLocationMessage("");
    }
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({ ...current, image: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage("Geolocation is not supported in this browser.");
      setLocationState("error");
      return;
    }

    setLocationState("fetching");
    setLocationMessage("Capturing your current location...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLatitude = String(position.coords.latitude);
        const nextLongitude = String(position.coords.longitude);
        setForm((current) => ({
          ...current,
          latitude: nextLatitude,
          longitude: nextLongitude,
        }));
        setErrors((current) => ({ ...current, location: "" }));
        setLocationState("success");
        setLocationMessage("Location captured successfully.");
      },
      () => {
        setLocationState("error");
        setLocationMessage("Unable to capture your current location.");
      }
    );
  };

  const applyDraft = (draft) => {
    setForm((current) => ({
      ...current,
      title: draft.title || current.title,
      description: draft.description || current.description,
    }));
  };

  const applyTemplate = () => {
    const template = categoryTemplates[form.category] || categoryTemplates.other;
    setForm((current) => ({
      ...current,
      description: current.description || template,
      title: current.title || `${form.category.replace("-", " ")} reported`,
    }));
  };

  const startVoiceCapture = (targetField = "description") => {
    if (typeof window === "undefined") {
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceMessage("Voice input is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsListening(true);
    setVoiceMessage(
      targetField === "title"
        ? "Listening for a short issue title..."
        : "Listening for issue details. Speak clearly and mention the impact or landmark."
    );

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (!transcript) {
        setVoiceMessage("No clear voice input was captured. Please try again.");
        return;
      }

      setForm((current) => ({
        ...current,
        [targetField]:
          targetField === "description"
            ? [current.description, transcript].filter(Boolean).join(current.description ? " " : "")
            : transcript,
      }));
      setErrors((current) => ({ ...current, [targetField]: "" }));
      setVoiceMessage(
        targetField === "title"
          ? "Voice title added to the report."
          : "Voice notes added to the description. Review and edit before submitting."
      );
    };

    recognition.onerror = () => {
      setVoiceMessage("Voice capture failed. Please allow microphone access and try again.");
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      return;
    }

    onSubmit(form);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <form onSubmit={handleSubmit} className="grid gap-4 rounded-[32px] bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-civic">Citizen Report Flow</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-ink">Write a clearer civic report in one pass.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Add the basics first, then use Auto Write or Smart Preview before you submit.
            </p>
          </div>
          <div className="min-w-48 rounded-3xl bg-slate-900 p-4 text-white">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Report Readiness</p>
            <p className="mt-2 text-3xl font-black">{progress}%</p>
            <div className="mt-3 h-2 rounded-full bg-white/10">
              <div className="h-2 rounded-full bg-cyan-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">Issue Category *</label>
            <select
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              value={form.category}
              onChange={(event) => updateField("category", event.target.value)}
            >
              <option value="pothole">Pothole</option>
              <option value="garbage">Garbage Dump</option>
              <option value="water-leakage">Water Leakage</option>
              <option value="streetlight">Broken Streetlight</option>
              <option value="road-damage">Road Damage</option>
              <option value="other">Other</option>
            </select>
          </div>
          <button
            type="button"
            onClick={applyTemplate}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700"
          >
            Use Quick Template
          </button>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">Issue Title *</label>
          <input
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            placeholder="Issue title"
            value={form.title}
            onChange={(event) => updateField("title", event.target.value)}
          />
          {errors.title && <p className="mt-2 text-sm font-semibold text-rose-600">{errors.title}</p>}
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">Description *</label>
          <textarea
            className="min-h-36 w-full rounded-2xl border border-slate-200 px-4 py-3"
            placeholder="Describe what happened, who is affected, and how serious it looks"
            value={form.description}
            onChange={(event) => updateField("description", event.target.value)}
          />
          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
            <span>Tip: mention public impact, visibility, and nearby landmark.</span>
            <span>{form.description.length} chars</span>
          </div>
          {errors.description && <p className="mt-2 text-sm font-semibold text-rose-600">{errors.description}</p>}
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">Address or Landmark *</label>
          <input
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            placeholder="Address or landmark"
            value={form.address}
            onChange={(event) => updateField("address", event.target.value)}
          />
          {errors.address && <p className="mt-2 text-sm font-semibold text-rose-600">{errors.address}</p>}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">Latitude *</label>
            <input
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              inputMode="decimal"
              placeholder="Latitude"
              value={form.latitude}
              onChange={(event) => updateField("latitude", event.target.value)}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">Longitude *</label>
            <input
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              inputMode="decimal"
              placeholder="Longitude"
              value={form.longitude}
              onChange={(event) => updateField("longitude", event.target.value)}
            />
          </div>
        </div>
        {(errors.location || locationMessage) && (
          <p className={`text-sm font-semibold ${errors.location ? "text-rose-600" : "text-emerald-700"}`}>
            {errors.location || locationMessage}
          </p>
        )}

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={captureLocation}
              disabled={locationState === "fetching"}
              className={`rounded-full px-4 py-2 font-semibold text-white ${
                locationState === "success" ? "bg-emerald-600" : "bg-slate-900"
              }`}
            >
              {locationState === "fetching" && <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {locationState === "fetching" ? "Fetching..." : locationState === "success" ? "GPS Captured" : "Auto Capture GPS"}
            </button>
            <button
              type="button"
              onClick={() => startVoiceCapture("description")}
              disabled={!voiceSupported || isListening}
              className="rounded-full bg-indigo-100 px-4 py-2 font-semibold text-indigo-800 disabled:opacity-50"
            >
              {isListening ? "Listening..." : "Voice To Report"}
            </button>
            <button
              type="button"
              onClick={() => onCompose?.(form, applyDraft)}
              disabled={composing}
              className="rounded-full bg-civic px-4 py-2 font-semibold text-white disabled:opacity-60"
            >
              {composing ? "Writing..." : "Auto Write"}
            </button>
            <button
              type="button"
              onClick={() => onAnalyze?.(form)}
              disabled={analyzing}
              className="rounded-full bg-amber-100 px-4 py-2 font-semibold text-amber-800 disabled:opacity-60"
            >
              {analyzing ? "Analyzing..." : "Smart Preview"}
            </button>
            <label className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
              Add Photo
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </label>
          </div>
          {(voiceMessage || !voiceSupported) && (
            <p className={`mt-3 text-sm font-semibold ${voiceSupported ? "text-indigo-700" : "text-slate-500"}`}>
              {voiceMessage || "Voice input works in supported browsers like Chrome and Edge."}
            </p>
          )}
          {form.image && (
            <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white p-3">
              <img src={form.image} alt="Issue preview" className="h-56 w-full rounded-2xl object-cover" />
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-civic px-5 py-3 font-bold text-white disabled:opacity-60"
        >
          {loading ? "Submitting..." : "Submit Issue"}
        </button>
      </form>

      <div className="grid gap-5">
        <div className="rounded-[32px] bg-white p-6 shadow-card">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-civic">Submission Checklist</p>
          <div className="mt-4 grid gap-3">
            {quickChecklist.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-semibold text-slate-700">{item.label}</span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black uppercase ${
                    item.done ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {item.done ? "Done" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[32px] bg-slate-900 p-6 text-white shadow-card">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">Smart Tips</p>
          <div className="mt-4 grid gap-3 text-sm leading-7 text-slate-200">
            <p>Use Voice To Report if you want to speak the issue before editing the final complaint.</p>
            <p>Use Auto Write if you know the issue but do not want to write the complaint from scratch.</p>
            <p>Use Smart Preview before submission to see severity, duplicate risk, and AI guidance.</p>
            <p>Join an existing complaint if the app detects a strong nearby duplicate.</p>
          </div>
        </div>

        {analysis && (
          <div className="rounded-[32px] border border-cyan-100 bg-cyan-50 p-6 shadow-card">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-800">AI Assessment</p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Predicted Category</p>
                <p className="mt-2 text-lg font-black capitalize text-ink">{analysis.predictedCategory}</p>
                <p className="mt-2 text-sm text-slate-600">{analysis.categoryReason}</p>
              </div>
              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Predicted Severity</p>
                <p className="mt-2 text-lg font-black capitalize text-ink">{analysis.predictedSeverity}</p>
                <p className="mt-2 text-sm text-slate-600">{analysis.severityReason}</p>
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">AI Confidence</p>
                <p className="mt-2 text-lg font-black text-ink">{Math.round((analysis.confidenceScore || 0) * 100)}%</p>
              </div>
              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Priority Band</p>
                <p className="mt-2 text-lg font-black text-ink">{analysis.priorityBand || "Routine"}</p>
              </div>
              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Expected Timeline</p>
                <p className="mt-2 text-sm font-bold text-ink">{analysis.estimatedResolutionEta || "Under review"}</p>
              </div>
            </div>

            <div className="mt-3 rounded-2xl bg-white p-4">
              {analysis.citizenSummary && (
                <>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Citizen Summary</p>
                  <p className="mt-2 text-sm text-slate-700">{analysis.citizenSummary}</p>
                </>
              )}
              {analysis.likelyDepartment && (
                <>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Likely Department</p>
                  <p className="mt-2 text-sm font-bold text-ink">{analysis.likelyDepartment}</p>
                </>
              )}
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Recommended Action</p>
              <p className="mt-2 text-sm text-slate-700">{analysis.recommendedAction}</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Image Insight</p>
              <p className="mt-2 text-sm text-slate-700">{analysis.imageSummary}</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Citizen Guidance</p>
              <p className="mt-2 text-sm text-slate-700">{analysis.citizenGuidance}</p>
            </div>

            {analysis.duplicate && (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-800">Possible Duplicate Nearby</p>
                <p className="mt-2 text-base font-bold text-ink">{analysis.duplicate.title}</p>
                <p className="mt-1 text-sm text-slate-700">
                  {analysis.duplicate.address || "Nearby location"} | {analysis.duplicate.distanceMeters}m away
                </p>
                <p className="mt-1 text-sm text-slate-700 capitalize">
                  Status: {analysis.duplicate.status} | Severity: {analysis.duplicate.severity}
                </p>
                <button
                  type="button"
                  onClick={onJoinDuplicate}
                  className="mt-3 rounded-full bg-amber-600 px-4 py-2 text-sm font-bold text-white"
                >
                  Join Existing Issue Instead
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default IssueForm;
