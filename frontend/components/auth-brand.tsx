/**
 * The brand block above every auth card. The tagline varies by page (signup
 * welcomes you to the pack, the error pages say nothing at all), so it is a
 * prop rather than something the layout can own.
 */
export function AuthBrand({ tagline }: { tagline?: string }) {
  return (
    <div className="text-center mb-8">
      <div className="text-6xl mb-4">🐕</div>
      <h1 className="text-3xl font-bold text-foreground mb-2">RooRooRoo</h1>
      {tagline && <p className="text-muted-foreground">{tagline}</p>}
    </div>
  );
}
