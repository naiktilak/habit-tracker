import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { handleAuthCallback } from '../services/fitbitService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebaseService';
import { User } from '../types';
import { Icons } from './Icons';

const FitbitCallback: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Connecting to Fitbit...');

    useEffect(() => {
        const processCallback = async () => {
            // Log for debugging
            console.log('FitbitCallback mounted');
            console.log('Hash:', location.hash);
            console.log('Search:', location.search);

            if (!user) {
                // Wait for user to be loaded (handled by AuthContext, but if null initially)
                // If user is not logged in, we can't link.
                // However, AuthContext usually redirects to login if not auth.
                // We'll wait a bit or show error.
                setMessage('Waiting for user session...');
                return;
            }

            try {
                // Parse Hash (Implicit Grant)
                const hash = location.hash;
                const search = location.search;

                // Check for errors in Search or Hash
                const params = new URLSearchParams(hash.replace('#', '?'));
                const searchParams = new URLSearchParams(search);

                const error = params.get('error') || searchParams.get('error');
                const errorDescription = params.get('error_description') || searchParams.get('error_description');

                if (error) {
                    throw new Error(errorDescription || error);
                }

                // Check for Access Token
                if (hash.includes('access_token')) {
                    setMessage('Linking Fitbit account...');

                    // We need the full Firestore user object for handleAuthCallback
                    // (It updates connectedApps in the user doc)
                    const userRef = doc(db, "users", user.uid);
                    const snap = await getDoc(userRef);

                    if (!snap.exists()) {
                        throw new Error("User profile not found.");
                    }

                    const currentUser = snap.data() as User;

                    const success = await handleAuthCallback(hash, currentUser);

                    if (success) {
                        setStatus('success');
                        setMessage('Successfully connected! Redirecting...');
                        setTimeout(() => {
                            navigate('/');
                        }, 2000);
                    } else {
                        throw new Error("Failed to process access token.");
                    }
                } else {
                    throw new Error("No access token found in URL.");
                }
            } catch (err: any) {
                console.error("Fitbit Auth Error:", err);
                setStatus('error');
                setMessage(err.message || "An unknown error occurred.");
                setTimeout(() => {
                    navigate('/');
                }, 4000);
            }
        };

        if (user) {
            processCallback();
        }
    }, [user, location, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
                {status === 'loading' && (
                    <div className="flex flex-col items-center gap-4">
                        <Icons.Activity className="w-12 h-12 text-indigo-600 animate-spin" />
                        <h2 className="text-xl font-semibold text-gray-800">Connecting Fitbit</h2>
                        <p className="text-gray-500">{message}</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                            <Icons.Check className="w-6 h-6 text-green-600" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-800">Connected!</h2>
                        <p className="text-gray-500">{message}</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                            <Icons.X className="w-6 h-6 text-red-600" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-800">Connection Failed</h2>
                        <p className="text-red-500 text-sm">{message}</p>
                        <button
                            onClick={() => navigate('/')}
                            className="mt-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Return to App
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FitbitCallback;
