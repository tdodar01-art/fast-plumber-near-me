"use client";

import { useEffect, useState } from "react";
import { collection, getCountFromServer, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Wrench, MapPin, MousePointerClick, ClipboardList, Loader2 } from "lucide-react";

interface Stats {
  totalPlumbers: number;
  activePlumbers: number;
  totalCities: number;
  publishedCities: number;
  totalLeads: number;
  pendingSubmissions: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!db) {
        setLoading(false);
        return;
      }
      try {
        const [plumbers, active, cities, published, leads, submissions] = await Promise.all([
          getCountFromServer(collection(db, "plumbers")),
          getCountFromServer(query(collection(db, "plumbers"), where("isActive", "==", true))),
          getCountFromServer(collection(db, "cities")),
          getCountFromServer(query(collection(db, "cities"), where("isPublished", "==", true))),
          getCountFromServer(collection(db, "leads")),
          getCountFromServer(collection(db, "businessSubmissions")),
        ]);

        setStats({
          totalPlumbers: plumbers.data().count,
          activePlumbers: active.data().count,
          totalCities: cities.data().count,
          publishedCities: published.data().count,
          totalLeads: leads.data().count,
          pendingSubmissions: submissions.data().count,
        });
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!db) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
        <h2 className="font-bold text-yellow-800">Firebase Not Configured</h2>
        <p className="text-sm text-yellow-700 mt-1">
          Add your Firebase credentials to <code>.env.local</code> to enable the admin panel.
        </p>
      </div>
    );
  }

  const cards = [
    { label: "Total Plumbers", value: stats?.totalPlumbers ?? 0, sub: `${stats?.activePlumbers ?? 0} active`, icon: Wrench, color: "text-blue-600 bg-blue-50" },
    { label: "Cities", value: stats?.totalCities ?? 0, sub: `${stats?.publishedCities ?? 0} published`, icon: MapPin, color: "text-green-600 bg-green-50" },
    { label: "Lead Clicks", value: stats?.totalLeads ?? 0, sub: "call + website clicks", icon: MousePointerClick, color: "text-purple-600 bg-purple-50" },
    { label: "Submissions", value: stats?.pendingSubmissions ?? 0, sub: "pending review", icon: ClipboardList, color: "text-orange-600 bg-orange-50" },
  ];

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="text-sm text-gray-500">{card.label}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">{card.sub}</p>
          </div>
        ))}
      </div>
    </>
  );
}
