import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Home, Image, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { useParams, useLocation } from 'react-router-dom';

const CreateListing = () => {
  const { user } = useAuth();
  const { currentListing } = useParams();
  const location = useLocation();
  const editListing = location.state?.listing;
  const [newImages, setNewImages] = useState<File[]>([]);

  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: editListing?.title || '',
    type: editListing?.type || 'room',
    address: editListing?.address || '',
    city: editListing?.city || '',
    state: editListing?.state || '',
    zipCode: editListing?.zip_code || '',
    bedrooms: editListing?.bedrooms || 1,
    bathrooms: editListing?.bathrooms || 1,
    area: editListing?.area || '',
    price: editListing?.price || '',
    description: editListing?.description || '',
    leaseType: editListing?.lease_type || 'long-term',
    amenities: editListing?.amenities || [],
    requirements: editListing?.requirements || '',
    houseRules: editListing?.house_rules || '',
    images: (() => {
      try {
        return JSON.parse(editListing?.images);
      } catch (error) {
        return [];
      }
    })() as (string | File)[],
    landlordId: user.id
  });

  const propertyTypes = [
    { value: 'room', label: 'Room' },
    { value: 'apartment', label: 'Apartment' },
    { value: 'house', label: 'House' },
    { value: 'condo', label: 'Condo' }
  ];

  const commonAmenities = [
    'WiFi', 'Kitchen', 'Laundry', 'Parking', 'Balcony', 'Gym', 
    'Pool', 'Concierge', 'Pet Friendly', 'Garden', 'Storage'
  ];

  const searchAddress = async (query: string) => {
    if (!query) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&dedupe=1&addressdetails=1&countrycodes=ca,us&q=${encodeURIComponent(query)}`,
        {
          headers: {
            'User-Agent': 'Roomzi/1.0' // Required by Nominatim
          }
        }
      )

      if (!response.ok) {
        throw new Error("Failed to fetch address suggsestions");
      }

      const data = await response.json();
      setAddressSuggestions(data);
      setShowSuggestions(true);
    } catch (error) {
      console.error("Error fetching address suggestions:", error);
      setAddressSuggestions([]);
    } finally {
      setSearching(false);
    }
  }

  const handleSelectAddress = (suggestion: any) => {
    if (!suggestion || !suggestion.address) return;

    console.log("Selecting address:", suggestion);
    const address = suggestion.address;

    setFormData(prev => ({
      ...prev,
      address: (address.house_number || '') + ' ' + (address.road || ''),
      city: address.city || address.town || address.village || '',
      state: address.state || '',
      zipCode: address.postcode || '',
    }));

    setShowSuggestions(false);
    setAddressSuggestions([]);
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (formData.address && formData.address.length > 2) {
        searchAddress(formData.address);
      } else {
        setAddressSuggestions([]);
        setShowSuggestions(false);
      }
    }, 1000); // Delay by 1 second due to limits with Nominatim

    return () => clearTimeout(timeout);
  }, [formData.address]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAmenityToggle = (amenity: string) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  };

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files).filter(file => file instanceof File);
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...newFiles]
      }));

      if (editListing) {
        setNewImages(newFiles);
        console.log("New images:", newImages);
      }
    }
  };

  const handleDeleteFile = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const uploadImages = async (files: File[]) => {
    const imageUrls: string[] = [];
    
    for (let file of files) {
      const path = `images/${Date.now()}_${file.name}`;
      console.log("Uploading image to path:", path);

      // Check if buckets exist
      const { data: buckets, error: bucketsError } = await supabase
        .storage
        .listBuckets();

      if (bucketsError) {
        console.error(bucketsError);
        throw new Error("Failed to check storage buckets");
      }

      // Check if listings bucket exists
      const listingsBucket = buckets.find(b => b.name === 'listings');
      if (!listingsBucket) {
        throw new Error("Storage bucket 'listings' does not exist.");
      }

      const { error: uploadError } = await supabase.storage
        .from('listings')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error(uploadError);
        throw uploadError;
      }

      const { data } = supabase.storage.from('listings').getPublicUrl(path);
      imageUrls.push(data.publicUrl);
    }

    return imageUrls;
  };

  const validateAddress = async () => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&street=${formData.address}&city=${formData.city}&state=${formData.state}&postalcode=${formData.zipCode}`,
        {
          headers: {
            'User-Agent': 'Roomzi/1.0' // Required by Nominatim
          }
        }
      )

      if (!response.ok) {
        throw new Error("Failed to validate address");
      }

      const data = await response.json();
      if (data && data.length > 0) {
        setAddressError(null);
        return true;
      } else {
        setAddressError("Please enter a valid address");
        return false;
      }
    } catch (error) {
      console.error("Error validating address:", error);
      setAddressError("The address could not be validated");
      return false;
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isValid = await validateAddress();
    if (!isValid) {
      document.getElementById('address')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      console.log("Address is not valid");
      return;
    }

    if (currentListing && editListing) {
      console.log("Editing listing", currentListing);

      try {
        let imageUrls = formData.images.filter(
          (img): img is string => typeof img === "string" && img.trim() !== ""
        ) || [];
        
        console.log("Image URLs:", imageUrls);

        if (newImages.length > 0) {
          const newImageUrls = await uploadImages(newImages);
          imageUrls = [...imageUrls, ...newImageUrls];
        }

        const payload = {
          ...formData,
          images: JSON.stringify(imageUrls)
        };
        
        console.log('Updating listing:', payload);

        const response = await fetch(`http://localhost:3001/api/listings/${currentListing}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to edit listing.');
        }

        const result = await response.json();
        console.log('Listing edited successfully:', result);

        navigate('/landlord');
      } catch (error) {
        console.error('Error editing listing:', error);
        alert(error.message || 'Failed to edit listing.');
      }

      const result = await response.json();
      console.log('Listing created successfully:', result);
      
      // Log coordinates if available
      if (result.listing && result.listing.coordinates) {
        console.log('📍 Generated coordinates:', result.listing.coordinates);
      } else {
        console.log('⚠️ No coordinates generated for the listing');
      }
    } else {
      console.log("Creating listing");

      try {
        let imageUrls = [];

        if (formData.images.length > 0) {
          imageUrls = await (formData.images);
        }

        const payload = {
          ...formData,
          images: imageUrls
        };
        
        console.log('Creating listing:', payload);

        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/landlord/create-listing`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create listing.');
        }

        const result = await response.json();
        console.log('Listing created successfully:', result);

        navigate('/landlord');
      } catch (error) {
        console.error('Error creating listing:', error);
        alert(error.message || 'Failed to create listing.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/landlord')}
              className="flex items-center"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-2xl font-bold text-roomzi-blue">{currentListing ? "Edit Listing" : "Create Listing"}</h1>
            <div className="w-32"></div> {/* Spacer for centering */}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-6">Basic Information</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="title">Property Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="e.g., Cozy Downtown Studio"
                  required
                />
              </div>
              <div>
                <Label htmlFor="type">Property Type</Label>
                <select
                  id="type"
                  value={formData.type}
                  onChange={(e) => handleInputChange('type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-roomzi-blue"
                  required
                >
                  {propertyTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {/* Location */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-6">Location</h2>
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-700">
                📍 <strong>Note:</strong> Coordinates will be automatically generated from your address to display the property on the map.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <Label htmlFor="address">Street Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="123 Main Street"
                  required
                  className={addressError ? "border-red-500" : ""}
                />
                {/* Address Suggestions */}
                {showSuggestions && addressSuggestions.length > 0 && (
                  <div className='border border-2 rounded-md'>
                    {addressSuggestions.map((suggestion, index) => (
                      <Button 
                        className="w-full bg-white text-gray-700 hover:bg-blue-100"
                        key={index} 
                        onClick={() => handleSelectAddress(suggestion)}
                      >
                        <div className="font-medium text-sm w-full text-wrap text-left">{suggestion.display_name}</div>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  placeholder="San Francisco"
                  required
                  className={addressError ? "border-red-500" : ""}
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                  placeholder="CA"
                  required
                  className={addressError ? "border-red-500" : ""}
                />
              </div>
              <div>
                <Label htmlFor="zipCode">ZIP Code</Label>
                <Input
                  id="zipCode"
                  value={formData.zipCode}
                  onChange={(e) => handleInputChange('zipCode', e.target.value)}
                  placeholder="94102"
                  required
                  className={addressError ? "border-red-500" : ""}
                />
              </div>
            </div>
            {addressError && (
              <div className="text-red-500 text-sm mt-2">
                {addressError}
              </div>
            )}
          </Card>

          {/* Property Details */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-6">Property Details</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <Label htmlFor="bedrooms">Bedrooms</Label>
                <select
                  id="bedrooms"
                  value={formData.bedrooms}
                  onChange={(e) => handleInputChange('bedrooms', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-roomzi-blue"
                >
                  {[1, 2, 3, 4, 5].map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="bathrooms">Bathrooms</Label>
                <select
                  id="bathrooms"
                  value={formData.bathrooms}
                  onChange={(e) => handleInputChange('bathrooms', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-roomzi-blue"
                >
                  {[1, 1.5, 2, 2.5, 3, 3.5, 4].map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="area">Area (sq ft)</Label>
                <Input
                  id="area"
                  type="number"
                  value={formData.area}
                  onChange={(e) => handleInputChange('area', e.target.value)}
                  placeholder="800"
                  required
                />
              </div>
            </div>
          </Card>

          {/* Pricing */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-6">Pricing</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="price">Monthly Rent ($)</Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => handleInputChange('price', e.target.value)}
                  placeholder="2500"
                  required
                />
              </div>
              <div>
                <Label htmlFor="leaseType">Lease Type</Label>
                <select
                  id="leaseType"
                  value={formData.leaseType}
                  onChange={(e) => handleInputChange('leaseType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-roomzi-blue"
                >
                  <option value="long-term">Long-term</option>
                  <option value="short-term">Short-term</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Description */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-6">Description</h2>
            <Textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Describe your property, highlight key features, location benefits..."
              rows={4}
              required
            />
          </Card>

          {/* Amenities */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-6">Amenities</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {commonAmenities.map(amenity => (
                <label key={amenity} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.amenities.includes(amenity)}
                    onChange={() => handleAmenityToggle(amenity)}
                    className="rounded text-roomzi-blue focus:ring-roomzi-blue"
                  />
                  <span className="text-sm">{amenity}</span>
                </label>
              ))}
            </div>
          </Card>

          {/* Requirements & Rules */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-6">Tenant Requirements & House Rules</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="requirements">Tenant Requirements</Label>
                <Textarea
                  id="requirements"
                  value={formData.requirements}
                  onChange={(e) => handleInputChange('requirements', e.target.value)}
                  placeholder="e.g., Good credit score, No smoking, Proof of income..."
                  rows={4}
                />
              </div>
              <div>
                <Label htmlFor="houseRules">House Rules</Label>
                <Textarea
                  id="houseRules"
                  value={formData.houseRules}
                  onChange={(e) => handleInputChange('houseRules', e.target.value)}
                  placeholder="e.g., No pets, Quiet hours 10pm-8am, No parties..."
                  rows={4}
                />
              </div>
            </div>
          </Card>

          {/* Photos */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-6">Photos</h2>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <Image className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 mb-2">Upload property photos</p>
              <p className="text-sm text-gray-500">Drag and drop or click to browse</p>
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                Choose Files
              </Button>
              <input
                id="file-upload"
                type="file"
                accept="image/*"
                multiple
                onChange={handleUploadFile}
                style={{ display: 'none' }}
              />
              <div className="mt-8">
                {formData.images.length > 0 && (
                  <ul className="grid grid-cols-4 gap-4">
                    {formData.images.map((file, index) => {
                      let src: string | null;

                      if (file instanceof File) {
                        src = URL.createObjectURL(file);
                      } else if (typeof file === 'string') {
                        src = file;
                      }

                      if (!src) return null;
                      
                      return (
                        <Card key={index} className="relative shadow-sm">
                          <img src={src} className="w-full h-40 object-contain" />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteFile(index)}
                            className="text-red-500 hover:bg-red-500 hover:text-white absolute top-0 right-0"
                          >
                            <X />
                          </Button>
                        </Card>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </Card>

          {/* Submit */}
          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={() => navigate('/landlord')}>
              Cancel
            </Button>
            <Button type="submit" className="roomzi-gradient">
              <Home className="w-4 h-4 mr-2" />
              {currentListing ? "Save Changes" : "Create Listing"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateListing;
