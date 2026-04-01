export default function Loading() {
  return (
    <>
      <section className="bg-primary text-white py-10 sm:py-14">
        <div className="max-w-5xl mx-auto px-4">
          <div className="h-4 w-32 bg-blue-400/20 rounded mb-2 animate-pulse" />
          <div className="h-10 w-80 bg-blue-400/20 rounded mb-2 animate-pulse" />
          <div className="h-5 w-64 bg-blue-400/20 rounded animate-pulse" />
        </div>
      </section>
      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
        <div className="space-y-4 mb-12">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border-2 border-gray-200 p-6 animate-pulse">
              <div className="h-5 w-48 bg-gray-200 rounded mb-3" />
              <div className="h-7 w-64 bg-gray-200 rounded mb-3" />
              <div className="flex gap-2 mb-3">
                <div className="h-6 w-20 bg-gray-200 rounded-full" />
                <div className="h-6 w-16 bg-gray-200 rounded-full" />
                <div className="h-6 w-24 bg-gray-200 rounded-full" />
              </div>
              <div className="h-12 w-full bg-gray-200 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
