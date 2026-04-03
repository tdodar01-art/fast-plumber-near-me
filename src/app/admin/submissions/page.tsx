"use client";

import { useEffect, useState } from "react";
import { Timestamp } from "firebase/firestore";
import { Loader2, Check, X } from "lucide-react";
import { getBusinessSubmissions, deleteSubmission, createPlumber } from "@/lib/firestore";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Submission {
  id: string;
  businessName: string;
  phone: string;
  email: string;
  website: string;
  serviceCities: string[];
  services: string[];
  is24Hour: boolean;
  licenseNumber: string;
}

export default function AdminSubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<{ action: "approve" | "reject"; sub: Submission } | null>(null);

  useEffect(() => {
    getBusinessSubmissions().then((data) => {
      setSubmissions(data as unknown as Submission[]);
      setLoading(false);
    });
  }, []);

  async function approve(sub: Submission) {
    await createPlumber({
      businessName: sub.businessName,
      ownerName: "",
      phone: sub.phone,
      email: sub.email,
      website: sub.website || null,
      address: { street: "", city: "", state: "", zip: "", lat: 0, lng: 0 },
      serviceCities: sub.serviceCities || [],
      services: sub.services || [],
      is24Hour: sub.is24Hour || false,
      licenseNumber: sub.licenseNumber || null,
      insured: false,
      yearsInBusiness: null,
      verificationStatus: "unverified",
      reliabilityScore: 0,
      lastVerifiedAt: null,
      totalCallAttempts: 0,
      totalCallAnswered: 0,
      answerRate: 0,
      avgResponseTime: 0,
      listingTier: "free",
      googleRating: null,
      googleReviewCount: null,
      googlePlaceId: null,
      googleId: null,
      googleVerified: false,
      workingHours: null,
      category: "Plumber",
      isAreaService: false,
      photoUrl: null,
      logoUrl: null,
      description: null,
      businessStatus: "OPERATIONAL",
      bookingLink: null,
      social: { facebook: null, instagram: null },
      yelpRating: null,
      isActive: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      notes: "Approved from submission",
      lastReviewRefreshAt: null,
      reviewSynthesis: null,
      cachedFromGoogle: false,
    });
    await deleteSubmission(sub.id);
    setSubmissions((prev) => prev.filter((s) => s.id !== sub.id));
  }

  async function reject(id: string) {
    await deleteSubmission(id);
    setSubmissions((prev) => prev.filter((s) => s.id !== id));
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Business Submissions ({submissions.length})</h1>

      {submissions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          No pending submissions
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map((sub) => (
            <div key={sub.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{sub.businessName}</h3>
                  <p className="text-sm text-gray-600">{sub.phone} | {sub.email}</p>
                  {sub.website && <p className="text-xs text-primary mt-0.5">{sub.website}</p>}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {sub.services?.map((s) => (
                      <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{s}</span>
                    ))}
                  </div>
                  {sub.is24Hour && <span className="text-xs text-purple-700 font-medium mt-1 inline-block">24/7 Service</span>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirm({ action: "approve", sub })}
                    className="p-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors"
                    title="Approve"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setConfirm({ action: "reject", sub })}
                    className="p-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors"
                    title="Reject"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.action === "approve" ? "Approve Submission?" : "Reject Submission?"}
        message={
          confirm?.action === "approve"
            ? `This will create a plumber listing for "${confirm.sub.businessName}" and delete the submission.`
            : `This will permanently delete the submission from "${confirm?.sub.businessName}".`
        }
        confirmLabel={confirm?.action === "approve" ? "Approve" : "Reject"}
        confirmVariant={confirm?.action === "approve" ? "success" : "danger"}
        onConfirm={() => {
          if (confirm?.action === "approve") approve(confirm.sub);
          else if (confirm) reject(confirm.sub.id);
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
