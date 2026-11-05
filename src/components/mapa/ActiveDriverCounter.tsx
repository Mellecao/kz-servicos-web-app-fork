interface ActiveDriverCounterProps {
  count: number;
}

export default function ActiveDriverCounter({ count }: ActiveDriverCounterProps) {
  const label = count === 1 ? "motorista ativo" : "motoristas ativos";
  return (
    <span className="text-sm text-contrast">
      <strong className="text-dark font-semibold">{count}</strong> {label}
    </span>
  );
}
