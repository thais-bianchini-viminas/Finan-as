export default function Loading() {
  return (
    <div className="app" aria-busy="true" aria-label="Carregando">
      <div className="topbar"><div className="skeleton" style={{ width: 180, height: 28 }} /></div>
      <div className="stack-lg">
        <div className="skeleton" style={{ height: 190 }} />
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    </div>
  );
}
