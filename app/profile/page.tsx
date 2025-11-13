"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface UserProfile {
  wallet: string | null;
  nickname: string;
  email: string;
  profilePicture: string;
  lastNicknameChange: string | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    // Check wallet connection
    const checkWallet = async () => {
      try {
        if ((window as any).backpack?.publicKey) {
          setPublicKey((window as any).backpack.publicKey.toString());
        } else if ((window as any).solana?.publicKey) {
          setPublicKey((window as any).solana.publicKey.toString());
        } else {
          router.push('/'); // Redirect to home if not connected
        }
      } catch (e) {
        router.push('/');
      }
    };
    checkWallet();
  }, [router]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!publicKey) return;
      
      try {
        const response = await fetch(`/api/profile?wallet=${publicKey}`);
        const data = await response.json();
        
        if (data.profile) {
          setProfile(data.profile);
          setNewNickname(data.profile.nickname || '');
          setNewEmail(data.profile.email || '');
          if (data.profile.profilePicture) {
            setImagePreview(data.profile.profilePicture);
          }
        }
      } catch (e) {
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [publicKey]);

  const handleNicknameChange = async () => {
    if (!profile || !newNickname) return;

    // Check if 30 days have passed since last change
    if (profile.lastNicknameChange) {
      const lastChange = new Date(profile.lastNicknameChange);
      const daysElapsed = (Date.now() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysElapsed < 30) {
        setError('You can change your nickname again in ' + Math.ceil(30 - daysElapsed) + ' days');
        return;
      }
    }

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: publicKey,
          nickname: newNickname,
          type: 'nickname'
        })
      });

      const data = await response.json();
      if (data.success) {
        setProfile(prev => prev ? { ...prev, nickname: newNickname, lastNicknameChange: new Date().toISOString() } : null);
        setIsEditing(false);
      }
    } catch (e) {
      setError('Failed to update nickname');
    }
  };

  const handleEmailUpdate = async () => {
    if (!profile || !newEmail) return;

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: publicKey,
          email: newEmail,
          type: 'email'
        })
      });

      const data = await response.json();
      if (data.success) {
        setProfile(prev => prev ? { ...prev, email: newEmail } : null);
      }
    } catch (e) {
      setError('Failed to update email');
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="fixed top-4 left-4 z-50">
        <img src="/images/CARV-Logo.png" alt="CARV Logo" className="w-26 h-12 rounded" />
      </div>
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Profile</h1>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            ← Back to Predictions
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="bg-gray-800 rounded-xl p-6 space-y-6">
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-2 border-indigo-500 overflow-hidden">
                {uploadingImage ? (
                  <div className="w-full h-full flex items-center justify-center bg-gray-700">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-500 border-t-transparent"></div>
                  </div>
                ) : (
                  <img
                    src={imagePreview || profile?.profilePicture || '/images/default-avatar.png'}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <button
                className="absolute bottom-0 right-0 bg-indigo-600 p-2 rounded-full hover:bg-indigo-700 transition-colors"
                onClick={() => document.getElementById('profile-picture')?.click()}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <input
                id="profile-picture"
                type="file"
                accept="image/jpeg,image/png,image/gif"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  // Check file type
                  if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
                    setError('Please upload a valid image file (JPEG, PNG, or GIF)');
                    return;
                  }

                  // Check file size (max 5MB)
                  if (file.size > 5 * 1024 * 1024) {
                    setError('Image size must be less than 5MB');
                    return;
                  }

                  // Create preview
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setImagePreview(reader.result as string);
                  };
                  reader.readAsDataURL(file);

                  // Upload image
                  setUploadingImage(true);
                  setError('');

                  const formData = new FormData();
                  formData.append('image', file);
                  formData.append('wallet', publicKey || '');

                  try {
                    const response = await fetch('/api/profile/upload', {
                      method: 'POST',
                      body: formData,
                    });
                    const data = await response.json();
                    
                    if (data.error) {
                      setError(data.error);
                      return;
                    }
                    
                    if (data.success && data.url) {
                      // Update both the preview and the profile
                      setImagePreview(data.url);
                      setProfile(prev => prev ? { ...prev, profilePicture: data.url } : null);
                    } else {
                      setError('Failed to upload image');
                      // Reset preview if upload failed
                      setImagePreview(profile?.profilePicture || null);
                    }
                  } catch (e) {
                    setError('Failed to upload image. Please try again.');
                  } finally {
                    setUploadingImage(false);
                  }
                }}
              />
            </div>

            <div className="flex-1">
              <div className="space-y-2">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newNickname}
                      onChange={(e) => setNewNickname(e.target.value)}
                      className="bg-gray-700 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Enter nickname"
                    />
                    <button
                      onClick={handleNicknameChange}
                      className="px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setNewNickname(profile?.nickname || '');
                      }}
                      className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold">{profile?.nickname || 'Set a nickname'}</h2>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-indigo-400 hover:text-indigo-300"
                    >
                      ✏️
                    </button>
                  </div>
                )}
                <div className="text-sm text-gray-400">
                  {profile?.lastNicknameChange ? 
                    'Last changed ' + new Date(profile.lastNicknameChange).toLocaleDateString()
                    : 'Never changed'}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6 mt-8">
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Wallet Address</label>
              <div className="bg-gray-700 px-4 py-3 rounded-lg font-mono text-sm">
                {publicKey}
              </div>
            </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-400">Email Address</label>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
                      className="flex-1 bg-gray-700 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Enter your email"
                    />
                    <button
                      onClick={() => {
                        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                        if (!emailRegex.test(newEmail)) {
                          setError('Please enter a valid email address');
                          return;
                        }
                        handleEmailUpdate();
                      }}
                      className="px-4 py-3 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                      disabled={!newEmail || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(newEmail)}
                    >
                      Update
                    </button>
                  </div>
                  {newEmail && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(newEmail) && (
                    <div className="text-red-500 text-sm">Please enter a valid email address</div>
                  )}
                </div>
              </div>
          </div>
        </div>
      </div>
      
      {/* Footer with social links */}
      <div className="fixed bottom-6 right-6 flex items-center gap-2 bg-white rounded-lg p-3 shadow-lg">
        <a href="https://x.com/erxie0x" target="_blank" rel="noopener noreferrer" title="Follow on X">
          <img src="/images/twitter-logo.png" alt="Twitter" className="w-8 h-8 object-contain hover:scale-110 transition-transform cursor-pointer" />
        </a>
        <a href="https://play.carv.io/profile/erxie" target="_blank" rel="noopener noreferrer" title="View CARV Profile">
          <img src="/images/carv-profile-logo.png" alt="CARV Profile" className="w-8 h-8 object-contain hover:scale-110 transition-transform cursor-pointer" />
        </a>
      </div>
    </div>
  );
}