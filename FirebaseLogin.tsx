import { useState } from "react";
import {
    GoogleAuthProvider,
    signInWithPopup,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword
} from "firebase/auth";
import { auth } from "./services/firebaseService";
import { Button, Input } from "./components/UI";
import { Icons } from "./components/Icons";

const FirebaseLogin = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isSignup, setIsSignup] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleGoogleLogin = async () => {
        try {
            setError("");
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (err: any) {
            console.error(err);
            setError("Failed to login with Google");
        }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            if (isSignup) {
                await createUserWithEmailAndPassword(auth, email, password);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (err: any) {
            console.error(err);
            let message = "An error occurred";
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                message = "Invalid email or password";
            } else if (err.code === 'auth/email-already-in-use') {
                message = "Email already in use";
            } else if (err.code === 'auth/weak-password') {
                message = "Password should be at least 6 characters";
            } else {
                message = err.message;
            }
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center">
                <div className="mb-6">
                    <Icons.Activity className="w-10 h-10 text-indigo-600 mx-auto" />
                    <h1 className="text-2xl font-bold mt-4">Welcome to HabitSync</h1>
                    <p className="text-gray-500 mt-1">
                        {isSignup ? "Create an account" : "Login to continue"}
                    </p>
                </div>

                <form onSubmit={handleEmailAuth} className="text-left mb-6">
                    <Input
                        label="Email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="you@example.com"
                    />
                    <Input
                        label="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                    />

                    {error && (
                        <div className="text-red-500 text-sm mb-4 bg-red-50 p-2 rounded">
                            {error}
                        </div>
                    )}

                    <Button
                        type="submit"
                        className="w-full py-3"
                        disabled={loading}
                    >
                        {loading ? "Processing..." : (isSignup ? "Sign Up" : "Login")}
                    </Button>
                </form>

                <div className="text-sm mb-6">
                    <span className="text-gray-500">
                        {isSignup ? "Already have an account?" : "Don't have an account?"}
                    </span>{" "}
                    <button
                        type="button"
                        onClick={() => {
                            setIsSignup(!isSignup);
                            setError("");
                        }}
                        className="text-indigo-600 font-medium hover:underline"
                    >
                        {isSignup ? "Login" : "Sign Up"}
                    </button>
                </div>

                <div className="relative mb-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-gray-500">Or continue with</span>
                    </div>
                </div>

                <Button onClick={handleGoogleLogin} variant="secondary" className="w-full py-3">
                    Google
                </Button>
            </div>
        </div>
    );
};

export default FirebaseLogin;