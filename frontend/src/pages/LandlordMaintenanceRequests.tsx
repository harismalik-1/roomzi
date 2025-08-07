// frontend/src/pages/LandlordMaintenanceRequests.tsx
import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Wrench, AlertCircle, X } from "lucide-react";
import { useNavigate } from "react-router-dom";


const statusOptions = ["Pending", "In Progress", "Completed", "Rejected"];

const statusColors = {
  "Pending": "bg-blue-100 text-blue-800",
  "In Progress": "bg-yellow-100 text-yellow-800",
  "Completed": "bg-green-100 text-green-800",
  "Rejected": "bg-red-100 text-red-800"
};

const LandlordMaintenanceRequests: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [modal, setModal] = useState<{id: number, action: string} | null>(null);
  const [comment, setComment] = useState("");
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRequests = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/maintenance-requests/landlord/${user.id}`);
        const data = await response.json();
        
        if (data.success && data.requests) {
          setRequests(data.requests);
          setPendingCount(data.requests.filter((r: any) => r.status === 'Pending').length);
        } else {
          console.error('Error fetching maintenance requests:', data.error);
          setRequests([]);
          setPendingCount(0);
        }
      } catch (error) {
        console.error('Error fetching maintenance requests:', error);
        setRequests([]);
        setPendingCount(0);
      }
      setLoading(false);
    };
    fetchRequests();
  }, [user?.id]);

  useEffect(() => {
    localStorage.setItem('maintenance_last_seen', Date.now().toString());
  }, []);

  const handleStatusChange = async (id: number, status: string) => {
    if (status === 'Rejected' || status === 'Completed') {
      setModal({ id, action: status });
      setComment("");
      return;
    }
    // For Pending/In Progress, update directly
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/maintenance-requests/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setRequests(requests.map(r => r.id === id ? { ...r, status } : r));
        setPendingCount(requests.filter(r => r.id !== id && r.status === 'Pending').length + (status === 'Pending' ? 1 : 0));
      } else {
        alert(data.error || "Failed to update status");
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert("Failed to update status");
    }
  };

  // Handle modal submit for Rejected/Completed
  const handleModalSubmit = async () => {
    if (!modal) return;
    setUploading(true);
    
    try {
      const response = await fetch(`http://localhost:3001/api/maintenance-requests/${modal.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          status: modal.action, 
          landlordcomment: comment 
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setRequests(requests.map(r => r.id === modal.id ? { ...r, status: modal.action, landlordcomment: comment } : r));
        setPendingCount(requests.filter(r => r.id !== modal.id && r.status === 'Pending').length);
        setModal(null);
      } else {
        alert(data.error || "Failed to update status");
      }
    } catch (error) {
      console.error('Error updating maintenance request:', error);
      alert("Failed to update status");
    }
    
    setUploading(false);
  };



  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header with back button */}
      <div className="flex items-center mb-8">
        <Button variant="ghost" size="sm" onClick={() => navigate('/landlord')} className="mr-2">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wrench className="w-6 h-6 text-roomzi-blue" />
          Tenant Maintenance Requests
        </h1>
      </div>
      {/* Notification banner for pending requests */}
      {pendingCount > 0 && (
        <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded mb-6 flex items-center gap-2 shadow">
          <AlertCircle className="w-5 h-5" />
          {pendingCount} maintenance request{pendingCount > 1 ? 's are' : ' is'} pending!
          <Button size="sm" variant="link" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            View
          </Button>
        </div>
      )}
      {loading ? (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading requests...
        </div>
      ) : requests.length === 0 ? (
        <p className="text-gray-500">No maintenance requests yet.</p>
      ) : (
        <div className="space-y-6">
          {requests.map(req => (
            <Card key={req.id} className="p-6 flex flex-col md:flex-row gap-6 items-start shadow-md border border-gray-200">
              {/* Image section */}
              {req.images && req.images.length > 0 && (
                <div className="flex-shrink-0 flex flex-col gap-2">
                  {req.images.map((img: string, idx: number) => (
                    <img key={idx} src={img.startsWith('http') ? img : `http://localhost:3001${img}`} alt="maintenance" className="w-28 h-28 object-cover rounded border" />
                  ))}
                </div>
              )}
              {/* Details section */}
              <div className="flex-1 w-full">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-2 gap-2">
                  <span className="font-semibold text-lg text-gray-900">{req.description}</span>
                  <Badge className={statusColors[req.status] || 'bg-gray-100 text-gray-800'}>{req.status}</Badge>
                </div>
                <div className="text-xs text-gray-500 mb-4">
                  Submitted: {new Date(req.createdAt).toLocaleString()}
                </div>
                {/* Show landlord comment */}
                {req.landlordcomment && (
                  <div className="mb-2 text-sm text-gray-700 bg-gray-50 p-2 rounded">
                    <span className="font-semibold">Landlord Comment:</span> {req.landlordcomment}
                  </div>
                )}
                <div className="flex flex-col md:flex-row md:items-center gap-2">
                  <span className="text-sm font-medium">Update status:</span>
                  <div className="flex gap-2 flex-wrap">
                    {statusOptions.map(opt => (
                      <Button
                        key={opt}
                        size="sm"
                        variant={req.status === opt ? "default" : "outline"}
                        className={req.status === opt ? "bg-blue-200 text-blue-900" : ""}
                        disabled={req.status === opt}
                        onClick={() => handleStatusChange(req.id, opt)}
                      >
                        {opt}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {/* Modal for comment only (no file upload) */}
      {modal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md relative">
            <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-600" onClick={() => setModal(null)}><X /></button>
            <h2 className="text-lg font-bold mb-4">{modal.action === 'Rejected' ? 'Reject Request' : 'Mark as Completed'}</h2>
            <label className="block text-sm font-medium mb-1">Comment</label>
            <textarea
              className="w-full border rounded p-2 mb-4 min-h-[60px]"
              placeholder={modal.action === 'Rejected' ? 'Reason for rejection...' : 'Describe the work done...'}
              value={comment}
              onChange={e => setComment(e.target.value)}
              required
            />
            <Button onClick={handleModalSubmit} disabled={uploading || (modal.action === 'Rejected' && !comment)} className="w-full">
              {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</> : 'Submit'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandlordMaintenanceRequests;