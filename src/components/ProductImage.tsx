const CATEGORY_ART: Record<string, { bg: string; accent: string; glyph: string }> = {
  medicine: { bg: "#d7efe4", accent: "#1c6e56", glyph: "M9 3a5 5 0 0 1 7.07 0l4.9 4.9a5 5 0 0 1-7.07 7.07l-4.9-4.9A5 5 0 0 1 9 3Zm1.4 1.42a3 3 0 0 0 0 4.24l2.48 2.48 4.24-4.24-2.48-2.48a3 3 0 0 0-4.24 0ZM3 15l4 4m-5 1a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z" },
  cold: { bg: "#dbeafe", accent: "#1d4ed8", glyph: "M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0ZM12 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" },
  vitamins: { bg: "#fef3c7", accent: "#b45309", glyph: "M12 2l2.1 5.6 5.9.5-4.5 3.9 1.4 5.8L12 14.6 7.1 17.8l1.4-5.8L4 8.1l5.9-.5L12 2Z" },
  skincare: { bg: "#fce7f3", accent: "#be185d", glyph: "M12 3s6 6.3 6 11a6 6 0 1 1-12 0c0-4.7 6-11 6-11Zm-2 11a2 2 0 0 0 2 2" },
  haircare: { bg: "#ede9fe", accent: "#6d28d9", glyph: "M6 3v18M10 3v18M6 3c0 6 4 6 4 0M6 7c0 6 4 6 4 0m4-4v18m4-18v18m-4-18c0 6 4 6 4 0m-4 4c0 6 4 6 4 0" },
  baby: { bg: "#fef9c3", accent: "#a16207", glyph: "M9 12h.01M15 12h.01M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-2-1c.5 1 1.2 1.5 2 1.5s1.5-.5 2-1.5" },
  devices: { bg: "#e0e7ff", accent: "#4338ca", glyph: "M4 8h16v10H4zM8 12h2m4 0h2M12 6V4m-6 16h12" },
  hygiene: { bg: "#d1fae5", accent: "#047857", glyph: "M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4Zm-3 10l2.2 2.2L15.5 10" },
};

export default function ProductImage({ category, name }: { category: string; name: string }) {
  const art = CATEGORY_ART[category] ?? CATEGORY_ART.medicine;
  return (
    <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-t-2xl" style={{ background: `linear-gradient(135deg, ${art.bg}, #ffffff)` }}>
      <div className="absolute -left-6 -top-6 size-24 rounded-full opacity-30" style={{ background: art.accent }} />
      <div className="absolute -bottom-8 -right-8 size-28 rounded-full opacity-20" style={{ background: art.accent }} />
      <svg viewBox="0 0 24 24" fill="none" stroke={art.accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="relative size-16 drop-shadow-sm" role="img" aria-label={name}>
        <path d={art.glyph} />
      </svg>
    </div>
  );
}
