import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin } from "lucide-react";
import GemeentePublicaties from "@/components/GemeentePublicaties";

const ExternGemeenteDetailPage = () => {
  const { gemeente } = useParams<{ gemeente: string }>();
  const navigate = useNavigate();
  const decodedGemeente = gemeente ? decodeURIComponent(gemeente) : "";

  if (!decodedGemeente) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Gemeente niet gevonden.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/extern")}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-xl sm:text-2xl font-bold font-display flex items-center gap-2">
          <MapPin size={20} className="text-brand-red" />
          {decodedGemeente}
        </h2>
      </div>

      <GemeentePublicaties gemeentenaam={decodedGemeente} />
    </div>
  );
};

export default ExternGemeenteDetailPage;
