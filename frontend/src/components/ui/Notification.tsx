import { useAppStore } from '../../store/appStore';

export function Notification() {
  const { notification, clearNotification } = useAppStore();
  if (!notification) return null;

  const colors = {
    success: 'bg-green-50 border-green-300 text-green-800',
    error:   'bg-red-50 border-red-300 text-red-800',
    info:    'bg-blue-50 border-blue-300 text-blue-800',
  };

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-md max-w-sm ${colors[notification.type]}`}>
      <span className="text-sm flex-1">{notification.message}</span>
      <button onClick={clearNotification} className="opacity-60 hover:opacity-100">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
