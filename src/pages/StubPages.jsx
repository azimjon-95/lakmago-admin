function Stub({ icon, title }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <i className={`ti ${icon} text-5xl text-muted`} aria-hidden="true" />
      <div className="text-lg font-medium text-ink mt-4">{title}</div>
      <p className="text-sm text-muted mt-1.5">Bu bo‘lim keyingi bosqichda tayyorlanadi.</p>
    </div>);

}

export const PromosPage = () => <Stub icon="ti-discount-2" title="Aksiyalar" />;
export const StatsPage = () => <Stub icon="ti-chart-bar" title="Statistika" />;
export const SettingsPage = () => <Stub icon="ti-settings" title="Sozlamalar" />;
