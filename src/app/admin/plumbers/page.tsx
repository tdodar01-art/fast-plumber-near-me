"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Search, ToggleLeft, ToggleRight, Loader2, ExternalLink } from "lucide-react";
import type { Plumber } from "@/lib/types";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function AdminPlumbersPage() {
  const [plumbers, setPlumbers] = useState<Plumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<{ id: string; name: string; isActive: boolean } | null>(null);

  useEffect(() => {
    async function fetch() {
      if (!db) { setLoading(false); return; }
      const q = query(collection(db, "plumbers"), orderBy("businessName"));
      const snap = await getDocs(q);
      setPlumbers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Plumber));
      setLoading(false);
    }
    fetch();
  }, []);

  async function toggleActive(id: string, current: boolean) {
    if (!db) return;
    await updateDoc(doc(db, "plumbers", id), { isActive: !current });
    setPlumbers((prev) => prev.map((p) => (p.id === id ? { ...p, isActive: !current } : p)));
  }

  const filtered = plumbers.filter(
    (p) =>
      p.businessName.toLowerCase().includes(search.toLowerCase()) ||
      p.phone.includes(search) ||
      p.address?.city?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Plumbers ({plumbers.length})</h1>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, phone, or city..."
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
                <th className="px-4 py-3 font-medium text-gray-600">Business</th>
                <th className="px-4 py-3 font-medium text-gray-600">Phone</th>
                <th className="px-4 py-3 font-medium text-gray-600">City</th>
                <th className="px-4 py-3 font-medium text-gray-600">Rating</th>
                <th className="px-4 py-3 font-medium text-gray-600">Tier</th>
                <th className="px-4 py-3 font-medium text-gray-600">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{p.businessName}</div>
                    {p.website && (
                      <a href={p.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 mt-0.5">
                        <ExternalLink className="w-3 h-3" /> Website
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.phone}</td>
                  <td className="px-4 py-3 text-gray-600">{p.address?.city}, {p.address?.state}</td>
                  <td className="px-4 py-3">
                    {p.googleRating ? (
                      <span className="text-gray-900">{p.googleRating} ({p.googleReviewCount})</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      p.listingTier === "featured" ? "bg-red-100 text-red-700" :
                      p.listingTier === "premium" ? "bg-blue-100 text-blue-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {p.listingTier}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setConfirm({ id: p.id, name: p.businessName, isActive: p.isActive })} className="text-gray-500 hover:text-primary">
                      {p.isActive ? <ToggleRight className="w-6 h-6 text-green-600" /> : <ToggleLeft className="w-6 h-6 text-gray-400" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-500">No plumbers found</div>
        )}
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.isActive ? "Deactivate Plumber?" : "Activate Plumber?"}
        message={
          confirm?.isActive
            ? `"${confirm.name}" will be hidden from all city pages.`
            : `"${confirm?.name}" will appear on city pages.`
        }
        confirmLabel={confirm?.isActive ? "Deactivate" : "Activate"}
        confirmVariant={confirm?.isActive ? "danger" : "success"}
        onConfirm={() => {
          if (confirm) toggleActive(confirm.id, confirm.isActive);
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
