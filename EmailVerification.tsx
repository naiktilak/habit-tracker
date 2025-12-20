import React, { useState, useEffect } from "react";
import { User, sendEmailVerification, signOut } from "firebase/auth";
import { auth } from "./services/firebaseService";
import { Button, Card } from "./components/UI";
import { Icons } from "./components/Icons";

interface EmailVerificationProps {
    user: User;
}

export const EmailVerification: React.FC<EmailVerificationProps> = ({ user }) => {
    const [cooldown, setCooldown] = useState(0);
    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (cooldown > 0) {
            interval = setInterval(() => {
                setCooldown((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [cooldown]);

    const handleResend = async () => {
        if (cooldown > 0) return;
        setLoading(true);
        setMessage(null);
        try {
            await sendEmailVerification(user);
            setMessage({ type: 'success', text: 'Verification email sent! Please check your inbox.' });
            setCooldown(60);
        } catch (error: any) {
            console.error(error);
            if (error.code === 'auth/too-many-requests') {
                 setMessage({ type: 'error', text: 'Too many requests. Please wait a bit.' });
                 setCooldown(60);
            } else {
                setMessage({ type: 'error', text: 'Failed to send email. Try again later.' });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setLoading(true);
        try {
            await user.reload();
            if (user.emailVerified) {
                // Force a page reload to ensure all app state is fresh for the verified user
                window.location.reload();
            } else {
                setMessage({ type: 'info', text: 'Email not verified yet. Please click the link in your email.' });
            }
        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: 'Failed to refresh status.' });
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md p-8 text-center">
                <div className="flex justify-center mb-6">
                    <div className="bg-indigo-50 p-4 rounded-full">
                        <Icons.Mail className="w-10 h-10 text-indigo-600" />
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-2">Verify your email</h1>
                <p className="text-gray-500 mb-6">
                    We've sent a verification link to <strong>{user.email}</strong>.
                    Please check your inbox and click the link to continue.
                </p>

                {message && (
                    <div className={`text-sm mb-6 p-3 rounded-lg ${
                        message.type === 'success' ? 'bg-green-50 text-green-700' :
                        message.type === 'error' ? 'bg-red-50 text-red-700' :
                        'bg-blue-50 text-blue-700'
                    }`}>
                        {message.text}
                    </div>
                )}

                <div className="space-y-3">
                    <Button
                        onClick={handleRefresh}
                        className="w-full"
                        disabled={loading}
                    >
                        {loading ? 'Checking...' : 'I have verified / Refresh'}
                    </Button>

                    <Button
                        onClick={handleResend}
                        variant="secondary"
                        className="w-full"
                        disabled={cooldown > 0 || loading}
                    >
                        {cooldown > 0 ? `Resend email in ${cooldown}s` : 'Resend verification email'}
                    </Button>

                    <Button
                        onClick={handleLogout}
                        variant="ghost"
                        className="w-full text-gray-500 hover:text-gray-700"
                    >
                        Sign Out
                    </Button>
                </div>
            </Card>
        </div>
    );
};
