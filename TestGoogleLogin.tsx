import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "./services/firebaseService";

export default function TestGoogleLogin() {
    const login = async () => {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        alert("Login success");
    };

    return <button onClick={login}>Login with Google</button>;
}