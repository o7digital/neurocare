import { useEffect, useState } from "react";
import { NewsletterPreview } from "./NewsletterEditors";
import { brandSetup, normalizeCampaign } from "./templates";
import type { NewsletterCampaign } from "./types";
export default function PublicAgenda() {
  const [campaign, setCampaign] = useState<NewsletterCampaign | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id || !/^[-a-f0-9]{36}$/.test(id)) {
      setError("Selecciona una agenda publicada por el equipo.");
      return;
    }
    const controller = new AbortController();
    void fetch(`/api/public/agenda/${id}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Esta agenda no está disponible.");
        setCampaign(normalizeCampaign(await response.json()));
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, []);
  if (error)
    return (
      <p className="agenda-message" role="status">
        {error}
      </p>
    );
  if (!campaign)
    return (
      <p className="agenda-message" role="status">
        Cargando agenda…
      </p>
    );
  return (
    <NewsletterPreview
      campaign={campaign}
      setup={brandSetup}
      mode={window.innerWidth < 640 ? "mobile" : "desktop"}
    />
  );
}
