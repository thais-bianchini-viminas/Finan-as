export default function Loading() {
  return (
    <div className="app" aria-busy="true" aria-label="Carregando">
      <div className="app-header" style={{ height: 190 }} />
      <div className="content stack-lg">
        <div className="skeleton" style={{ height: 300 }} />
        <div className="skeleton" style={{ height: 220 }} />
      </div>
    </div>
  );
}
