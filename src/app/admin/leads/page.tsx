"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, Phone, Globe, MapPin } from "lucide-react";
import type { Lead } from "@/lib/types";

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      if (!db) { setLoading(false); return; }
      const q = query(collection(db, "leads"), orderBy("createdAt", "desc"), limit(200));
      const snap = await getDocs(q);
      setLeads(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Lead));
      setLoading(false);
    }
    fetch();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const clickTypeIcon = { call: Phone, website: Globe, directions: MapPin };

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Lead Clicks ({leads.length})</h1>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="px-4 py-3 font-medium text-gray-600">Plumber ID</th>
                <th className="px-4 py-3 font-medium text-gray-600">City</th>
                <th className="px-4 py-3 font-medium text-gray-600">Source</th>
                <th className="px-4 py-3 font-medium text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leads.map((lead) => {
                const Icon = clickTypeIcon[lead.clickType] || Phone;
                return (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-gray-700">
                        <Icon className="w-4 h-4" />
                        {lead.clickType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{lead.plumberId.slice(0, 20)}...</td>
                    <td className="px-4 py-3 text-gray-600">{lead.city}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{lead.source}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {lead.createdAt?.toDate?.() ? lead.createdAt.toDate().toLocaleDateString() : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {leads.length === 0 && (
          <div className="text-center py-8 text-gray-500">No leads yet</div>
        )}
      </div>
    </>
  );
}
