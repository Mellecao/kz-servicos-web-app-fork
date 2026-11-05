/** Selo para prestadores fictícios (provider_profiles.is_demo): existem só para a demonstração. */
export default function DemoBadge({ className = "" }: { className?: string }) {
  return (
    <span
      title="Prestador fictício, só para demonstração"
      className={`inline-flex shrink-0 items-center rounded-full bg-[#8B5CF6]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#8B5CF6] ${className}`}
    >
      Demo
    </span>
  );
}
