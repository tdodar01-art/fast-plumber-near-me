"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, ToggleLeft, ToggleRight, Search } from "lucide-react";
import type { City } from "@/lib/types";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function AdminCitiesPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<{ id: string; name: string; isPublished: boolean } | null>(null);

  useEffect(() => {
    async function fetch() {
      if (!db) { setLoading(false); return; }
      const q = query(collection(db, "cities"), orderBy("name"));
      const snap = await getDocs(q);
      setCities(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as City));
      setLoading(false);
    }
    fetch();
  }, []);

  async function togglePublished(id: string, current: boolean) {
    if (!db) return;
    await updateDoc(doc(db, "cities", id), { isPublished: !current });
    setCities((prev) => prev.map((c) => (c.id === id ? { ...c, isPublished: !current } : c)));
  }

  const filtered = cities.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.state.toLowerCase().includes(search.toLowerCase()) ||
      c.county?.toLowerCase().includes(search.toLowerCase())
  );

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
              {filtered.map((city) => (
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
