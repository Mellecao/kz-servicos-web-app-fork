/**
 * Fonte única das constantes da marca "Só Serviços" no painel.
 *
 * Valores de public/brand/brand.json. Os tokens equivalentes para classes
 * Tailwind (bg-primary, text-on-primary, ...) vivem em src/app/globals.css
 * (@theme) e têm de ficar em sincronia com este ficheiro.
 *
 * Usar BRAND.colors.* sempre que uma cor tiver de ir em estilo inline ou em
 * gráficos (onde não há classe Tailwind); nunca escrever o hex à mão.
 */
export const BRAND = {
  name: "Só Serviços",
  tagline: "Serviços de apoio ao domicílio",
  adminTitle: "Painel administrativo",
  colors: {
    primary: "#FF9A52",
    primaryDark: "#E68B4A",
    primaryLight: "#FFB27A",
    pink: "#E54C65",
    /** Texto sobre a cor primária (nunca branco: contraste fraco). */
    onPrimary: "#1F2430",
  },
  gradient: "linear-gradient(90deg, #E54C65 0%, #FF9A52 100%)",
  logo: {
    /** Para fundos escuros. */
    onDark: "/brand/logo-horizontal-white.png",
    /** Para fundos claros. */
    onLight: "/brand/logo-horizontal-dark.png",
    width: 1541,
    height: 395,
  },
} as const;
