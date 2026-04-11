import { useAppStore } from '../../store/appStore';

interface Props {
  title: string;
  actions?: React.ReactNode;
}

export function Header({ title, actions }: Props) {
  const { toggleSidebar } = useAppStore();
  return (
    <header className="flex items-center justify-between h-16 px-6 bg-white border-b border-gray-200 flex-shrink-0">
      <div className="flex items-center gap-3">
        <button onClick={toggleSidebar} className="text-gray-500 hover:text-gray-700 transition-colors" aria-label="Toggle sidebar">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <h1 className="page-title">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
