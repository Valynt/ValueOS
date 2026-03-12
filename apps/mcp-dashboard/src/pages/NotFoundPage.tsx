import React from "react";
import { Link } from "react-router-dom";

const NotFoundPage: React.FC = () => {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <section className="max-w-md text-center">
        <p className="text-sm font-semibold text-gray-500 tracking-wide uppercase">Error 404</p>
        <h1 className="mt-3 text-3xl font-bold text-gray-900">Page not found</h1>
        <p className="mt-4 text-gray-600">
          The route you requested does not exist or may have been moved.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex mt-8 rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700"
        >
          Go to dashboard
        </Link>
      </section>
    </main>
  );
};

export default NotFoundPage;
