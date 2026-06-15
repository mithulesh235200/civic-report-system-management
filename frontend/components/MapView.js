import dynamic from "next/dynamic";

const LeafletMapClient = dynamic(() => import("./LeafletMapClient"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[520px] items-center justify-center rounded-[24px] bg-slate-100 text-sm font-semibold text-slate-600">
      Loading map...
    </div>
  ),
});

const MapView = (props) => <LeafletMapClient {...props} />;

export default MapView;
