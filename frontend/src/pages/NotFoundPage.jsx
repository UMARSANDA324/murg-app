import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-900 text-white text-2xl font-bold mb-4">
          404
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Page not found</h1>
        <p className="text-sm text-slate-600 mb-6">
          The route you requested does not exist or is not available for your current access level.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
