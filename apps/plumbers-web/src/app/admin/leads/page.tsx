"use client";

import { useEffect, useState } from "react";
import { Loader2, Phone, Globe, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import type { Lead } from "@/lib/types";
import { getLeads } from "@/lib/firestore";

const PAGE_SIZE = 25;

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    getLeads(500).then((data) => {
      setLeads(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const clickTypeIcon = { call: Phone, website: Globe, directions: MapPin };
  const totalPages = Math.ceil(leads.length / PAGE_SIZE);
  const paginated = leads.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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
              {paginated.map((lead) => {
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, leads.length)} of {leads.length}
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
    </>
  );
}
