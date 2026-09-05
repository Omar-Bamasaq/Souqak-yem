import React from "react";

export default class RouteErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[Route] Rendering failed:", error, errorInfo);
  }

  handleRetry = () => {
    window.location.reload();
  };

  isChunkLoadError() {
    const message = this.state.error?.message || "";
    return /ChunkLoadError|dynamically imported module|Importing a module script failed|Loading chunk/i.test(message);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const isChunkLoadError = this.isChunkLoadError();

    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-6 text-center">
        <section className="max-w-md">
          <h1 className="text-xl font-bold text-gray-900">تعذر تحميل الصفحة</h1>
          <p className="mt-3 text-gray-600">حدثت مشكلة مؤقتة أثناء تحميل الصفحة المطلوبة.</p>
          {isChunkLoadError && (
            <button type="button" onClick={this.handleRetry} className="mt-6 ds-btn-primary px-6 py-3">
              إعادة المحاولة
            </button>
          )}
        </section>
      </main>
    );
  }
}
