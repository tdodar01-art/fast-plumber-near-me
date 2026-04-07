"use client";

import { useEffect, useState } from "react";
import { Loader2, ToggleLeft, ToggleRight, Search, ChevronLeft, ChevronRight } from "lucide-react";
import type { City } from "@/lib/types";
import { getAllCities, updateCity } from "@/lib/firestore";
import ConfirmDialog from "@/components/ConfirmDialog";

const PAGE_SIZE = 25;

export default function AdminCitiesPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [confirm, setConfirm] = useState<{ id: string; name: string; isPublished: boolean } | null>(null);

  useEffect(() => {
    getAllCities().then((data) => {
      setCities(data);
      setLoading(false);
    });
  }, []);

  async function togglePublished(id: string, current: boolean) {
    await updateCity(id, { isPublished: !current });
    setCities((prev) => prev.map((c) => (c.id === id ? { ...c, isPublished: !current } : c)));
  }

  const filtered = cities.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.state.toLowerCase().includes(search.toLowerCase()) ||
      c.county?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => { setPage(0); }, [search]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Cities ({cities.length})</h1>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by city, state, or county..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:border-primary focus:outline-none text-sm text-gray-900"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600">City</th>
                <th className="px-4 py-3 font-medium text-gray-600">State</th>
                <th className="px-4 py-3 font-medium text-gray-600">County</th>
                <th className="px-4 py-3 font-medium text-gray-600">Plumbers</th>
                <th className="px-4 py-3 font-medium text-gray-600">Published</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginated.map((city) => (
                <tr key={city.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{city.name}</td>
                  <td className="px-4 py-3 text-gray-600">{city.state}</td>
                  <td className="px-4 py-3 text-gray-600">{city.county}</td>
                  <td className="px-4 py-3 text-gray-600">{city.plumberCount}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setConfirm({ id: city.id, name: city.name, isPublished: city.isPublished })}>
                      {city.isPublished ? <ToggleRight className="w-6 h-6 text-green-600" /> : <ToggleLeft className="w-6 h-6 text-gray-400" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-500">No cities found</div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="p-2 rounded-lg border border-gray-300 disabled:opacity-40">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-2 rounded-lg border border-gray-300 disabled:opacity-40">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.isPublished ? "Unpublish City?" : "Publish City?"}
        message={
          confirm?.isPublished
            ? `"${confirm.name}" will be removed from the public directory.`
            : `"${confirm?.name}" will appear in the public directory.`
        }
        confirmLabel={confirm?.isPublished ? "Unpublish" : "Publish"}
        confirmVariant={confirm?.isPublished ? "danger" : "success"}
        onConfirm={() => {
          if (confirm) togglePublished(confirm.id, confirm.isPublished);
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
