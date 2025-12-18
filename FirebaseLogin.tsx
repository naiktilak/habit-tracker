import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "./services/firebaseService";
import { Button } from "./components/UI";
import { Icons } from "./components/Icons";

const FirebaseLogin = () => {
    const handleGoogleLogin = async () => {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center">
                <div className="mb-6">
                    <Icons.Activity className="w-10 h-10 text-indigo-600 mx-auto" />
                    <h1 className="text-2xl font-bold mt-4">Welcome to HabitSync</h1>
                    <p className="text-gray-500 mt-1">Login to continue</p>
                </div>

                <Button onClick={handleGoogleLogin} className="w-full py-3">
                    Continue with Google
                </Button>
            </div>
        </div>
    );
};

export default FirebaseLogin;