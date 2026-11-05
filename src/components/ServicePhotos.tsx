"use client";

import { useEffect, useState } from "react";
import { fetchServiceRequestPhotos } from "@/lib/service-flow-api";

/** Fotos anexadas pelo cliente ao pedido (só leitura). Sem fotos, não mostra nada. */
export default function ServicePhotos({ requestId }: { requestId: string }) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchServiceRequestPhotos(requestId)
      .then((urls) => {
        if (!cancelled) setPhotos(urls);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  if (failed) return <p className="mt-3 text-xs text-danger">Não foi possível carregar as fotos.</p>;
  if (photos.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="text-xs text-contrast font-medium mb-2">Fotos ({photos.length})</p>
      <ul className="flex flex-wrap gap-2">
        {photos.map((url, i) => (
          <li key={url}>
            <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir foto ${i + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Foto ${i + 1} do pedido`}
                className="h-20 w-20 rounded-lg border border-border object-cover hover:opacity-80 transition-opacity"
              />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
