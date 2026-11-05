import Image from "next/image";
import { BRAND } from "@/lib/brand";

interface BrandLogoProps {
  /**
   * "auto": mostra a variante certa para o tema (claro/escuro).
   * "onDark": força a variante para fundos escuros (ex.: ecrã de início de sessão).
   */
  variant?: "auto" | "onDark";
  className?: string;
  priority?: boolean;
}

export default function BrandLogo({
  variant = "auto",
  className = "",
  priority = false,
}: BrandLogoProps) {
  const { onDark, onLight, width, height } = BRAND.logo;
  const auto = variant === "auto";

  return (
    <>
      <Image
        src={onDark}
        alt={BRAND.name}
        width={width}
        height={height}
        priority={priority}
        className={`${auto ? "brand-logo-on-dark " : ""}${className}`}
      />
      {auto && (
        <Image
          src={onLight}
          alt={BRAND.name}
          width={width}
          height={height}
          priority={priority}
          className={`brand-logo-on-light ${className}`}
        />
      )}
    </>
  );
}
