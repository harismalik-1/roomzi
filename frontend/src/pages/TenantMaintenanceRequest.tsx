import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, UploadCloud } from "lucide-react";

const TenantMaintenanceRequest: React.FC = () => {
  const { user } = useAuth();
  const { listingId } = useParams();
  const navigate = useNavigate();
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [landlordId, setLandlordId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch landlordId for the current listing
  useEffect(() => {
    if (!listingId) return;
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/listings/${listingId}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.data && data.data.landlord_id) {
          setLandlordId(data.data.landlord_id);
        }
      });
  }, [listingId]);

  // Fetch previous requests
  useEffect(() => {
    if (!user?.id) return;
    setFetching(true);
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/maintenance-requests/tenant/${user.id}`)
      .then(res => res.json())
      .then(data => {
        console.log('Fetched requests:', data.requests || data);
        setRequests(data.requests || []);
      })
      .finally(() => setFetching(false));
  }, [user?.id]);

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description) return alert("Description is required");
    if (!landlordId) return alert("Could not determine landlord for this property.");
    setLoading(true);

    const formData = new FormData();
    formData.append("tenantId", user.id);
    formData.append("landlordId", landlordId);
    formData.append("listingId", listingId || "");
    formData.append("description", description);
    images.forEach((img) => formData.append("images", img));

    const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/maintenance-requests`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (data.success) {
      setRequests([data.request, ...requests]);
      setDescription("");
      setImages([]);
    } else {
      alert(data.error || "Failed to submit request");
    }
    setLoading(false);
  };

  // Handle file input click
  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Header with back button */}
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/tenant/my-house')} className="mr-2">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-2xl font-bold">Submit Maintenance Request</h1>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 mb-10 bg-white p-6 rounded shadow">
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          className="w-full border rounded p-2 mb-2 min-h-[80px]"
          placeholder="Describe the issue..."
          value={description}
          onChange={e => setDescription(e.target.value)}
          required
        />
        <label className="block text-sm font-medium text-gray-700 mb-1">Upload Images</label>
        <div className="flex items-center gap-2 mb-2">
          <input
            type="file"
            multiple
            accept="image/*"
            ref={fileInputRef}
            onChange={e => setImages(Array.from(e.target.files || []))}
            className="hidden"
          />
          <Button type="button" variant="outline" onClick={handleFileButtonClick} className="flex items-center gap-2">
            <UploadCloud className="w-4 h-4" />
            Choose Files
          </Button>
          <span className="text-xs text-gray-500">{images.length > 0 ? `${images.length} file(s) selected` : "No files selected"}</span>
        </div>
        <div className="flex gap-2 flex-wrap mb-2">
          {images.map((img, idx) => (
            <span key={idx} className="text-xs bg-gray-100 px-2 py-1 rounded border border-gray-200">
              {img.name}
            </span>
          ))}
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</> : "Submit Request"}
        </Button>
      </form>

      <h2 className="text-xl font-semibold mb-4">Previous Requests</h2>
      <div className="space-y-4">
        {fetching ? (
          <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading requests...</div>
        ) : requests.length === 0 ? (
          <p className="text-gray-500">No requests yet.</p>
        ) : (
          requests.map(req => (
            <Card key={req.id} className="p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-gray-900">{req.description}</span>
                <Badge className={
                  req.status === 'Completed' ? 'bg-green-100 text-green-800' :
                  req.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                  req.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }>{req.status}</Badge>
              </div>
              {req.images && req.images.length > 0 && (
                <div className="flex gap-2 flex-wrap mb-2">
                  {req.images.map((img: string, idx: number) => (
                    <img key={idx} src={`http://localhost:3001${img}`} alt="maintenance" className="w-20 h-20 object-cover rounded border" />
                  ))}
                </div>
              )}
              <div className="text-xs text-gray-500 mt-2">
                Submitted: {new Date(req.createdAt).toLocaleString()}
              </div>
              {req.landlordcomment && (
                <div className="mb-2 text-sm text-gray-700 bg-gray-50 p-2 rounded">
                  <span className="font-semibold">Landlord Comment:</span> {req.landlordcomment}
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default TenantMaintenanceRequest;